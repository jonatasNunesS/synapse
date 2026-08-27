"""
Synapse — Migração das vendas antigas para a entidade Venda (fase 2).

Esta é a fase de maior risco do projeto: mexe em dado real de quem já vendeu.
Os testes aqui existem para provar três coisas, nesta ordem de importância:

1. O DINHEIRO NÃO MUDA. A soma dos valores das interações antigas tem que
   bater ao centavo com a soma dos totais das vendas criadas. Se um teste
   falha, é esse que precisa falhar primeiro.
2. NADA É APAGADO. A interação original permanece exatamente como estava; a
   migração copia, não move.
3. RODAR DE NOVO NÃO DUPLICA. E `--dry-run` não grava nada.
"""
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente, InteracaoCliente
from modules.estoque.models import CategoriaEstoque, Movimentacao, Produto
from modules.financeiro.models import Categoria, Lancamento
from modules.vendas.models import ItemVenda, Venda


# ── Cenário ──────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Loja da Esquina", plano="pro")


@pytest.fixture
def outra_empresa(db):
    return Empresa.objects.create(nome="Concorrente", plano="pro")


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="dono@loja.com", nome="Dono", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def cliente(db, empresa):
    return Cliente.objects.create(empresa=empresa, nome="Maria Souza")


@pytest.fixture
def camisa(db, empresa, usuario):
    categoria = CategoriaEstoque.objects.create(empresa=empresa, nome="Roupas")
    return Produto.objects.create(
        empresa=empresa, categoria=categoria, nome="Camisa", sku="SKU-CAMISA",
        preco_custo=Decimal("10.00"), preco_venda=Decimal("50.00"),
        estoque_atual=Decimal("100"), estoque_minimo=Decimal("1"),
        criado_por=usuario,
    )


def _interacao(empresa, cliente, valor, **extra):
    """Uma venda no formato antigo: uma interação de tipo 'venda'."""
    campos = {
        "empresa": empresa,
        "cliente": cliente,
        "tipo": "venda",
        "titulo": "Venda balcão",
        "valor": Decimal(valor) if valor is not None else None,
        "status_pagamento": "pago",
        "data_interacao": timezone.now(),
    }
    campos.update(extra)
    return InteracaoCliente.objects.create(**campos)


def _movimentacao(empresa, produto, usuario, quantidade, preco, desconto="0"):
    return Movimentacao.objects.create(
        empresa=empresa, produto=produto, tipo="saida", motivo="venda",
        quantidade=Decimal(quantidade),
        estoque_antes=Decimal("100"), estoque_depois=Decimal("100") - Decimal(quantidade),
        preco_unitario=Decimal(preco), desconto=Decimal(desconto),
        criado_por=usuario,
    )


def migrar(*args) -> str:
    saida = StringIO()
    call_command("migrar_vendas", *args, stdout=saida, stderr=saida)
    return saida.getvalue()


# ── A prova principal: o dinheiro não muda ───────────────────────────────────

@pytest.mark.django_db
def test_soma_antes_bate_com_soma_depois(empresa, cliente, camisa, usuario):
    """
    A prova que sustenta a migração inteira.

    Três vendas de formatos diferentes — com movimentação, com movimentação e
    desconto, e sem movimentação nenhuma. O que elas somavam antes é o que as
    vendas somam depois. Ao centavo.
    """
    _interacao(empresa, cliente, "100.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00"))
    # 2 × 50,00 = 100,00 com 10% de desconto → cobrou 90,00.
    _interacao(empresa, cliente, "90.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00", "10"))
    _interacao(empresa, cliente, "37.45")

    migrar()

    antes = sum(
        (i.valor for i in InteracaoCliente.objects.filter(tipo="venda")), Decimal("0")
    )
    depois = sum((v.total for v in Venda.objects.all()), Decimal("0"))
    assert antes == Decimal("227.45")
    assert depois == antes


@pytest.mark.django_db
def test_contagem_bate(empresa, cliente):
    for _ in range(5):
        _interacao(empresa, cliente, "10.00")

    migrar()

    assert Venda.objects.count() == 5
    assert InteracaoCliente.objects.filter(migrada_para_venda__isnull=False).count() == 5


@pytest.mark.django_db
def test_nao_migra_interacao_que_nao_e_venda(empresa, cliente):
    _interacao(empresa, cliente, "10.00", tipo="ligacao", titulo="Liguei")
    _interacao(empresa, cliente, "20.00", tipo="proposta", titulo="Proposta")
    _interacao(empresa, cliente, "30.00")

    migrar()

    assert Venda.objects.count() == 1
    assert Venda.objects.get().total == Decimal("30.00")


# ── Nada é apagado ───────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_interacao_original_permanece_intacta(empresa, cliente):
    interacao = _interacao(empresa, cliente, "80.00", descricao="pagou em duas vezes")
    antes = {
        campo: getattr(interacao, campo)
        for campo in ("tipo", "titulo", "descricao", "valor", "status_pagamento",
                      "data_interacao", "cliente_id", "empresa_id")
    }

    migrar()

    interacao.refresh_from_db()
    for campo, valor in antes.items():
        assert getattr(interacao, campo) == valor, f"{campo} mudou na migração"
    assert InteracaoCliente.objects.count() == 1


@pytest.mark.django_db
def test_vinculo_liga_a_antiga_a_nova_nos_dois_sentidos(empresa, cliente):
    interacao = _interacao(empresa, cliente, "80.00")

    migrar()

    interacao.refresh_from_db()
    venda = Venda.objects.get()
    assert interacao.migrada_para_venda_id == venda.id
    assert venda.interacao_migrada.get().id == interacao.id


# ── Idempotência ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_rodar_duas_vezes_nao_duplica(empresa, cliente, camisa, usuario):
    _interacao(empresa, cliente, "100.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00"))
    _interacao(empresa, cliente, "40.00")

    migrar()
    total_primeira = sum((v.total for v in Venda.objects.all()), Decimal("0"))

    saida = migrar()

    assert Venda.objects.count() == 2
    assert ItemVenda.objects.count() == 2
    assert sum((v.total for v in Venda.objects.all()), Decimal("0")) == total_primeira
    assert "2 já migrada(s) anteriormente" in saida


@pytest.mark.django_db
def test_segunda_rodada_migra_so_o_que_e_novo(empresa, cliente):
    _interacao(empresa, cliente, "10.00")
    migrar()

    _interacao(empresa, cliente, "25.00")
    migrar()

    assert Venda.objects.count() == 2
    assert sum((v.total for v in Venda.objects.all()), Decimal("0")) == Decimal("35.00")


# ── --dry-run não grava ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_dry_run_nao_grava_nada(empresa, cliente, camisa, usuario):
    interacao = _interacao(empresa, cliente, "100.00",
                           movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00"))

    saida = migrar("--dry-run")

    assert Venda.objects.count() == 0
    assert ItemVenda.objects.count() == 0
    interacao.refresh_from_db()
    assert interacao.migrada_para_venda_id is None
    assert "Simulação" in saida


@pytest.mark.django_db
def test_dry_run_mostra_os_mesmos_numeros_da_execucao(empresa, cliente):
    _interacao(empresa, cliente, "60.00")
    _interacao(empresa, cliente, "40.00")

    simulado = migrar("--dry-run")
    executado = migrar()

    for trecho in ("2 vendas", "100.00"):
        assert trecho in simulado
        assert trecho in executado


# ── Multi-tenant ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_empresa_migra_so_aquela_empresa(empresa, outra_empresa, cliente):
    alheio = Cliente.objects.create(empresa=outra_empresa, nome="Cliente Alheio")
    _interacao(empresa, cliente, "50.00")
    interacao_alheia = _interacao(outra_empresa, alheio, "70.00")

    migrar(f"--empresa={empresa.id}")

    assert Venda.objects.count() == 1
    assert Venda.objects.get().empresa_id == empresa.id
    interacao_alheia.refresh_from_db()
    assert interacao_alheia.migrada_para_venda_id is None


@pytest.mark.django_db
def test_venda_migrada_fica_na_empresa_certa(empresa, cliente):
    _interacao(empresa, cliente, "50.00")

    migrar()

    venda = Venda.objects.get()
    assert venda.empresa_id == empresa.id
    assert venda.itens.get().empresa_id == empresa.id


# ── Classe A: o item reconstruído da movimentação ────────────────────────────

@pytest.mark.django_db
def test_classe_a_reconstroi_produto_quantidade_e_preco(empresa, cliente, camisa, usuario):
    _interacao(empresa, cliente, "100.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00"))

    migrar()

    item = ItemVenda.objects.get()
    assert item.produto_id == camisa.id
    assert item.quantidade == Decimal("2.000")
    assert item.preco_unitario == Decimal("50.00")
    assert item.subtotal == Decimal("100.00")
    assert Venda.objects.get().total == Decimal("100.00")


@pytest.mark.django_db
def test_classe_a_com_desconto_percentual_fecha_no_valor_cobrado(
    empresa, cliente, camisa, usuario
):
    """
    A movimentação guarda desconto em % e a Venda em reais — não se convertem.

    O item mantém o preço que a movimentação registrou; o desconto da venda é
    a diferença observada entre o que os itens somam e o que a interação de
    fato cobrou. O percentual original fica escrito na observação.
    """
    _interacao(empresa, cliente, "90.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00", "10"))

    migrar()

    venda = Venda.objects.get()
    assert venda.subtotal == Decimal("100.00")
    assert venda.desconto == Decimal("10.00")
    assert venda.total == Decimal("90.00")
    assert "[desconto original: 10.00%]" in venda.observacoes


@pytest.mark.django_db
def test_movimentacao_que_nao_cobre_o_valor_vira_item_livre_com_rastro(
    empresa, cliente, camisa, usuario
):
    """
    A Venda tem desconto, não acréscimo.

    Se a movimentação soma menos do que foi cobrado, o produto não cabe na
    linha sem mexer no dinheiro — e o dinheiro é o que não pode mudar. A
    linha vira livre e o produto original fica registrado na observação.
    """
    _interacao(empresa, cliente, "150.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00"))

    migrar()

    venda = Venda.objects.get()
    assert venda.total == Decimal("150.00")
    assert venda.itens.get().produto_id is None
    assert "[movimentação original: Camisa, 2.000 × R$ 50.00]" in venda.observacoes


@pytest.mark.django_db
def test_movimentacao_sem_preco_vira_item_livre_com_rastro(empresa, cliente, camisa, usuario):
    movimentacao = _movimentacao(empresa, camisa, usuario, "3", "10.00")
    Movimentacao.objects.filter(pk=movimentacao.pk).update(preco_unitario=None)
    _interacao(empresa, cliente, "45.00", movimentacao_estoque=movimentacao)

    migrar()

    venda = Venda.objects.get()
    assert venda.total == Decimal("45.00")
    assert venda.itens.get().produto_id is None
    assert "movimentação original sem preço: Camisa" in venda.observacoes


# ── Classe B: o item livre ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_classe_b_cria_item_livre_com_o_valor_inteiro(empresa, cliente):
    _interacao(empresa, cliente, "1200.00", titulo="Cerimonial de casamento")

    migrar()

    item = ItemVenda.objects.get()
    assert item.produto_id is None
    assert item.descricao == "Cerimonial de casamento"
    assert item.quantidade == Decimal("1.000")
    assert item.preco_unitario == Decimal("1200.00")
    assert item.subtotal == Decimal("1200.00")


@pytest.mark.django_db
def test_item_livre_sem_titulo_ganha_nome_generico(empresa, cliente):
    """O model recusa linha sem nome — e uma linha sem nome não diz nada."""
    _interacao(empresa, cliente, "50.00", titulo="")

    migrar()

    assert ItemVenda.objects.get().descricao == "Venda migrada"


# ── O que a venda antiga carregava ───────────────────────────────────────────

@pytest.mark.django_db
def test_cliente_nunca_se_perde(empresa, cliente):
    _interacao(empresa, cliente, "50.00")

    migrar()

    assert Venda.objects.get().cliente_id == cliente.id


@pytest.mark.django_db
def test_data_e_titulo_e_descricao_sao_preservados(empresa, cliente):
    quando = timezone.now() - timezone.timedelta(days=30)
    _interacao(empresa, cliente, "50.00", titulo="Venda de sábado",
               descricao="cliente levou duas", data_interacao=quando)

    migrar()

    venda = Venda.objects.get()
    assert venda.data_venda == timezone.localtime(quando).date()
    assert "Venda de sábado" in venda.observacoes
    assert "cliente levou duas" in venda.observacoes


@pytest.mark.django_db
def test_criado_em_original_e_preservado(empresa, cliente):
    """Sem isso toda venda migrada nasceria 'criada hoje'."""
    interacao = _interacao(empresa, cliente, "50.00")
    antigo = timezone.now() - timezone.timedelta(days=200)
    InteracaoCliente.objects.filter(pk=interacao.pk).update(criado_em=antigo)

    migrar()

    assert Venda.objects.get().criado_em == antigo


@pytest.mark.django_db
def test_criado_por_e_preservado(empresa, cliente, usuario):
    _interacao(empresa, cliente, "50.00", criado_por=usuario)

    migrar()

    assert Venda.objects.get().criado_por_id == usuario.id


@pytest.mark.django_db
def test_data_prevista_de_pagamento_e_preservada(empresa, cliente):
    vencimento = timezone.localdate() + timezone.timedelta(days=15)
    _interacao(empresa, cliente, "50.00", status_pagamento="pendente",
               data_prevista_pagamento=vencimento)

    migrar()

    assert Venda.objects.get().data_prevista_pagamento == vencimento


# ── Status de pagamento ──────────────────────────────────────────────────────

@pytest.mark.django_db
@pytest.mark.parametrize("original", ["pago", "pendente"])
def test_status_com_equivalente_passa_igual(empresa, cliente, original):
    _interacao(empresa, cliente, "50.00", status_pagamento=original)

    migrar()

    venda = Venda.objects.get()
    assert venda.status_pagamento == original
    assert "[migrado de status:" not in venda.observacoes


@pytest.mark.django_db
@pytest.mark.parametrize("original", ["cancelado", "nao_se_aplica"])
def test_status_sem_equivalente_vira_pendente_com_rastro(empresa, cliente, original):
    """
    A Venda só tem pago e pendente.

    "Cancelado" é informação real e não pode sumir: o status conservador é
    pendente, e o original fica escrito na observação para quem for auditar.
    """
    _interacao(empresa, cliente, "50.00", status_pagamento=original)

    migrar()

    venda = Venda.objects.get()
    assert venda.status_pagamento == "pendente"
    assert f"[migrado de status: {original}]" in venda.observacoes


# ── Financeiro: a migração não pode duplicar receita ─────────────────────────

@pytest.mark.django_db
def test_lancamento_financeiro_e_copiado(empresa, cliente, usuario):
    """
    A venda antiga já foi ao financeiro.

    Copiar a FK é o que vai permitir à fase 3 saber que esta venda já tem
    lançamento — e não lançar a mesma receita duas vezes.
    """
    categoria = Categoria.objects.create(
        empresa=empresa, nome="Vendas", tipo="receita"
    )
    lancamento = Lancamento.objects.create(
        empresa=empresa, categoria=categoria, tipo="receita",
        descricao="Venda", valor=Decimal("50.00"),
        data_vencimento=timezone.localdate(), criado_por=usuario,
    )
    _interacao(empresa, cliente, "50.00", lancamento_financeiro=lancamento)

    migrar()

    assert Venda.objects.get().lancamento_financeiro_id == lancamento.id


@pytest.mark.django_db
def test_migracao_nao_cria_lancamento_financeiro(empresa, cliente):
    _interacao(empresa, cliente, "50.00")

    migrar()

    assert Lancamento.objects.count() == 0


@pytest.mark.django_db
def test_migracao_nao_mexe_no_estoque(empresa, cliente, camisa, usuario):
    """A baixa já aconteceu quando a venda antiga foi feita. Baixar de novo
    descontaria o mesmo produto duas vezes."""
    antes = camisa.estoque_atual
    _interacao(empresa, cliente, "100.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00"))

    migrar()

    camisa.refresh_from_db()
    assert camisa.estoque_atual == antes
    assert Movimentacao.objects.count() == 1


# ── O que fica para trás, e aparece ──────────────────────────────────────────

@pytest.mark.django_db
def test_interacao_sem_valor_e_pulada_e_reportada(empresa, cliente):
    """Criar venda de R$ 0 inventaria um número que a interação nunca teve."""
    sem_valor = _interacao(empresa, cliente, None)
    _interacao(empresa, cliente, "50.00")

    saida = migrar()

    assert Venda.objects.count() == 1
    sem_valor.refresh_from_db()
    assert sem_valor.migrada_para_venda_id is None
    assert "1 pulada(s): sem valor" in saida


# ── Relatório ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_relatorio_traz_classes_totais_e_conferencia(empresa, cliente, camisa, usuario):
    _interacao(empresa, cliente, "100.00",
               movimentacao_estoque=_movimentacao(empresa, camisa, usuario, "2", "50.00"))
    _interacao(empresa, cliente, "30.00")
    _interacao(empresa, cliente, "20.00", status_pagamento="cancelado")

    saida = migrar()

    assert str(empresa.id) in saida
    assert "3 vendas migradas" in saida
    assert "classe A (produto reconstruído): 1" in saida
    assert "classe B (item livre):           2" in saida
    assert "status convertido:               1" in saida
    assert "Total R$ antes:  150.00" in saida
    assert "Total R$ depois: 150.00" in saida
    assert "Os totais batem." in saida


@pytest.mark.django_db
def test_relatorio_separa_por_empresa(empresa, outra_empresa, cliente):
    alheio = Cliente.objects.create(empresa=outra_empresa, nome="Cliente Alheio")
    _interacao(empresa, cliente, "50.00")
    _interacao(outra_empresa, alheio, "70.00")

    saida = migrar()

    assert str(empresa.id) in saida
    assert str(outra_empresa.id) in saida
    assert "50.00" in saida and "70.00" in saida


@pytest.mark.django_db
def test_sem_nada_a_migrar_diz_isso(empresa):
    saida = migrar()
    assert "Nenhuma venda antiga pendente de migração." in saida


@pytest.mark.django_db
def test_empresa_invalida_para_com_erro_claro(empresa):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError, match="não é um UUID"):
        migrar("--empresa=nao-e-uuid")
