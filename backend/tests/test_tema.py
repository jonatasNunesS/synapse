"""
Synapse — Identidade visual da empresa (white-label): testes.

Cobre: default synapse/padrao para quem já existe; /auth/me devolve a config;
PATCH só de admin (403 para o resto); paleta e fonte inválidas dão 400; e o
isolamento multi-tenant (empresa A não mexe no tema de B).
"""
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa

URL = "/api/auth/empresa/tema/"


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Alfa", segmento="varejo")


@pytest.fixture
def outra_empresa(db):
    return Empresa.objects.create(nome="Beta", segmento="moda")


@pytest.fixture
def admin(db, empresa):
    return CustomUser.objects.create_user(
        email="admin@alfa.com", nome="Admin", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def colaborador(db, empresa):
    return CustomUser.objects.create_user(
        email="colab@alfa.com", nome="Colab", senha="Senha@12345",
        empresa=empresa, perfil="colaborador",
    )


@pytest.fixture
def admin_outra(db, outra_empresa):
    return CustomUser.objects.create_user(
        email="admin@beta.com", nome="Admin Beta", senha="Senha@12345",
        empresa=outra_empresa, perfil="admin",
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


# ── Default de quem já existe ───────────────────────────────────────────────

@pytest.mark.django_db
def test_empresa_nasce_no_tema_padrao(empresa):
    assert empresa.tema_paleta == "synapse"
    assert empresa.tema_fonte == "padrao"


@pytest.mark.django_db
def test_get_devolve_a_config_atual(colaborador):
    """Todo mundo enxerga o tema — só não pode alterar."""
    resp = _client(colaborador).get(URL)
    assert resp.status_code == 200
    assert resp.json()["data"] == {"tema_paleta": "synapse", "tema_fonte": "padrao"}


@pytest.mark.django_db
def test_auth_me_traz_tema_da_empresa(admin, empresa):
    Empresa.objects.filter(id=empresa.id).update(
        tema_paleta="floresta", tema_fonte="serifada"
    )
    resp = _client(admin).get("/api/auth/me/")
    assert resp.status_code == 200
    dados = resp.json()["data"]["empresa"]
    assert dados["tema_paleta"] == "floresta"
    assert dados["tema_fonte"] == "serifada"


# ── Edição ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_troca_paleta_e_fonte(admin, empresa):
    resp = _client(admin).patch(
        URL, {"tema_paleta": "oceano", "tema_fonte": "geometrica"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == {
        "tema_paleta": "oceano",
        "tema_fonte": "geometrica",
    }
    empresa.refresh_from_db()
    assert empresa.tema_paleta == "oceano"
    assert empresa.tema_fonte == "geometrica"


@pytest.mark.django_db
def test_admin_pode_trocar_so_a_paleta(admin, empresa):
    resp = _client(admin).patch(URL, {"tema_paleta": "ambar"}, format="json")
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.tema_paleta == "ambar"
    assert empresa.tema_fonte == "padrao"


@pytest.mark.django_db
@pytest.mark.parametrize("paleta", ["synapse", "oceano", "floresta", "ambar", "grafite"])
def test_as_cinco_paletas_sao_aceitas(admin, empresa, paleta):
    resp = _client(admin).patch(URL, {"tema_paleta": paleta}, format="json")
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.tema_paleta == paleta


@pytest.mark.django_db
@pytest.mark.parametrize("fonte", ["padrao", "serifada", "geometrica"])
def test_as_tres_fontes_sao_aceitas(admin, empresa, fonte):
    resp = _client(admin).patch(URL, {"tema_fonte": fonte}, format="json")
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.tema_fonte == fonte


@pytest.mark.django_db
def test_paleta_invalida_400(admin, empresa):
    resp = _client(admin).patch(URL, {"tema_paleta": "rosa-choque"}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    empresa.refresh_from_db()
    assert empresa.tema_paleta == "synapse"


@pytest.mark.django_db
def test_fonte_invalida_400(admin, empresa):
    resp = _client(admin).patch(URL, {"tema_fonte": "comic-sans"}, format="json")
    assert resp.status_code == 400
    empresa.refresh_from_db()
    assert empresa.tema_fonte == "padrao"


# ── Permissão ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_admin_recebe_403(colaborador, empresa):
    resp = _client(colaborador).patch(URL, {"tema_paleta": "oceano"}, format="json")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"
    empresa.refresh_from_db()
    assert empresa.tema_paleta == "synapse"


@pytest.mark.django_db
def test_sem_login_401():
    assert APIClient().patch(URL, {"tema_paleta": "oceano"}, format="json").status_code == 401


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_so_muda_o_tema_da_propria_empresa(admin_outra, empresa, outra_empresa):
    resp = _client(admin_outra).patch(URL, {"tema_paleta": "grafite"}, format="json")
    assert resp.status_code == 200

    outra_empresa.refresh_from_db()
    empresa.refresh_from_db()
    assert outra_empresa.tema_paleta == "grafite"
    # A empresa do outro tenant não foi tocada.
    assert empresa.tema_paleta == "synapse"
