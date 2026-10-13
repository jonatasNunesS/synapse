"""
Synapse — "Apagar com ajustes" é tudo ou nada (CODE_HEALTH_AUDIT, ERR-06).

Três fluxos do sistema apagam um registro ajustando os vínculos, na ordem
estoque → financeiro → apagar: em `vendas`, em `clientes` e em `fornecedores`.
O de vendas sempre foi atômico. Os outros dois nasceram da mesma ideia e
ficaram sem a transação.

Por que importa mais aqui do que em outros lugares: a movimentação de estoque
é IMUTÁVEL por regra do módulo, então estornar não é apagar — é somar de volta.
Uma falha depois do estorno deixa o estoque alto com o registro ainda vivo, e
repetir a operação soma outra vez. Não existe desfazer pela tela.
"""
from decimal import Decimal
from unittest.mock import patch

import pytest

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente, InteracaoCliente
from modules.estoque.models import CategoriaEstoque, Movimentacao, Produto
from modules.financeiro.models import Lancamento


# ── Cenário ─────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Atômica", plano="pro")


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="user@atomico.com", nome="User", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def produto(db, empresa, usuario):
    cat = CategoriaEstoque.objects.create(empresa=empresa, nome="Geral")
    return Produto.objects.create(
        empresa=empresa, nome="Camisa", categoria=cat,
        preco_venda=Decimal("50.00"), preco_custo=Decimal("20.00"),
        estoque_atual=Decimal("10"), estoque_minimo=Decimal("1"),
        criado_por=usuario,
    )


def _movimentacao_de_saida(empresa, usuario, produto, quantidade="2"):
    """Uma saída de estoque já aplicada, como a venda teria feito."""
    from modules.estoque.services import EstoqueService

    mov, _ = EstoqueService.registrar_movimentacao(
        empresa_id=empresa.id,
        usuario_id=usuario.id,
        dados={
            "produto": produto.id,
            "tipo": "saida",
            "quantidade": Decimal(quantidade),
            "motivo": "venda",
            "preco_unitario": produto.preco_venda,
        },
    )
    return mov


def _lancamento(empresa, usuario, status="pendente"):
    from modules.financeiro.services import FinanceiroService

    from datetime import date

    return FinanceiroService.criar_lancamento(
        empresa.id, usuario.id,
        {
            "tipo": "receita", "descricao": "Receita do teste",
            "valor": Decimal("100.00"), "data_vencimento": date.today(),
            "status": status,
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# CLIENTES — apagar interação com ajustes
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def interacao(db, empresa, usuario, produto):
    cliente = Cliente.objects.create(empresa=empresa, nome="Ana")
    return InteracaoCliente.objects.create(
        empresa=empresa, cliente=cliente, tipo="venda",
        descricao="Venda antiga", valor=Decimal("100.00"),
        movimentacao_estoque=_movimentacao_de_saida(empresa, usuario, produto),
        lancamento_financeiro=_lancamento(empresa, usuario),
        criado_por=usuario,
    )


@pytest.mark.django_db
def test_clientes_falha_ao_apagar_nao_deixa_estoque_estornado(
    empresa, usuario, produto, interacao
):
    """
    O caso que mais dói: estorno aplicado, exclusão falhou. Sem transação, o
    estoque fica alto e a interação continua lá — e tentar de novo soma outra
    vez.
    """
    from modules.clientes.services import ClienteService

    produto.refresh_from_db()
    estoque_antes = produto.estoque_atual

    with patch(
        "modules.clientes.repository.ClienteRepository.deletar_interacao",
        side_effect=RuntimeError("falhou ao apagar"),
    ):
        with pytest.raises(RuntimeError):
            ClienteService.apagar_interacao_com_ajustes(
                empresa.id, usuario.id, interacao.id,
                estornar_estoque=True, apagar_financeiro=True,
            )

    produto.refresh_from_db()
    assert produto.estoque_atual == estoque_antes, (
        "estoque foi estornado e a interação não foi apagada — estado impossível"
    )
    assert InteracaoCliente.objects.filter(pk=interacao.pk).exists()


@pytest.mark.django_db
def test_clientes_falha_nao_deixa_movimentacao_de_estorno_orfa(
    empresa, usuario, produto, interacao
):
    """O estorno cria uma movimentação inversa: ela também tem de voltar."""
    from modules.clientes.services import ClienteService

    movs_antes = Movimentacao.objects.filter(empresa=empresa).count()

    with patch(
        "modules.clientes.repository.ClienteRepository.deletar_interacao",
        side_effect=RuntimeError("falhou"),
    ):
        with pytest.raises(RuntimeError):
            ClienteService.apagar_interacao_com_ajustes(
                empresa.id, usuario.id, interacao.id, estornar_estoque=True,
            )

    assert Movimentacao.objects.filter(empresa=empresa).count() == movs_antes


@pytest.mark.django_db
def test_clientes_falha_nao_deixa_lancamento_apagado(
    empresa, usuario, produto, interacao
):
    """O ajuste do financeiro também volta atrás."""
    from modules.clientes.services import ClienteService

    lancamento_id = interacao.lancamento_financeiro_id

    with patch(
        "modules.clientes.repository.ClienteRepository.deletar_interacao",
        side_effect=RuntimeError("falhou"),
    ):
        with pytest.raises(RuntimeError):
            ClienteService.apagar_interacao_com_ajustes(
                empresa.id, usuario.id, interacao.id, apagar_financeiro=True,
            )

    assert Lancamento.objects.filter(pk=lancamento_id).exists()


@pytest.mark.django_db
def test_clientes_caminho_normal_continua_funcionando(
    empresa, usuario, produto, interacao
):
    """A transação não pode ter mudado o sucesso."""
    from modules.clientes.services import ClienteService

    resumo = ClienteService.apagar_interacao_com_ajustes(
        empresa.id, usuario.id, interacao.id,
        estornar_estoque=True, apagar_financeiro=True,
    )

    assert resumo["estoque_estornado"] is True
    assert resumo["financeiro_ajustado"] == "apagado"
    assert not InteracaoCliente.objects.filter(pk=interacao.pk).exists()


# ═══════════════════════════════════════════════════════════════════════════
# FORNECEDORES — excluir compra com ajustes
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def compra(db, empresa, usuario, produto):
    from modules.fornecedores.models import CompraFornecedor, Fornecedor

    from datetime import date

    fornecedor = Fornecedor.objects.create(
        empresa=empresa, nome="Fornecedor X", criado_por=usuario
    )
    return CompraFornecedor.objects.create(
        empresa=empresa, fornecedor=fornecedor,
        descricao="Compra antiga", valor=Decimal("200.00"),
        data_compra=date.today(),
        movimentacao_estoque=_movimentacao_de_saida(empresa, usuario, produto, "1"),
        lancamento_financeiro=_lancamento(empresa, usuario),
        criado_por=usuario,
    )


@pytest.mark.django_db
def test_fornecedores_falha_ao_excluir_nao_deixa_estoque_estornado(
    empresa, usuario, produto, compra
):
    from modules.fornecedores.services import FornecedorService

    produto.refresh_from_db()
    estoque_antes = produto.estoque_atual

    with patch(
        "modules.fornecedores.repository.FornecedorRepository.excluir_compra",
        side_effect=RuntimeError("falhou ao excluir"),
    ):
        with pytest.raises(RuntimeError):
            FornecedorService.excluir_compra_com_ajustes(
                empresa.id, usuario.id, compra.id,
                estornar_estoque=True, apagar_financeiro=True,
            )

    produto.refresh_from_db()
    assert produto.estoque_atual == estoque_antes


@pytest.mark.django_db
def test_fornecedores_falha_nao_cancela_o_lancamento_pago(
    empresa, usuario, produto
):
    """
    Lançamento pago é CANCELADO em vez de apagado (regra de imutabilidade).
    Esse cancelamento também tem de voltar atrás.
    """
    from datetime import date

    from modules.fornecedores.models import CompraFornecedor, Fornecedor
    from modules.fornecedores.services import FornecedorService

    fornecedor = Fornecedor.objects.create(
        empresa=empresa, nome="Fornecedor Pago", criado_por=usuario
    )
    pago = _lancamento(empresa, usuario, status="pago")
    c = CompraFornecedor.objects.create(
        empresa=empresa, fornecedor=fornecedor, descricao="Compra paga",
        valor=Decimal("200.00"), data_compra=date.today(),
        lancamento_financeiro=pago, criado_por=usuario,
    )

    with patch(
        "modules.fornecedores.repository.FornecedorRepository.excluir_compra",
        side_effect=RuntimeError("falhou"),
    ):
        with pytest.raises(RuntimeError):
            FornecedorService.excluir_compra_com_ajustes(
                empresa.id, usuario.id, c.id, apagar_financeiro=True,
            )

    pago.refresh_from_db()
    assert pago.status == "pago", "o cancelamento não foi desfeito"


@pytest.mark.django_db
def test_fornecedores_caminho_normal_continua_funcionando(
    empresa, usuario, produto, compra
):
    from modules.fornecedores.models import CompraFornecedor
    from modules.fornecedores.services import FornecedorService

    resumo = FornecedorService.excluir_compra_com_ajustes(
        empresa.id, usuario.id, compra.id,
        estornar_estoque=True, apagar_financeiro=True,
    )

    assert resumo["estoque_estornado"] is True
    assert resumo["financeiro_ajustado"] == "apagado"
    assert not CompraFornecedor.objects.filter(pk=compra.pk).exists()
