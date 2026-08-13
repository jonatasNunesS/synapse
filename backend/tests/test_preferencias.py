"""
Synapse — Preferências pessoais (tamanho do texto) e as duas fontes novas.

Tamanho do texto é do USUÁRIO (acessibilidade é individual); a fonte continua
sendo da EMPRESA (white-label). Os dois contratos são testados aqui.
"""
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa

URL = "/api/auth/me/preferencias/"
URL_TEMA = "/api/auth/empresa/tema/"


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Alfa", segmento="varejo")


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


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


# ── Tamanho do texto: preferência do usuário ────────────────────────────────

@pytest.mark.django_db
def test_usuario_nasce_no_tamanho_normal(colaborador):
    assert colaborador.tamanho_fonte == "normal"


@pytest.mark.django_db
def test_auth_me_traz_o_tamanho_do_texto(colaborador):
    CustomUser.objects.filter(id=colaborador.id).update(tamanho_fonte="grande")
    resp = _client(colaborador).get("/api/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["data"]["tamanho_fonte"] == "grande"


@pytest.mark.django_db
@pytest.mark.parametrize("tamanho", ["normal", "medio", "grande", "maior"])
def test_os_quatro_tamanhos_sao_aceitos(colaborador, tamanho):
    resp = _client(colaborador).patch(URL, {"tamanho_fonte": tamanho}, format="json")
    assert resp.status_code == 200
    assert resp.json()["data"]["tamanho_fonte"] == tamanho
    colaborador.refresh_from_db()
    assert colaborador.tamanho_fonte == tamanho


@pytest.mark.django_db
def test_qualquer_perfil_ajusta_o_proprio_tamanho(colaborador):
    """Não é privilégio de admin: acessibilidade é de cada um."""
    resp = _client(colaborador).patch(URL, {"tamanho_fonte": "maior"}, format="json")
    assert resp.status_code == 200
    colaborador.refresh_from_db()
    assert colaborador.tamanho_fonte == "maior"


@pytest.mark.django_db
def test_tamanho_invalido_400(colaborador):
    resp = _client(colaborador).patch(URL, {"tamanho_fonte": "gigante"}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    colaborador.refresh_from_db()
    assert colaborador.tamanho_fonte == "normal"


@pytest.mark.django_db
def test_sem_login_401():
    assert APIClient().patch(URL, {"tamanho_fonte": "medio"}, format="json").status_code == 401


@pytest.mark.django_db
def test_um_usuario_nao_mexe_na_preferencia_do_outro(admin, colaborador):
    """
    O endpoint só enxerga request.user — mandar o id do outro no corpo não
    muda nada para ele.
    """
    resp = _client(admin).patch(
        URL,
        {"tamanho_fonte": "maior", "id": str(colaborador.id), "email": colaborador.email},
        format="json",
    )
    assert resp.status_code == 200

    admin.refresh_from_db()
    colaborador.refresh_from_db()
    assert admin.tamanho_fonte == "maior"
    assert colaborador.tamanho_fonte == "normal"


@pytest.mark.django_db
def test_preferencia_nao_vaza_para_a_empresa(admin, empresa):
    """Tamanho é do usuário; o tema da empresa não é tocado."""
    _client(admin).patch(URL, {"tamanho_fonte": "grande"}, format="json")
    empresa.refresh_from_db()
    assert empresa.tema_fonte == "padrao"


@pytest.mark.django_db
def test_get_devolve_a_preferencia_atual(colaborador):
    CustomUser.objects.filter(id=colaborador.id).update(tamanho_fonte="medio")
    resp = _client(colaborador).get(URL)
    assert resp.status_code == 200
    assert resp.json()["data"] == {"tamanho_fonte": "medio", "tema_modo": "sistema"}


# ── Fontes novas: continuam sendo da empresa ────────────────────────────────

@pytest.mark.django_db
@pytest.mark.parametrize("fonte", ["padrao", "serifada", "geometrica", "plex", "figtree"])
def test_tema_fonte_aceita_as_cinco_opcoes(admin, empresa, fonte):
    resp = _client(admin).patch(URL_TEMA, {"tema_fonte": fonte}, format="json")
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.tema_fonte == fonte


@pytest.mark.django_db
def test_tema_fonte_invalido_400(admin, empresa):
    resp = _client(admin).patch(URL_TEMA, {"tema_fonte": "papyrus"}, format="json")
    assert resp.status_code == 400
    empresa.refresh_from_db()
    assert empresa.tema_fonte == "padrao"


@pytest.mark.django_db
def test_fonte_da_empresa_continua_so_para_admin(colaborador, empresa):
    resp = _client(colaborador).patch(URL_TEMA, {"tema_fonte": "plex"}, format="json")
    assert resp.status_code == 403
    empresa.refresh_from_db()
    assert empresa.tema_fonte == "padrao"


# ── Modo claro/escuro: também é do USUÁRIO ──────────────────────────────────

@pytest.mark.django_db
def test_modo_padrao_e_sistema(admin):
    """Quem nunca escolheu segue o SO — não fica preso no escuro de antes."""
    assert admin.tema_modo == "sistema"


@pytest.mark.django_db
@pytest.mark.parametrize("modo", ["claro", "escuro", "sistema"])
def test_patch_aceita_os_tres_modos(colaborador, modo):
    resp = _client(colaborador).patch(URL, {"tema_modo": modo}, format="json")
    assert resp.status_code == 200
    assert resp.json()["data"]["tema_modo"] == modo
    colaborador.refresh_from_db()
    assert colaborador.tema_modo == modo


@pytest.mark.django_db
def test_modo_invalido_400(colaborador):
    resp = _client(colaborador).patch(URL, {"tema_modo": "sepia"}, format="json")
    assert resp.status_code == 400
    colaborador.refresh_from_db()
    assert colaborador.tema_modo == "sistema"


@pytest.mark.django_db
def test_sem_token_401():
    assert APIClient().patch(URL, {"tema_modo": "claro"}, format="json").status_code == 401


@pytest.mark.django_db
def test_auth_me_devolve_o_modo(colaborador):
    colaborador.tema_modo = "claro"
    colaborador.save()
    resp = _client(colaborador).get("/api/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["data"]["tema_modo"] == "claro"


@pytest.mark.django_db
def test_um_usuario_nao_muda_o_modo_do_outro(admin, colaborador):
    """O alvo do PATCH é sempre request.user — não há como apontar para outro."""
    _client(admin).patch(URL, {"tema_modo": "claro"}, format="json")

    admin.refresh_from_db()
    colaborador.refresh_from_db()
    assert admin.tema_modo == "claro"
    assert colaborador.tema_modo == "sistema"


@pytest.mark.django_db
def test_modo_nao_vaza_para_a_empresa(colaborador, empresa):
    """Modo é pessoal; paleta e fonte é que são da empresa."""
    _client(colaborador).patch(URL, {"tema_modo": "escuro"}, format="json")
    empresa.refresh_from_db()
    assert not hasattr(empresa, "tema_modo")


@pytest.mark.django_db
def test_patch_parcial_nao_zera_a_outra_preferencia(colaborador):
    """Mandar só o modo preserva o tamanho do texto, e vice-versa."""
    _client(colaborador).patch(URL, {"tamanho_fonte": "grande"}, format="json")
    _client(colaborador).patch(URL, {"tema_modo": "claro"}, format="json")

    colaborador.refresh_from_db()
    assert colaborador.tamanho_fonte == "grande"
    assert colaborador.tema_modo == "claro"


@pytest.mark.django_db
def test_qualquer_perfil_ajusta_o_proprio_modo(admin, colaborador):
    for user in (admin, colaborador):
        resp = _client(user).patch(URL, {"tema_modo": "claro"}, format="json")
        assert resp.status_code == 200
