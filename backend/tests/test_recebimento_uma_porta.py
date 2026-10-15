"""
Synapse — O recebimento de uma venda fiada tem uma porta só.

A venda é dona do recebimento. Quem registra o dinheiro que entrou — a
cobrança do dia, a tela da venda, ou o Financeiro marcando o lançamento como
pago — passa pelo mesmo `VendaService.confirmar_pagamento`.

O QUE ACONTECIA SEM ISSO. O lançamento virava "pago" no Financeiro e a venda
continuava "pendente": seguia cobrando no dia previsto, não entrava em
`valor_recebido` do cliente e não promovia o funil. O mesmo dinheiro em dois
estados — quem pagou a conta continuava devendo no CRM.

DUAS PORTAS, não uma: além do endpoint `/pagar/`, `status` é campo gravável
do serializer, então um PATCH comum também leva o lançamento a "pago". As
duas reconciliam.
"""
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente
from modules.financeiro.models import Lancamento
from modules.financeiro.services import FinanceiroService
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
    return Cliente.objects.create(empresa=empresa, nome="Ana", status_funil="lead")


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def venda_fiada(empresa, usuario, cliente, total="450.00"):
    """Uma venda a prazo, já lançada no financeiro — o estado do relato."""
    venda = VendaService.criar(empresa.id, usuario.id, {
        "cliente": cliente,
        "desconto": Decimal("0"),
        "forma_pagamento": "outro",
        "status_pagamento": "pendente",
        "data_prevista_pagamento": timezone.localdate(),
        "itens": [{"produto": None, "descricao": "Serviço",
                   "quantidade": Decimal("1"), "preco_unitario": Decimal(total)}],
    })
    VendaService.lancar_financeiro(empresa.id, usuario.id, venda.id)
    venda.refresh_from_db()
    return venda


def estado(venda, cliente):
    venda.refresh_from_db()
    cliente.refresh_from_db()
    return {
        "venda": venda.status_pagamento,
        "recebido": cliente.valor_recebido,
        "a_receber": cliente.valor_a_receber,
        "funil": cliente.status_funil,
    }


# ════════════════════════════════════════════════════════════
# PELA TELA DA VENDA
# ════════════════════════════════════════════════════════════


def test_recebimento_antecipado_pela_tela(empresa, usuario, ana):
    """
    Pago antes do dia previsto, registrado na hora.

    Antes só dava para confirmar quando a notificação chegava: quem pagava
    adiantado não tinha por onde ser registrado, e a cobrança continuava
    armada para o dia.
    """
    venda = venda_fiada(empresa, usuario, ana)
    assert estado(venda, ana)["funil"] == "lead"

    resp = _client(usuario).post(
        f"/api/vendas/{venda.id}/confirmar-pagamento/", {}, format="json"
    )

    assert resp.status_code == 200, resp.data
    assert estado(venda, ana) == {
        "venda": "pago",
        "recebido": Decimal("450.00"),
        "a_receber": Decimal("0"),
        "funil": "fechado",
    }


def test_recebimento_parcial_pela_tela_deixa_saldo_com_nova_data(
    empresa, usuario, ana
):
    """Parcial não quita: a venda continua pendente pelo resto, com nova data."""
    venda = venda_fiada(empresa, usuario, ana, "500.00")
    nova_data = timezone.localdate() + timezone.timedelta(days=15)

    resp = _client(usuario).post(
        f"/api/vendas/{venda.id}/confirmar-pagamento/",
        {"valor_recebido": "200.00", "data_prevista_saldo": str(nova_data)},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    venda.refresh_from_db()
    assert venda.status_pagamento == "pendente"
    assert venda.valor_recebido == Decimal("200.00")
    assert venda.data_prevista_pagamento == nova_data
    assert venda.notificacao_enviada is False  # volta a cobrar no dia novo

    ana.refresh_from_db()
    assert ana.valor_recebido == Decimal("200.00")
    assert ana.valor_a_receber == Decimal("300.00")
    # Parcial já promove: quem pagou uma parte fechou.
    assert ana.status_funil == "fechado"


# ════════════════════════════════════════════════════════════
# PELO FINANCEIRO
# ════════════════════════════════════════════════════════════


def test_pagar_no_financeiro_resolve_a_venda(empresa, usuario, ana):
    """
    A porta principal: `POST /financeiro/lancamentos/<id>/pagar/`.

    O mesmo dinheiro deixa de ter dois estados.
    """
    venda = venda_fiada(empresa, usuario, ana)
    lancamento = venda.lancamento_financeiro
    assert lancamento.status == "pendente"

    resp = _client(usuario).post(
        f"/api/financeiro/lancamentos/{lancamento.id}/pagar/",
        {"data_pagamento": str(timezone.localdate())},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    lancamento.refresh_from_db()
    assert lancamento.status == "pago"
    assert estado(venda, ana) == {
        "venda": "pago",
        "recebido": Decimal("450.00"),
        "a_receber": Decimal("0"),
        "funil": "fechado",
    }


def test_patch_que_marca_pago_tambem_resolve_a_venda(empresa, usuario, ana):
    """
    A segunda porta, que é fácil de esquecer.

    `status` é campo gravável do serializer de lançamento — dá para marcar
    pago sem tocar no endpoint `/pagar/`. Sem reconciliar aqui, bastaria
    editar em vez de pagar para o CRM voltar a divergir do Financeiro.
    """
    venda = venda_fiada(empresa, usuario, ana)
    lancamento = venda.lancamento_financeiro

    resp = _client(usuario).patch(
        f"/api/financeiro/lancamentos/{lancamento.id}/",
        {"status": "pago", "data_pagamento": str(timezone.localdate())},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    assert estado(venda, ana) == {
        "venda": "pago",
        "recebido": Decimal("450.00"),
        "a_receber": Decimal("0"),
        "funil": "fechado",
    }


def test_lancamento_sem_venda_nao_e_afetado(empresa, usuario):
    """
    A maioria dos lançamentos não é de venda nenhuma.

    O reconciliador é silencioso: paga o lançamento e segue, sem procurar
    venda onde não há.
    """
    lancamento = Lancamento.objects.create(
        empresa=empresa, tipo="despesa", descricao="Aluguel",
        valor=Decimal("1200.00"), status="pendente",
        data_vencimento=timezone.localdate(),
    )

    resp = _client(usuario).post(
        f"/api/financeiro/lancamentos/{lancamento.id}/pagar/",
        {"data_pagamento": str(timezone.localdate())},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    lancamento.refresh_from_db()
    assert lancamento.status == "pago"


def test_venda_ja_paga_nao_e_confirmada_de_novo(empresa, usuario, ana):
    """
    Idempotência pelo lado do Financeiro.

    `confirmar_pagamento` recusa venda que não está pendente — se o
    reconciliador a chamasse de qualquer jeito, pagar o lançamento de uma
    venda já quitada devolveria erro em vez de sucesso.
    """
    venda = venda_fiada(empresa, usuario, ana)
    VendaService.confirmar_pagamento(empresa.id, usuario.id, venda.id)
    venda.refresh_from_db()
    assert venda.status_pagamento == "pago"

    # O lançamento foi junto; criamos outro, à mão, ainda apontando para ela.
    outro = Lancamento.objects.create(
        empresa=empresa, tipo="receita", descricao="Reforço",
        valor=Decimal("10.00"), status="pendente",
        data_vencimento=timezone.localdate(),
    )
    Venda.objects.filter(pk=venda.pk).update(lancamento_financeiro=outro)

    FinanceiroService.marcar_como_pago(
        empresa.id, outro.id, timezone.localdate(), usuario_id=usuario.id
    )

    outro.refresh_from_db()
    assert outro.status == "pago"
    venda.refresh_from_db()
    assert venda.status_pagamento == "pago"


def test_o_dinheiro_nao_e_contado_duas_vezes(empresa, usuario, ana):
    """
    O ajuste financeiro que `confirmar_pagamento` faz encontra o trabalho
    feito e não mexe: um só lançamento, um só valor.
    """
    venda = venda_fiada(empresa, usuario, ana)
    lancamento = venda.lancamento_financeiro

    FinanceiroService.marcar_como_pago(
        empresa.id, lancamento.id, timezone.localdate(), usuario_id=usuario.id
    )

    assert Lancamento.objects.filter(empresa=empresa, tipo="receita").count() == 1
    lancamento.refresh_from_db()
    assert lancamento.valor == Decimal("450.00")
