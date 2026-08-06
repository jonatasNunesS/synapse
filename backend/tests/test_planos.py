"""
Synapse — Planos da plataforma (preços e limites): testes.

Cobre: GET /api/planos/ é público e devolve os 3 planos na ordem comercial;
preço null continua null (a landing mostra "a definir"); PATCH só do staff
(403 para o resto, 401 sem login); PATCH atualiza e o público reflete.
"""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.painel_admin.models import ConfiguracaoPlano


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Cliente Alpha", segmento="varejo", plano="starter")


@pytest.fixture
def staff(db, empresa):
    return CustomUser.objects.create_user(
        email="staff@synapse.com", nome="Staff", senha="Senha@12345",
        empresa=empresa, perfil="admin", is_staff_synapse=True,
    )


@pytest.fixture
def comum(db, empresa):
    return CustomUser.objects.create_user(
        email="comum@cliente.com", nome="Comum", senha="Senha@12345",
        empresa=empresa, perfil="admin",  # admin da empresa, NÃO da plataforma
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


# ── Endpoint público ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_planos_publico_sem_autenticacao_retorna_os_tres():
    resp = APIClient().get("/api/planos/")
    assert resp.status_code == 200
    planos = resp.json()["data"]
    assert [p["plano"] for p in planos] == ["starter", "pro", "business"]


@pytest.mark.django_db
def test_planos_sem_preco_definido_vem_null():
    """Sem preço cadastrado o campo é null — o frontend mostra 'a definir'."""
    planos = APIClient().get("/api/planos/").json()["data"]
    starter = next(p for p in planos if p["plano"] == "starter")
    assert starter["preco_mensal"] is None
    assert starter["preco_anual"] is None
    assert starter["limite_usuarios"] is None
    assert starter["limite_armazenamento_gb"] is None
    assert starter["descricao_suporte"] == ""


@pytest.mark.django_db
def test_seed_criou_os_tres_planos():
    assert ConfiguracaoPlano.objects.count() == 3
    assert set(ConfiguracaoPlano.objects.values_list("plano", flat=True)) == {
        "starter", "pro", "business",
    }


@pytest.mark.django_db
def test_planos_publico_reflete_o_preco_definido():
    ConfiguracaoPlano.objects.filter(plano="pro").update(
        preco_mensal=Decimal("97.00"), preco_anual=Decimal("970.00")
    )
    planos = APIClient().get("/api/planos/").json()["data"]
    pro = next(p for p in planos if p["plano"] == "pro")
    assert Decimal(pro["preco_mensal"]) == Decimal("97.00")
    assert Decimal(pro["preco_anual"]) == Decimal("970.00")


# ── Edição pelo staff ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_staff_atualiza_preco_e_limites(staff):
    resp = _client(staff).patch(
        "/api/painel-admin/planos/starter/",
        {
            "preco_mensal": "49.90",
            "preco_anual": "499.00",
            "limite_usuarios": 3,
            "limite_armazenamento_gb": 5,
            "descricao_suporte": "WhatsApp em horário comercial",
        },
        format="json",
    )
    assert resp.status_code == 200
    config = ConfiguracaoPlano.objects.get(plano="starter")
    assert config.preco_mensal == Decimal("49.90")
    assert config.preco_anual == Decimal("499.00")
    assert config.limite_usuarios == 3
    assert config.limite_armazenamento_gb == 5
    assert config.descricao_suporte == "WhatsApp em horário comercial"


@pytest.mark.django_db
def test_staff_pode_limpar_o_preco_de_volta_para_null(staff):
    ConfiguracaoPlano.objects.filter(plano="business").update(preco_mensal=Decimal("199.00"))
    resp = _client(staff).patch(
        "/api/painel-admin/planos/business/", {"preco_mensal": None}, format="json"
    )
    assert resp.status_code == 200
    assert ConfiguracaoPlano.objects.get(plano="business").preco_mensal is None


@pytest.mark.django_db
def test_nao_staff_recebe_403(comum):
    resp = _client(comum).patch(
        "/api/painel-admin/planos/starter/", {"preco_mensal": "10.00"}, format="json"
    )
    assert resp.status_code == 403
    assert ConfiguracaoPlano.objects.get(plano="starter").preco_mensal is None


@pytest.mark.django_db
def test_sem_login_recebe_401():
    resp = APIClient().patch(
        "/api/painel-admin/planos/starter/", {"preco_mensal": "10.00"}, format="json"
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_plano_inexistente_404(staff):
    resp = _client(staff).patch(
        "/api/painel-admin/planos/enterprise/", {"preco_mensal": "10.00"}, format="json"
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_preco_negativo_400(staff):
    resp = _client(staff).patch(
        "/api/painel-admin/planos/starter/", {"preco_mensal": "-5.00"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_staff_le_o_plano_individual(staff):
    resp = _client(staff).get("/api/painel-admin/planos/pro/")
    assert resp.status_code == 200
    assert resp.json()["data"]["plano"] == "pro"
