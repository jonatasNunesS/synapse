"""
Synapse — Pagar uma venda move o cliente para "Fechado".

FEATURE NOVA. O diagnóstico do B10 foi atrás de uma promoção automática que
teria se perdido na refatoração e descobriu que ela nunca existiu: nem o
fluxo de `Venda`, nem o antigo de `InteracaoCliente` mexiam em
`status_funil`. Os três escritores eram todos manuais — o arrastar do
Kanban, a ação em massa do admin e o default "lead".

A REGRA, em uma frase: **promove, nunca rebaixa.**

Quem pagou fechou, e isso é inferência segura. O contrário não é: apagar a
venda não quer dizer que o negócio se desfez, e o dono pode ter movido o
cliente à mão depois, por um motivo que o sistema não conhece. Um
rebaixamento automático desfaria essa decisão sem avisar.
"""
from decimal import Decimal

import pytest
from django.utils import timezone

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente, InteracaoCliente
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


def cliente_em(empresa, status, nome="Ana"):
    return Cliente.objects.create(empresa=empresa, nome=nome, status_funil=status)


def vender(empresa, usuario, cliente=None, total="450.00", status="pago"):
    dados = {
        "cliente": cliente,
        "desconto": Decimal("0"),
        "forma_pagamento": "dinheiro",
        "status_pagamento": status,
        "itens": [{"produto": None, "descricao": "Serviço",
                   "quantidade": Decimal("1"), "preco_unitario": Decimal(total)}],
    }
    if status == "pendente":
        dados["data_prevista_pagamento"] = timezone.localdate()
    return VendaService.criar(empresa.id, usuario.id, dados)


def funil(cliente):
    cliente.refresh_from_db()
    return cliente.status_funil


# ════════════════════════════════════════════════════════════
# À VISTA: PROMOVE NA CRIAÇÃO
# ════════════════════════════════════════════════════════════


@pytest.mark.parametrize("origem", ["lead", "contato", "proposta", "negociacao"])
def test_venda_paga_promove_de_qualquer_etapa_do_funil(empresa, usuario, origem):
    ana = cliente_em(empresa, origem)

    vender(empresa, usuario, ana)

    assert funil(ana) == "fechado"


def test_perdido_tambem_volta_a_fechado(empresa, usuario):
    """
    Voltar a comprar é exatamente o que desfaz um "perdido".

    Está na lista de propósito: deixar de fora seria manter como perdido
    alguém que acabou de pagar, que é o retrato mais errado que o funil pode
    mostrar.
    """
    ana = cliente_em(empresa, "perdido")

    vender(empresa, usuario, ana)

    assert funil(ana) == "fechado"


def test_quem_ja_esta_em_fechado_nao_muda_nem_ganha_linha(empresa, usuario):
    ana = cliente_em(empresa, "fechado")

    vender(empresa, usuario, ana)

    assert funil(ana) == "fechado"
    assert not InteracaoCliente.objects.filter(cliente=ana).exists()


def test_venda_sem_cliente_nao_promove_ninguem(empresa, usuario):
    """Venda de balcão não tem dono — e não pode inventar um."""
    ana = cliente_em(empresa, "lead")

    vender(empresa, usuario, cliente=None)

    assert funil(ana) == "lead"


# ════════════════════════════════════════════════════════════
# FIADO: SÓ NO PRIMEIRO RECEBIMENTO
# ════════════════════════════════════════════════════════════


def test_fiado_nao_promove_ao_ser_registrado(empresa, usuario):
    """
    Fiado registrado é promessa, não pagamento.

    A venda conta no total e na quantidade do cliente desde já — é compra.
    O funil é outra pergunta: ele responde se o negócio fechou, e fiado em
    aberto ainda pode não fechar.
    """
    ana = cliente_em(empresa, "negociacao")

    vender(empresa, usuario, ana, status="pendente")

    assert funil(ana) == "negociacao"
    ana.refresh_from_db()
    assert ana.valor_total_compras == Decimal("450.00")  # a compra conta


def test_primeiro_recebimento_promove(empresa, usuario):
    ana = cliente_em(empresa, "negociacao")
    venda = vender(empresa, usuario, ana, status="pendente")

    VendaService.confirmar_pagamento(empresa.id, usuario.id, venda.id)

    assert funil(ana) == "fechado"


def test_recebimento_parcial_ja_promove(empresa, usuario):
    """Parcial conta: quem pagou uma parte já fechou."""
    ana = cliente_em(empresa, "lead")
    venda = vender(empresa, usuario, ana, total="500.00", status="pendente")

    VendaService.confirmar_pagamento(
        empresa.id, usuario.id, venda.id,
        valor_recebido=Decimal("100.00"),
        data_prevista_saldo=timezone.localdate(),
    )

    assert funil(ana) == "fechado"
    ana.refresh_from_db()
    assert ana.valor_a_receber == Decimal("400.00")   # e ainda se cobra o resto


def test_o_segundo_recebimento_nao_registra_de_novo(empresa, usuario):
    """
    A linha na timeline aparece uma vez, não a cada parcela.

    Quitar em três vezes não deve encher o histórico com três avisos de uma
    mudança que aconteceu uma vez só.
    """
    ana = cliente_em(empresa, "lead")
    venda = vender(empresa, usuario, ana, total="300.00", status="pendente")

    for parcela in ("100.00", "100.00", "100.00"):
        VendaService.confirmar_pagamento(
            empresa.id, usuario.id, venda.id,
            valor_recebido=Decimal(parcela),
            data_prevista_saldo=timezone.localdate(),
        )

    assert funil(ana) == "fechado"
    assert InteracaoCliente.objects.filter(cliente=ana).count() == 1


# ════════════════════════════════════════════════════════════
# NUNCA REBAIXA
# ════════════════════════════════════════════════════════════


def test_a_segunda_parcela_nao_desfaz_um_rebaixamento_manual(empresa, usuario):
    """
    Por que a promoção olha só o PRIMEIRO recebimento.

    A idempotência do repository ("já está em fechado, não faz nada") cobre o
    caso comum de quitar em parcelas. O que ela não cobre é este: o dono viu
    a promoção, discordou e moveu o cliente de volta. Sem a guarda do
    primeiro recebimento, a parcela seguinte o empurraria para "fechado" de
    novo — desfazendo em silêncio uma decisão tomada à mão, que é exatamente
    o que esta feature promete nunca fazer.
    """
    from modules.clientes.repository import ClienteRepository

    ana = cliente_em(empresa, "lead")
    venda = vender(empresa, usuario, ana, total="300.00", status="pendente")

    VendaService.confirmar_pagamento(
        empresa.id, usuario.id, venda.id,
        valor_recebido=Decimal("100.00"),
        data_prevista_saldo=timezone.localdate(),
    )
    assert funil(ana) == "fechado"

    ClienteRepository.mover_funil(Cliente.objects.get(pk=ana.pk), "negociacao")

    VendaService.confirmar_pagamento(
        empresa.id, usuario.id, venda.id,
        valor_recebido=Decimal("200.00"),
    )

    assert funil(ana) == "negociacao"


def test_apagar_a_venda_nao_rebaixa(empresa, usuario):
    """
    A metade da regra que protege a decisão de quem usa o sistema.

    Os agregados descem — a compra deixou de existir. O funil não: ele
    guarda uma leitura do relacionamento, e nada aqui sabe se o negócio se
    desfez ou se foi um erro de digitação.
    """
    ana = cliente_em(empresa, "lead")
    venda = vender(empresa, usuario, ana)
    assert funil(ana) == "fechado"

    VendaService.deletar(empresa.id, venda.id)

    assert funil(ana) == "fechado"
    ana.refresh_from_db()
    assert ana.valor_total_compras == Decimal("0")   # o dinheiro, sim, some


def test_cancelar_o_pagamento_nao_rebaixa(empresa, usuario):
    ana = cliente_em(empresa, "lead")
    venda = vender(empresa, usuario, ana, total="300.00", status="pendente")
    VendaService.confirmar_pagamento(
        empresa.id, usuario.id, venda.id,
        valor_recebido=Decimal("100.00"),
        data_prevista_saldo=timezone.localdate(),
    )
    assert funil(ana) == "fechado"

    VendaService.cancelar_pagamento(empresa.id, venda.id)

    assert funil(ana) == "fechado"


def test_mover_a_mao_para_tras_nao_e_desfeito_por_outra_venda_apagada(
    empresa, usuario
):
    """
    O caso que fez a promoção ser por EVENTO e não por estado.

    Se ela dependesse do estado ("tem venda paga → fechado"), qualquer
    recálculo posterior re-promoveria o cliente e desfaria, em silêncio, o
    que o dono acabou de decidir à mão.
    """
    from modules.clientes.repository import ClienteRepository

    ana = cliente_em(empresa, "lead")
    vender(empresa, usuario, ana, total="100.00")
    assert funil(ana) == "fechado"

    # O dono discorda e move de volta.
    ClienteRepository.mover_funil(Cliente.objects.get(pk=ana.pk), "negociacao")
    assert funil(ana) == "negociacao"

    # Uma segunda venda é apagada: recálculo roda, promoção não.
    outra = vender(empresa, usuario, ana, total="50.00", status="pendente")
    VendaService.deletar(empresa.id, outra.id)

    assert funil(ana) == "negociacao"


# ════════════════════════════════════════════════════════════
# O RASTRO
# ════════════════════════════════════════════════════════════


def test_a_mudanca_aparece_na_timeline_e_diz_que_foi_automatica(empresa, usuario):
    """
    Sem isto, o cartão amanhece noutra coluna e ninguém sabe por quê.

    O tipo é "outro", não "venda": venda deixou de ser um tipo de interação
    nesta mesma leva, e registrar o aviso como uma faria a linha ser contada
    como compra por qualquer leitura antiga que ainda olhasse para lá.
    """
    ana = cliente_em(empresa, "proposta")

    vender(empresa, usuario, ana, total="450.00")

    linha = InteracaoCliente.objects.get(cliente=ana)
    assert linha.tipo == "outro"
    assert "automaticamente" in linha.titulo
    assert "Proposta" in linha.descricao and "Fechado" in linha.descricao
    assert "450.00" in linha.descricao
    assert linha.valor is None          # não é dinheiro; é um aviso
    assert linha.empresa_id == empresa.id
