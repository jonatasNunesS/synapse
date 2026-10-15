"""
Synapse — Os agregados de compra do cliente saem de `Venda` (B10).

O cliente que comprou R$ 450 mostrava R$ 0,00. Não era conta errada: era
escrita que nunca acontecia. As colunas `valor_total_compras`,
`valor_recebido`, `valor_a_receber`, `quantidade_compras` e `ultima_compra`
eram alimentadas por um `post_save` em `InteracaoCliente`, e `Venda` nasceu
noutro módulo — o gatilho nunca a alcançou.

Este arquivo cobre o que o conserto precisa garantir e que não cabia em
`test_clientes.py`, que olha o CRM: o vínculo (pôr, trocar, tirar), o
caminho em que as duas fontes poderiam contar em dobro, o ticket médio do
dashboard e o comando de retro-população.
"""
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente, InteracaoCliente
from modules.clientes.repository import ClienteRepository
from modules.vendas.models import Venda
from modules.vendas.services import VendaService


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Loja", plano="pro")


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="dono@loja.com", nome="Dono", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def ana(db, empresa):
    return Cliente.objects.create(empresa=empresa, nome="Ana")


@pytest.fixture
def bruno(db, empresa):
    return Cliente.objects.create(empresa=empresa, nome="Bruno")


def vender(empresa, usuario, cliente=None, total="450.00", status="pago", **extra):
    dados = {
        "cliente": cliente,
        "desconto": Decimal("0"),
        "forma_pagamento": "dinheiro",
        "status_pagamento": status,
        "itens": [{"produto": None, "descricao": "Serviço",
                   "quantidade": Decimal("1"), "preco_unitario": Decimal(total)}],
    }
    if status == "pendente":
        dados.setdefault("data_prevista_pagamento", timezone.localdate())
    dados.update(extra)
    return VendaService.criar(empresa.id, usuario.id, dados)


def ler(cliente):
    cliente.refresh_from_db()
    return (
        cliente.valor_total_compras,
        cliente.quantidade_compras,
        cliente.ticket_medio,
    )


# ════════════════════════════════════════════════════════════
# O CASO DO RELATO
# ════════════════════════════════════════════════════════════


def test_venda_de_450_aparece_no_cliente(empresa, usuario, ana):
    """O que o QA viu em staging, do avesso."""
    vender(empresa, usuario, ana, "450.00")

    assert ler(ana) == (Decimal("450.00"), 1, Decimal("450.00"))
    ana.refresh_from_db()
    assert ana.ultima_compra == timezone.localdate()


def test_fiada_confirmada_tambem(empresa, usuario, ana):
    venda = vender(empresa, usuario, ana, "450.00", status="pendente")
    assert ler(ana) == (Decimal("450.00"), 1, Decimal("450.00"))

    VendaService.confirmar_pagamento(empresa.id, usuario.id, venda.id)

    ana.refresh_from_db()
    assert ler(ana) == (Decimal("450.00"), 1, Decimal("450.00"))
    assert ana.valor_recebido == Decimal("450.00")
    assert ana.valor_a_receber == Decimal("0")


# ════════════════════════════════════════════════════════════
# O VÍNCULO: PÔR, TROCAR, TIRAR
# ════════════════════════════════════════════════════════════


def test_vincular_faz_o_cliente_passar_a_contar(empresa, usuario, ana):
    """Venda de balcão que ganha dono depois."""
    venda = vender(empresa, usuario, cliente=None, total="300.00")
    assert ler(ana) == (Decimal("0.00"), 0, 0)

    VendaService.vincular_cliente(empresa.id, venda.id, ana.id)

    assert ler(ana) == (Decimal("300.00"), 1, Decimal("300.00"))


def test_trocar_o_dono_desce_de_um_e_sobe_no_outro(empresa, usuario, ana, bruno):
    """
    O caso que o endpoint de vínculo não previa.

    `vincular_cliente` dizia, no docstring, que "põe, troca ou tira o cliente
    de uma venda, e não faz mais nada" — verdade para o DINHEIRO (o
    lançamento fica onde está, o recebido continua recebido) e deixou de ser
    verdade para os agregados: quanto esta pessoa comprou é pergunta com
    outra resposta depois da troca, nos DOIS clientes.
    """
    venda = vender(empresa, usuario, ana, "500.00")
    assert ler(ana) == (Decimal("500.00"), 1, Decimal("500.00"))

    VendaService.vincular_cliente(empresa.id, venda.id, bruno.id)

    assert ler(ana) == (Decimal("0.00"), 0, 0)
    assert ler(bruno) == (Decimal("500.00"), 1, Decimal("500.00"))


def test_desvincular_zera_quem_tinha(empresa, usuario, ana):
    venda = vender(empresa, usuario, ana, "500.00")

    VendaService.vincular_cliente(empresa.id, venda.id, None)

    assert ler(ana) == (Decimal("0.00"), 0, 0)
    ana.refresh_from_db()
    assert ana.ultima_compra is None
    # A venda continua existindo — ela só não é de ninguém.
    assert Venda.objects.filter(pk=venda.id, cliente__isnull=True).exists()


def test_o_patch_que_troca_o_dono_tambem_recalcula_os_dois(
    empresa, usuario, ana, bruno
):
    """O PATCH da venda inteira passa pelo mesmo caminho do endpoint de vínculo."""
    venda = vender(empresa, usuario, ana, "200.00")

    VendaService.atualizar(empresa.id, venda.id, {"cliente": bruno})

    assert ler(ana) == (Decimal("0.00"), 0, 0)
    assert ler(bruno) == (Decimal("200.00"), 1, Decimal("200.00"))


# ════════════════════════════════════════════════════════════
# A DUPLA CONTAGEM
# ════════════════════════════════════════════════════════════


def test_venda_migrada_conta_uma_vez_so(empresa, usuario, ana):
    """
    O estado das vendas que a fase 2 converteu.

    A migração não apagou a `InteracaoCliente` original — "REGRA DE OURO:
    nada é apagado" — e ela continua no banco, vinculada à `Venda` que saiu
    dela. Somar as duas fontes daria o dobro: medido no diagnóstico, 400 onde
    a venda foi 200. A fonte é única justamente para isto.
    """
    venda = vender(empresa, usuario, ana, "200.00")
    original = InteracaoCliente.objects.create(
        cliente=ana, empresa=empresa, tipo="venda", titulo="Original",
        valor=Decimal("200.00"), status_pagamento="pago",
    )
    InteracaoCliente.objects.filter(pk=original.pk).update(migrada_para_venda=venda)

    ClienteRepository.recalcular_agregados_cliente(ana.id)

    assert ler(ana) == (Decimal("200.00"), 1, Decimal("200.00"))


def test_interacao_de_venda_sem_migrar_nao_entra(empresa, usuario, ana):
    """
    Fonte única quer dizer única, inclusive para o que ficou para trás.

    A tela de Clientes não oferece mais "Venda" como tipo de interação, então
    não nascem novas. As que existem são convertidas por `migrar_vendas` — e
    o comando de recálculo recusa-se a rodar enquanto houver alguma, porque
    ela representa dinheiro que o cliente mostrava e deixaria de mostrar.
    """
    InteracaoCliente.objects.create(
        cliente=ana, empresa=empresa, tipo="venda", titulo="Nunca migrada",
        valor=Decimal("999.00"), status_pagamento="pago",
    )

    ClienteRepository.recalcular_agregados_cliente(ana.id)

    assert ler(ana) == (Decimal("0.00"), 0, 0)


# ════════════════════════════════════════════════════════════
# O TICKET MÉDIO DO DASHBOARD
# ════════════════════════════════════════════════════════════


def test_ticket_medio_e_por_venda_nao_por_cliente(empresa, usuario, ana):
    """
    Dez clientes ativos, uma venda de R$ 450.

    Era `Avg("valor_total_compras")` sobre todos os clientes ativos: os nove
    que nunca compraram entravam na média com zero e o cartão mostrava
    R$ 45. O nome do cartão prometia outra conta, e agora é essa.
    """
    for i in range(9):
        Cliente.objects.create(empresa=empresa, nome=f"Lead {i}")
    vender(empresa, usuario, ana, "450.00")

    resumo = ClienteRepository.calcular_resumo(empresa.id)

    assert resumo["ticket_medio_geral"] == Decimal("450.00")
    assert resumo["valor_total_gerado"] == Decimal("450.00")
    assert resumo["clientes_ativos"] == 10


def test_ticket_medio_e_media_das_vendas_e_nao_do_maior(empresa, usuario, ana, bruno):
    """Três vendas, dois clientes: a média é das vendas."""
    vender(empresa, usuario, ana, "100.00")
    vender(empresa, usuario, ana, "200.00")
    vender(empresa, usuario, bruno, "300.00")

    resumo = ClienteRepository.calcular_resumo(empresa.id)

    assert resumo["ticket_medio_geral"] == Decimal("200.00")  # 600 / 3


def test_venda_cancelada_fica_fora_do_ticket(empresa, usuario, ana):
    vender(empresa, usuario, ana, "100.00")
    cancelada = vender(empresa, usuario, ana, "900.00", status="pendente")
    VendaService.cancelar_pagamento(empresa.id, cancelada.id)

    resumo = ClienteRepository.calcular_resumo(empresa.id)

    assert resumo["ticket_medio_geral"] == Decimal("100.00")


def test_empresa_sem_venda_tem_ticket_zero_e_nao_erro(empresa):
    """Zero de verdade continua sendo zero — não `None`, não exceção."""
    resumo = ClienteRepository.calcular_resumo(empresa.id)

    assert resumo["ticket_medio_geral"] == 0
    assert resumo["valor_total_gerado"] == 0


# ════════════════════════════════════════════════════════════
# O COMANDO DE RETRO-POPULAÇÃO
# ════════════════════════════════════════════════════════════


def _rodar(*args):
    saida = StringIO()
    call_command("recalcular_agregados_clientes", *args, stdout=saida)
    return saida.getvalue()


def _desarrumar(cliente):
    """Põe o cliente no estado em que o B10 o deixava: venda existe, total zero."""
    Cliente.objects.filter(pk=cliente.pk).update(
        valor_total_compras=0, valor_recebido=0, valor_a_receber=0,
        quantidade_compras=0, ultima_compra=None,
    )


def test_o_comando_conserta_o_cliente_zerado(empresa, usuario, ana):
    vender(empresa, usuario, ana, "450.00")
    _desarrumar(ana)
    assert ler(ana) == (Decimal("0.00"), 0, 0)

    saida = _rodar()

    assert ler(ana) == (Decimal("450.00"), 1, Decimal("450.00"))
    assert "valor_total_compras: 0.00 → 450.00" in saida


def test_dry_run_nao_grava(empresa, usuario, ana):
    vender(empresa, usuario, ana, "450.00")
    _desarrumar(ana)

    saida = _rodar("--dry-run")

    assert ler(ana) == (Decimal("0.00"), 0, 0)
    assert "mudariam" in saida
    assert "nada foi gravado" in saida.lower()


def test_rodar_duas_vezes_nao_muda_nada(empresa, usuario, ana):
    """Idempotente porque o recálculo é completo, não incremental."""
    vender(empresa, usuario, ana, "450.00")
    _desarrumar(ana)

    _rodar()
    primeiro = ler(ana)
    saida = _rodar()

    assert ler(ana) == primeiro
    assert "Nenhum agregado fora do lugar" in saida


def test_empresa_limita_o_alcance(empresa, usuario, ana):
    outra = Empresa.objects.create(nome="Outra", plano="pro")
    de_fora = Cliente.objects.create(empresa=outra, nome="De fora")
    outro_usuario = CustomUser.objects.create_user(
        email="o@o.com", nome="O", senha="Senha@12345", empresa=outra, perfil="admin",
    )
    vender(empresa, usuario, ana, "450.00")
    vender(outra, outro_usuario, de_fora, "100.00")
    _desarrumar(ana)
    _desarrumar(de_fora)

    _rodar(f"--empresa={empresa.id}")

    assert ler(ana) == (Decimal("450.00"), 1, Decimal("450.00"))
    assert ler(de_fora) == (Decimal("0.00"), 0, 0)  # intocada


def test_o_comando_recusa_rodar_com_interacao_nao_migrada(empresa, usuario, ana):
    """
    A guarda de ordem: `migrar_vendas` primeiro, recálculo depois.

    Uma interação tipo=venda ainda não convertida é dinheiro que o cliente
    mostrava e que este recálculo não conta. Gravar assim derruba um total
    sem explicação — então o comando para, diz quanto está em jogo, e não
    escreve nada.
    """
    vender(empresa, usuario, ana, "450.00")
    _desarrumar(ana)
    InteracaoCliente.objects.create(
        cliente=ana, empresa=empresa, tipo="venda", titulo="Não migrada",
        valor=Decimal("300.00"), status_pagamento="pago",
    )

    saida = _rodar()

    assert ler(ana) == (Decimal("0.00"), 0, 0)   # não gravou
    assert "NÃO migradas" in saida
    assert "R$ 300.00" in saida
    assert "migrar_vendas" in saida


def test_mesmo_assim_grava_depois_do_aviso(empresa, usuario, ana):
    vender(empresa, usuario, ana, "450.00")
    _desarrumar(ana)
    InteracaoCliente.objects.create(
        cliente=ana, empresa=empresa, tipo="venda", titulo="Não migrada",
        valor=Decimal("300.00"), status_pagamento="pago",
    )

    saida = _rodar("--mesmo-assim")

    assert ler(ana) == (Decimal("450.00"), 1, Decimal("450.00"))
    assert "seguindo" in saida


def test_uuid_invalido_e_erro_claro(empresa):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError, match="não é um UUID"):
        _rodar("--empresa=nao-sou-uuid")
