"""
Synapse — AI Hub: Testes do sistema unificado de créditos de IA.
Cobre: limites por plano, custo por operação, falha devolve, reset diário,
multi-tenant, endpoint de saldo, business ilimitado.
"""
from datetime import date
from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.ai_hub.creditos import (
    CREDITOS_PLANO,
    CUSTO_OPERACAO,
    CreditosService,
    SemCreditosError,
)


@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


def _empresa(plano):
    return Empresa.objects.create(nome=f"E {plano}", segmento="eventos", plano=plano)


def _user(empresa):
    return CustomUser.objects.create_user(
        email=f"u-{empresa.id}@x.com", nome="U", senha="Senha@12345", empresa=empresa, perfil="admin"
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


# ── Limites por plano ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_creditos_por_plano():
    assert CREDITOS_PLANO["starter"] == 4
    assert CREDITOS_PLANO["pro"] == 15
    assert CREDITOS_PLANO["business"] == 40
    assert CREDITOS_PLANO["enterprise"] is None


@pytest.mark.django_db
def test_custo_por_operacao():
    assert CUSTO_OPERACAO["conteudo"] == 1
    assert CUSTO_OPERACAO["analise_financeira"] == 2
    assert CUSTO_OPERACAO["chat"] == 2


@pytest.mark.django_db
def test_starter_tem_exatamente_4_por_dia():
    emp = _empresa("starter")
    # 4 gerações de conteúdo (1 crédito cada) → ok
    for _ in range(4):
        CreditosService.reservar(emp.id, "conteudo")
    # A 5ª estoura
    with pytest.raises(SemCreditosError):
        CreditosService.reservar(emp.id, "conteudo")
    assert CreditosService.saldo(emp.id)["restante"] == 0


@pytest.mark.django_db
def test_analise_custa_2_geracao_custa_1():
    emp = _empresa("pro")  # 15/dia
    CreditosService.reservar(emp.id, "conteudo")
    assert CreditosService.saldo(emp.id)["usado"] == 1
    CreditosService.reservar(emp.id, "analise_financeira")
    assert CreditosService.saldo(emp.id)["usado"] == 3  # 1 + 2


@pytest.mark.django_db
def test_starter_bloqueia_analise_sem_saldo():
    emp = _empresa("starter")  # 4/dia
    CreditosService.reservar(emp.id, "conteudo")  # usado=1
    CreditosService.reservar(emp.id, "analise_financeira")  # usado=3
    # Resta 1; análise custa 2 → estoura
    with pytest.raises(SemCreditosError):
        CreditosService.reservar(emp.id, "analise_financeira")
    # A reserva estourada NÃO consumiu (rollback)
    assert CreditosService.saldo(emp.id)["usado"] == 3


# ── Falha devolve ───────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_devolver_estorna_credito():
    emp = _empresa("pro")
    CreditosService.reservar(emp.id, "analise_financeira")  # usado=2
    assert CreditosService.saldo(emp.id)["usado"] == 2
    CreditosService.devolver(emp.id, "analise_financeira")
    assert CreditosService.saldo(emp.id)["usado"] == 0


@pytest.mark.django_db
def test_devolver_nunca_abaixo_de_zero():
    emp = _empresa("pro")
    CreditosService.devolver(emp.id, "conteudo")  # nada reservado
    assert CreditosService.saldo(emp.id)["usado"] == 0


# ── Reset diário (mock de data) ─────────────────────────────────────────────

@pytest.mark.django_db
def test_reset_diario_por_data_na_chave():
    emp = _empresa("starter")
    with patch.object(CreditosService, "_hoje", return_value=date(2026, 7, 5)):
        CreditosService.reservar(emp.id, "conteudo")
        CreditosService.reservar(emp.id, "conteudo")
        assert CreditosService.saldo(emp.id)["usado"] == 2
    # Vira o dia → chave nova → contador zerado
    with patch.object(CreditosService, "_hoje", return_value=date(2026, 7, 6)):
        assert CreditosService.saldo(emp.id)["usado"] == 0
        CreditosService.reservar(emp.id, "conteudo")  # não estoura
        assert CreditosService.saldo(emp.id)["usado"] == 1


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_multitenant_nao_compartilha_credito():
    a = _empresa("starter")
    b = _empresa("starter")
    CreditosService.reservar(a.id, "conteudo")
    CreditosService.reservar(a.id, "conteudo")
    assert CreditosService.saldo(a.id)["usado"] == 2
    assert CreditosService.saldo(b.id)["usado"] == 0  # B intacta


# ── Business ilimitado ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_business_ilimitado_nunca_bloqueia():
    emp = _empresa("business")  # 40/dia (tem limite)
    for _ in range(40):
        CreditosService.reservar(emp.id, "conteudo")
    with pytest.raises(SemCreditosError):
        CreditosService.reservar(emp.id, "conteudo")  # 41 estoura


@pytest.mark.django_db
def test_enterprise_ilimitado_sem_contador():
    emp = _empresa("enterprise")
    for _ in range(100):
        CreditosService.reservar(emp.id, "analise_financeira")  # nunca estoura
    saldo = CreditosService.saldo(emp.id)
    assert saldo["ilimitado"] is True
    assert saldo["restante"] is None
    assert saldo["usado"] == 0  # não conta


# ── Endpoint de saldo ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_endpoint_creditos_retorna_dados_corretos():
    emp = _empresa("pro")
    user = _user(emp)
    CreditosService.reservar(emp.id, "analise_financeira")  # usado=2
    resp = _client(user).get("/api/ai/creditos/")
    assert resp.status_code == 200
    d = resp.json()["data"]
    assert d["plano"] == "pro"
    assert d["limite"] == 15
    assert d["usado"] == 2
    assert d["restante"] == 13
    assert d["ilimitado"] is False
    assert "renova_em" in d


@pytest.mark.django_db
def test_endpoint_creditos_401_sem_auth():
    assert APIClient().get("/api/ai/creditos/").status_code == 401


# ── Reserva + devolução ponta a ponta (via task de geração) ─────────────────

class _GroqFalha:
    MODELOS = {"simples": "m", "avancado": "m"}

    def gerar(self, **kw):
        raise RuntimeError("Groq indisponível")


class _GroqOk:
    MODELOS = {"simples": "m", "avancado": "m"}

    def gerar(self, **kw):
        return "Legenda gerada com sucesso ✨"


@pytest.mark.django_db
def test_geracao_reserva_e_confirma_no_sucesso():
    """POST /gerar reserva 1 crédito; sucesso mantém o crédito gasto."""
    emp = _empresa("pro")
    user = _user(emp)
    with patch("infrastructure.ia.groq_client.GroqClient", _GroqOk), \
         patch("modules.ai_hub.services.AIHubService.montar_contexto_negocio", return_value="ctx"):
        resp = _client(user).post(
            "/api/ai/gerar/",
            {"tipo": "legenda_instagram", "parametros": {"produto": "X", "tom": "y", "quantidade": "2"}},
            format="json",
        )
    assert resp.status_code == 202
    # Celery eager → task já rodou com sucesso; crédito permanece gasto
    assert CreditosService.saldo(emp.id)["usado"] == 1


@pytest.mark.django_db
def test_geracao_falha_devolve_credito():
    """Se a IA falha, o crédito reservado é devolvido (task com status erro)."""
    emp = _empresa("pro")
    user = _user(emp)
    with patch("infrastructure.ia.groq_client.GroqClient", _GroqFalha), \
         patch("modules.ai_hub.services.AIHubService.montar_contexto_negocio", return_value="ctx"):
        resp = _client(user).post(
            "/api/ai/gerar/",
            {"tipo": "legenda_instagram", "parametros": {"produto": "X", "tom": "y", "quantidade": "2"}},
            format="json",
        )
    assert resp.status_code == 202
    task_id = resp.json()["data"]["id"]
    # A task falhou (eager, retries esgotados) → status erro e crédito devolvido
    from modules.ai_hub.models import TaskIA
    task = TaskIA.objects.get(pk=task_id)
    assert task.status == "erro"
    assert CreditosService.saldo(emp.id)["usado"] == 0  # devolvido
