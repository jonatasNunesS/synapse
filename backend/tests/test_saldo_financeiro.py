"""
Synapse — Saldo acumulado + saldo do mês + segregação realizado/pendente.

Princípio: o filtro de mês é LENTE (afeta só o "do mês"), não CORTE — o
acumulado é sempre o histórico completo.
"""
from datetime import date
from decimal import Decimal

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Lancamento
from modules.financeiro.services import FinanceiroService


@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="A", segmento="eventos", plano="pro")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="B", segmento="eventos", plano="pro")


@pytest.fixture
def user_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@a.com", nome="A", senha="Senha@12345", empresa=empresa_a, perfil="admin"
    )


def _cli(u):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(u).access_token)
    return c


def _lanc(emp, tipo, valor, *, status, venc, pgto=None):
    return Lancamento.objects.create(
        empresa=emp, tipo=tipo, descricao=f"{tipo} {valor}", valor=Decimal(str(valor)),
        data_vencimento=venc, data_pagamento=pgto, status=status,
    )


# ── Cenário base: números conhecidos ────────────────────────────────────────

def _cenario(emp):
    """
    Julho/2026:
      recebido  = 8000 (2), a_receber = 2000 (1)
      pago      = 4800 (2), a_pagar   = 1500 (1)
      saldo mês = 8000 - 4800 = 3200
    Junho/2026 (histórico): recebido 5000, pago 500 (pagos em junho).
      acumulado: recebido = 13000, pago = 5300, saldo = 7700
    """
    jul, jun = date(2026, 7, 10), date(2026, 6, 10)
    # Julho — recebido (receita paga, data_pagamento em julho)
    _lanc(emp, "receita", 5000, status="pago", venc=jul, pgto=jul)
    _lanc(emp, "receita", 3000, status="pago", venc=jul, pgto=jul)
    # Julho — a receber (receita pendente, vencimento julho)
    _lanc(emp, "receita", 2000, status="pendente", venc=jul)
    # Julho — pago (despesa paga, data_pagamento julho)
    _lanc(emp, "despesa", 4000, status="pago", venc=jul, pgto=jul)
    _lanc(emp, "despesa", 800, status="pago", venc=jul, pgto=jul)
    # Julho — a pagar (despesa pendente, vencimento julho)
    _lanc(emp, "despesa", 1500, status="pendente", venc=jul)
    # Junho — histórico pago (entra no acumulado, não no mês de julho)
    _lanc(emp, "receita", 5000, status="pago", venc=jun, pgto=jun)
    _lanc(emp, "despesa", 500, status="pago", venc=jun, pgto=jun)


@pytest.mark.django_db
def test_oito_numeros_do_mes_e_acumulado(empresa_a):
    _cenario(empresa_a)
    s = FinanceiroService.obter_saldo(empresa_a.id, 7, 2026)

    # Acumulado (histórico, ignora o mês)
    assert s["acumulado"]["total_recebido"] == 13000.0  # 8000 (jul) + 5000 (jun)
    assert s["acumulado"]["total_pago"] == 5300.0        # 4800 (jul) + 500 (jun)
    assert s["acumulado"]["saldo"] == 7700.0

    # Do mês (julho)
    m = s["mes_atual"]
    assert m["recebido"] == {"total": 8000.0, "count": 2}
    assert m["a_receber"] == {"total": 2000.0, "count": 1}
    assert m["pago"] == {"total": 4800.0, "count": 2}
    assert m["a_pagar"] == {"total": 1500.0, "count": 1}
    assert m["saldo"] == 3200.0  # recebido - pago (só realizado)


# ── Acumulado IGNORA o filtro de mês (sempre igual) ─────────────────────────

@pytest.mark.django_db
def test_acumulado_ignora_filtro_de_mes(empresa_a):
    _cenario(empresa_a)
    jul = FinanceiroService.obter_saldo(empresa_a.id, 7, 2026)["acumulado"]
    jun = FinanceiroService.obter_saldo(empresa_a.id, 6, 2026)["acumulado"]
    dez = FinanceiroService.obter_saldo(empresa_a.id, 12, 2026)["acumulado"]
    assert jul == jun == dez  # o acumulado não muda com o mês selecionado


# ── Do mês RESPEITA o filtro ────────────────────────────────────────────────

@pytest.mark.django_db
def test_do_mes_respeita_filtro(empresa_a):
    _cenario(empresa_a)
    jul = FinanceiroService.obter_saldo(empresa_a.id, 7, 2026)["mes_atual"]
    jun = FinanceiroService.obter_saldo(empresa_a.id, 6, 2026)["mes_atual"]
    assert jul["recebido"]["total"] == 8000.0
    assert jun["recebido"]["total"] == 5000.0  # junho vê só o de junho
    assert jun["pago"]["total"] == 500.0


# ── É a data de PAGAMENTO que conta pro realizado ───────────────────────────

@pytest.mark.django_db
def test_pago_conta_pela_data_de_pagamento_nao_vencimento(empresa_a):
    """Vencimento em julho, mas pago em agosto: entra no 'recebido' de AGOSTO."""
    _lanc(empresa_a, "receita", 1000, status="pago",
          venc=date(2026, 7, 20), pgto=date(2026, 8, 3))
    jul = FinanceiroService.obter_saldo(empresa_a.id, 7, 2026)["mes_atual"]
    ago = FinanceiroService.obter_saldo(empresa_a.id, 8, 2026)["mes_atual"]
    assert jul["recebido"]["total"] == 0.0     # não aparece no mês do vencimento
    assert ago["recebido"]["total"] == 1000.0  # aparece no mês do pagamento


# ── Empresa sem lançamentos → zeros, não erro ───────────────────────────────

@pytest.mark.django_db
def test_empresa_sem_lancamentos_zeros(empresa_a):
    s = FinanceiroService.obter_saldo(empresa_a.id, 7, 2026)
    assert s["acumulado"] == {"total_recebido": 0.0, "total_pago": 0.0, "saldo": 0.0}
    assert s["mes_atual"]["saldo"] == 0.0
    assert s["mes_atual"]["recebido"] == {"total": 0.0, "count": 0}


# ── Mês futuro sem dados: zeros no mês, acumulado correto ───────────────────

@pytest.mark.django_db
def test_mes_futuro_zeros_no_mes_acumulado_ok(empresa_a):
    _cenario(empresa_a)
    s = FinanceiroService.obter_saldo(empresa_a.id, 3, 2030)  # futuro
    assert s["mes_atual"]["recebido"] == {"total": 0.0, "count": 0}
    assert s["mes_atual"]["saldo"] == 0.0
    assert s["acumulado"]["saldo"] == 7700.0  # acumulado permanece


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_multitenant_nao_vaza(empresa_a, empresa_b):
    _cenario(empresa_a)
    _lanc(empresa_b, "receita", 99999, status="pago",
          venc=date(2026, 7, 1), pgto=date(2026, 7, 1))
    s_b = FinanceiroService.obter_saldo(empresa_b.id, 7, 2026)
    assert s_b["acumulado"]["total_recebido"] == 99999.0  # só o de B
    assert s_b["mes_atual"]["pago"]["total"] == 0.0


# ── Endpoint ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_endpoint_saldo(user_a, empresa_a):
    _cenario(empresa_a)
    r = _cli(user_a).get("/api/financeiro/saldo/?mes=7&ano=2026")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["acumulado"]["saldo"] == 7700.0
    assert d["mes_atual"]["saldo"] == 3200.0


@pytest.mark.django_db
def test_endpoint_saldo_401():
    assert APIClient().get("/api/financeiro/saldo/").status_code == 401


# ── Cache invalida após criar/editar/deletar ───────────────────────────────

@pytest.mark.django_db
def test_cache_invalida_apos_mutacao(empresa_a, user_a):
    _cenario(empresa_a)
    antes = FinanceiroService.obter_saldo(empresa_a.id, 7, 2026)["acumulado"]["saldo"]
    assert antes == 7700.0

    # Cria um novo recebimento em julho via service (dispara invalidate_cache)
    FinanceiroService.criar_lancamento(
        empresa_a.id, user_a.id,
        {"tipo": "receita", "descricao": "extra", "valor": Decimal("1000"),
         "data_vencimento": date(2026, 7, 15), "data_pagamento": date(2026, 7, 15),
         "status": "pago"},
    )
    depois = FinanceiroService.obter_saldo(empresa_a.id, 7, 2026)["acumulado"]["saldo"]
    assert depois == 8700.0  # cache não serviu valor velho
