"""
Synapse — Suspensão de empresa aplicada no BACKEND (ALTO-02).

A suspensão é administrativa (painel Synapse) e não impede o login: o usuário
entra e o frontend exibe a tela de aviso. Estes testes cobrem a contraparte no
backend — sem ela, bastava chamar a API direto para continuar operando.

Cobre: bloqueio (403 EMPRESA_SUSPENSA) em endpoints de dados, leitura e
escrita; as exceções que precisam continuar de pé (logout e /auth/me, que
alimenta a tela de aviso); staff da plataforma operando sobre empresa
suspensa; o fluxo de reativação; e a empresa ativa seguindo intacta.
"""
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Suspensa Ltda", plano="pro")


@pytest.fixture
def empresa_ativa(db):
    return Empresa.objects.create(nome="Empresa Ativa Ltda", plano="pro")


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="dono@suspensa.com", nome="Dono", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def usuario_ativo(db, empresa_ativa):
    return CustomUser.objects.create_user(
        email="dono@ativa.com", nome="Dono Ativa", senha="Senha@12345",
        empresa=empresa_ativa, perfil="admin",
    )


@pytest.fixture
def staff(db, empresa):
    return CustomUser.objects.create_user(
        email="staff@synapse.com", nome="Staff", senha="Senha@12345",
        empresa=empresa, perfil="admin", is_staff_synapse=True,
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def _suspender(empresa):
    empresa.status = "suspensa"
    empresa.save(update_fields=["status"])


# ── Bloqueio das operações de negócio ───────────────────────────────────────

@pytest.mark.django_db
def test_empresa_suspensa_bloqueia_leitura_de_dados(usuario, empresa):
    _suspender(empresa)
    resp = _client(usuario).get("/api/financeiro/lancamentos/")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "EMPRESA_SUSPENSA"


@pytest.mark.django_db
def test_empresa_suspensa_bloqueia_escrita_de_dados(usuario, empresa):
    _suspender(empresa)
    resp = _client(usuario).post(
        "/api/clientes/", {"nome": "Cliente Novo"}, format="json"
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "EMPRESA_SUSPENSA"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url",
    [
        "/api/financeiro/lancamentos/",
        "/api/clientes/",
        "/api/dashboard/resumo/",
        "/api/notificacoes/",
    ],
)
def test_empresa_suspensa_bloqueia_todos_os_modulos_de_dados(usuario, empresa, url):
    """O bloqueio é transversal, não endpoint a endpoint."""
    _suspender(empresa)
    resp = _client(usuario).get(url)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "EMPRESA_SUSPENSA"


@pytest.mark.django_db
def test_mensagem_de_bloqueio_e_clara(usuario, empresa):
    _suspender(empresa)
    resp = _client(usuario).get("/api/financeiro/lancamentos/")
    assert "suspensa" in resp.json()["error"]["message"].lower()


# ── Exceções: o que a empresa suspensa AINDA precisa acessar ────────────────

@pytest.mark.django_db
def test_empresa_suspensa_ainda_consegue_deslogar(usuario, empresa):
    _suspender(empresa)
    resp = _client(usuario).post("/api/auth/logout/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_empresa_suspensa_ainda_ve_o_proprio_status(usuario, empresa):
    """É o que alimenta a tela de aviso do frontend — não pode ser bloqueado."""
    _suspender(empresa)
    resp = _client(usuario).get("/api/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["data"]["empresa"]["status"] == "suspensa"


@pytest.mark.django_db
def test_empresa_suspensa_ainda_consegue_logar(usuario, empresa):
    """Suspensão não é bloqueio de login — o usuário entra e vê o aviso."""
    _suspender(empresa)
    resp = APIClient().post(
        "/api/auth/login/",
        {"email": "dono@suspensa.com", "senha": "Senha@12345"},
        format="json",
    )
    assert resp.status_code == 200


# ── Staff da plataforma não é afetado ───────────────────────────────────────

@pytest.mark.django_db
def test_staff_synapse_opera_sobre_empresa_suspensa(staff, empresa):
    """Staff precisa operar justamente para suspender/reativar."""
    _suspender(empresa)
    resp = _client(staff).get("/api/painel-admin/empresas/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_staff_synapse_nao_e_bloqueado_em_endpoint_de_dados(staff, empresa):
    _suspender(empresa)
    resp = _client(staff).get("/api/financeiro/lancamentos/")
    assert resp.status_code == 200


# ── Reativação devolve o acesso ─────────────────────────────────────────────

@pytest.mark.django_db
def test_reativacao_devolve_o_acesso(usuario, empresa):
    _suspender(empresa)
    assert _client(usuario).get("/api/financeiro/lancamentos/").status_code == 403

    empresa.status = "ativa"
    empresa.save(update_fields=["status"])

    assert _client(usuario).get("/api/financeiro/lancamentos/").status_code == 200


# ── Empresa ativa segue intacta ─────────────────────────────────────────────

@pytest.mark.django_db
def test_empresa_ativa_nao_e_afetada(usuario_ativo):
    resp = _client(usuario_ativo).get("/api/financeiro/lancamentos/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_suspensao_nao_vaza_entre_empresas(usuario_ativo, empresa, usuario):
    """Suspender a empresa A não pode afetar a empresa B."""
    _suspender(empresa)
    assert _client(usuario).get("/api/financeiro/lancamentos/").status_code == 403
    assert _client(usuario_ativo).get("/api/financeiro/lancamentos/").status_code == 200


# ── Unitário da permission ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_permission_empresa_ativa_isola_o_caso_suspenso(usuario, empresa, rf):
    from shared.permissions import EmpresaAtiva

    req = rf.get("/")
    req.user = usuario
    assert EmpresaAtiva().has_permission(req, None) is True

    _suspender(empresa)
    usuario.refresh_from_db()
    assert EmpresaAtiva().has_permission(req, None) is False
