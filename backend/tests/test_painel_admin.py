"""
Synapse — Painel Administrativo v1: testes.

Cobre: 403 sem is_staff_synapse; troca de plano gera LogAlteracaoPlano; troca
para o mesmo plano permitida (com observação); listagem paginada com
contadores; histórico em ordem cronológica reversa; comando criar_staff_synapse
idempotente; falha registra log com status de erro.
"""
from decimal import Decimal
from datetime import date
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.ai_hub.creditos import CreditosService
from modules.painel_admin.models import LogAlteracaoPlano
from modules.painel_admin.services import PainelAdminService


@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Cliente Alpha", segmento="varejo", plano="starter")


@pytest.fixture
def outra_empresa(db):
    return Empresa.objects.create(nome="Cliente Beta", segmento="moda", plano="pro")


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
        empresa=empresa, perfil="admin",  # NÃO é staff da plataforma
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


# ── 403 para quem não é staff da plataforma ─────────────────────────────────

@pytest.mark.django_db
def test_usuario_comum_403_em_todos_endpoints(comum, empresa):
    c = _client(comum)
    eid = empresa.id
    assert c.get("/api/painel-admin/empresas/").status_code == 403
    assert c.get(f"/api/painel-admin/empresas/{eid}/").status_code == 403
    assert c.get(f"/api/painel-admin/empresas/{eid}/historico/").status_code == 403
    assert c.post(
        f"/api/painel-admin/empresas/{eid}/trocar-plano/",
        {"plano_novo": "pro"}, format="json",
    ).status_code == 403


@pytest.mark.django_db
def test_nao_autenticado_401():
    assert APIClient().get("/api/painel-admin/empresas/").status_code == 401


# ── Listagem paginada com contadores ────────────────────────────────────────

@pytest.mark.django_db
def test_listagem_com_contadores(staff, empresa, outra_empresa):
    # empresa tem o staff (1 usuário); gasta 2 créditos hoje
    CreditosService.reservar(empresa.id, "analise_financeira")  # usado=2
    resp = _client(staff).get("/api/painel-admin/empresas/")
    assert resp.status_code == 200
    body = resp.json()
    assert "pagination" in body
    por_id = {e["id"]: e for e in body["data"]}
    alpha = por_id[str(empresa.id)]
    assert alpha["num_usuarios"] == 1
    assert alpha["creditos_usados_hoje"] == 2
    assert alpha["plano"] == "starter"
    # outra empresa: 0 usuários, 0 créditos
    beta = por_id[str(outra_empresa.id)]
    assert beta["num_usuarios"] == 0
    assert beta["creditos_usados_hoje"] == 0


# ── Detalhe + usuários ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_detalhe_lista_usuarios(staff, empresa):
    resp = _client(staff).get(f"/api/painel-admin/empresas/{empresa.id}/")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["nome"] == "Cliente Alpha"
    emails = [u["email"] for u in data["usuarios"]]
    assert "staff@synapse.com" in emails


@pytest.mark.django_db
def test_detalhe_empresa_inexistente_404(staff):
    import uuid
    resp = _client(staff).get(f"/api/painel-admin/empresas/{uuid.uuid4()}/")
    assert resp.status_code == 404


# ── Troca de plano registra auditoria ───────────────────────────────────────

@pytest.mark.django_db
def test_troca_plano_registra_log(staff, empresa):
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/trocar-plano/",
        {"plano_novo": "business", "observacao": "upgrade combinado"},
        format="json",
    )
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.plano == "business"

    logs = LogAlteracaoPlano.objects.filter(empresa=empresa)
    assert logs.count() == 1
    log = logs.first()
    assert log.plano_anterior == "starter"
    assert log.plano_novo == "business"
    assert log.status == "sucesso"
    assert log.observacao == "upgrade combinado"
    assert log.alterado_por_id == staff.id


@pytest.mark.django_db
def test_troca_para_mesmo_plano_permitida(staff, empresa):
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/trocar-plano/",
        {"plano_novo": "starter", "observacao": "reforço de contrato"},
        format="json",
    )
    assert resp.status_code == 200
    log = LogAlteracaoPlano.objects.get(empresa=empresa)
    assert log.plano_anterior == "starter"
    assert log.plano_novo == "starter"
    assert log.observacao == "reforço de contrato"


@pytest.mark.django_db
def test_troca_plano_invalido_400(staff, empresa):
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/trocar-plano/",
        {"plano_novo": "plano_que_nao_existe"},
        format="json",
    )
    assert resp.status_code == 400
    assert not LogAlteracaoPlano.objects.filter(empresa=empresa).exists()


# ── Falha na mutação registra log com status de erro ────────────────────────

@pytest.mark.django_db
def test_falha_troca_registra_log_erro(staff, empresa):
    with patch(
        "modules.auth.models.Empresa.save",
        side_effect=RuntimeError("db caiu"),
    ):
        # chamada direta ao service para exercitar o caminho de erro
        with pytest.raises(RuntimeError):
            PainelAdminService.trocar_plano(
                empresa_id=empresa.id, plano_novo="pro", usuario=staff,
                observacao="tentativa",
            )
    log = LogAlteracaoPlano.objects.get(empresa=empresa)
    assert log.status == "erro"
    assert "db caiu" in log.erro
    assert log.plano_novo == "pro"
    # O plano NÃO mudou (transação revertida)
    empresa.refresh_from_db()
    assert empresa.plano == "starter"


# ── Histórico em ordem cronológica reversa ──────────────────────────────────

@pytest.mark.django_db
def test_historico_ordem_reversa(staff, empresa):
    c = _client(staff)
    for plano in ("pro", "business", "enterprise"):
        c.post(
            f"/api/painel-admin/empresas/{empresa.id}/trocar-plano/",
            {"plano_novo": plano}, format="json",
        )
    resp = c.get(f"/api/painel-admin/empresas/{empresa.id}/historico/")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
    # Mais recente primeiro
    assert data[0]["plano_novo"] == "enterprise"
    assert data[-1]["plano_novo"] == "pro"


# ── Comando criar_staff_synapse é idempotente ───────────────────────────────

@pytest.mark.django_db
def test_comando_criar_staff_idempotente(comum):
    assert comum.is_staff_synapse is False

    out = StringIO()
    call_command("criar_staff_synapse", comum.email, stdout=out)
    comum.refresh_from_db()
    assert comum.is_staff_synapse is True
    assert "agora é staff" in out.getvalue()

    # Rodar de novo: idempotente, não quebra
    out2 = StringIO()
    call_command("criar_staff_synapse", comum.email, stdout=out2)
    comum.refresh_from_db()
    assert comum.is_staff_synapse is True
    assert "já é staff" in out2.getvalue()


@pytest.mark.django_db
def test_comando_email_inexistente_erro():
    from django.core.management.base import CommandError
    with pytest.raises(CommandError):
        call_command("criar_staff_synapse", "naoexiste@x.com")


# ── /auth/me expõe is_staff_synapse ─────────────────────────────────────────

@pytest.mark.django_db
def test_auth_me_expoe_is_staff_synapse(staff):
    resp = _client(staff).get("/api/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["data"]["is_staff_synapse"] is True
