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


# ═══════════════════════════════════════════════════════════════════════════
# PAINEL ADMIN v2 — busca, filtros, métricas, CRUD, suspensão, usuários
# ═══════════════════════════════════════════════════════════════════════════

from django.utils import timezone as _tz  # noqa: E402
from datetime import timedelta  # noqa: E402

from modules.painel_admin.models import AuditLog  # noqa: E402
from modules.clientes.models import Cliente  # noqa: E402


@pytest.fixture
def usuario_empresa(db, empresa):
    """Um colaborador comum (não-staff) da empresa Alpha."""
    return CustomUser.objects.create_user(
        email="joao@alpha.com", nome="João Silva", senha="Senha@12345",
        empresa=empresa, perfil="colaborador",
    )


# ── Parte 1: busca, filtros, métricas ───────────────────────────────────────

@pytest.mark.django_db
def test_busca_por_nome_da_empresa(staff, empresa, outra_empresa):
    resp = _client(staff).get("/api/painel-admin/empresas/?busca=Alpha")
    assert resp.status_code == 200
    nomes = [e["nome"] for e in resp.json()["data"]]
    assert nomes == ["Cliente Alpha"]


@pytest.mark.django_db
def test_busca_por_email_de_usuario(staff, empresa, outra_empresa, usuario_empresa):
    # Busca pelo email de um usuário da Alpha → retorna a Alpha (não a Beta).
    resp = _client(staff).get("/api/painel-admin/empresas/?busca=joao@alpha.com")
    assert resp.status_code == 200
    ids = [e["id"] for e in resp.json()["data"]]
    assert str(empresa.id) in ids
    assert str(outra_empresa.id) not in ids


@pytest.mark.django_db
def test_filtro_por_plano(staff, empresa, outra_empresa):
    resp = _client(staff).get("/api/painel-admin/empresas/?plano=pro")
    assert resp.status_code == 200
    planos = {e["plano"] for e in resp.json()["data"]}
    assert planos == {"pro"}  # só a Beta (pro)


@pytest.mark.django_db
def test_filtro_por_status(staff, empresa, outra_empresa):
    PainelAdminService.suspender(empresa.id, "Inadimplência recorrente", staff)
    ativas = _client(staff).get("/api/painel-admin/empresas/?status=ativa").json()["data"]
    suspensas = _client(staff).get("/api/painel-admin/empresas/?status=suspensa").json()["data"]
    assert {e["id"] for e in ativas} == {str(outra_empresa.id)}
    assert {e["id"] for e in suspensas} == {str(empresa.id)}


@pytest.mark.django_db
def test_metricas_por_empresa(staff, empresa, usuario_empresa):
    CreditosService.reservar(empresa.id, "analise_financeira")  # usado hoje/mes = 2
    Cliente.objects.create(empresa=empresa, nome="Cliente Teste")
    resp = _client(staff).get("/api/painel-admin/empresas/")
    alpha = {e["id"]: e for e in resp.json()["data"]}[str(empresa.id)]
    assert alpha["total_usuarios"] == 2  # staff + joão
    assert alpha["creditos_usados_hoje"] == 2
    assert alpha["creditos_usados_mes"] == 2
    assert alpha["total_clientes"] == 1
    assert alpha["total_lancamentos"] == 0
    assert alpha["status"] == "ativa"


@pytest.mark.django_db
def test_ultimo_acesso_reflete_login(staff, empresa, usuario_empresa):
    # Simula login do joão atualizando last_login e verifica que aparece.
    from rest_framework.test import APIClient as _AC
    _AC().post("/api/auth/login/",
               {"email": "joao@alpha.com", "senha": "Senha@12345"}, format="json")
    resp = _client(staff).get(f"/api/painel-admin/empresas/{empresa.id}/")
    assert resp.json()["data"]["ultimo_acesso"] is not None


# ── Parte 2: criar empresa ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_criar_empresa_valida(staff):
    resp = _client(staff).post(
        "/api/painel-admin/empresas/",
        {
            "nome_empresa": "Impactar Cerimonial", "segmento": "eventos",
            "plano": "pro", "admin_nome": "Patrícia",
            "admin_email": "patricia@impactar.com", "admin_senha": "SenhaTemporaria@123",
        },
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["empresa"]["nome"] == "Impactar Cerimonial"
    assert data["empresa"]["plano"] == "pro"
    assert data["usuario"]["email"] == "patricia@impactar.com"
    assert data["usuario"]["perfil"] == "admin"
    # Log de criação registrado
    nova = Empresa.objects.get(nome="Impactar Cerimonial")
    assert LogAlteracaoPlano.objects.filter(empresa=nova, acao="criacao").exists()


@pytest.mark.django_db
def test_criar_empresa_email_duplicado_400(staff, comum):
    resp = _client(staff).post(
        "/api/painel-admin/empresas/",
        {
            "nome_empresa": "X", "segmento": "eventos", "plano": "pro",
            "admin_nome": "Y", "admin_email": comum.email, "admin_senha": "SenhaForte@123",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "admin_email" in resp.json()["error"]["details"]


@pytest.mark.django_db
def test_criar_empresa_senha_fraca_400(staff):
    resp = _client(staff).post(
        "/api/painel-admin/empresas/",
        {
            "nome_empresa": "X", "segmento": "eventos", "plano": "pro",
            "admin_nome": "Y", "admin_email": "novo@x.com", "admin_senha": "123",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "admin_senha" in resp.json()["error"]["details"]


@pytest.mark.django_db
def test_criar_empresa_nunca_seta_staff_synapse(staff):
    _client(staff).post(
        "/api/painel-admin/empresas/",
        {
            "nome_empresa": "Sem Staff", "segmento": "outro", "plano": "starter",
            "admin_nome": "Z", "admin_email": "z@semstaff.com",
            "admin_senha": "SenhaForte@123", "is_staff_synapse": True,  # ignorado
        },
        format="json",
    )
    admin = CustomUser.objects.get(email="z@semstaff.com")
    assert admin.is_staff_synapse is False


@pytest.mark.django_db
def test_criar_empresa_403_para_nao_staff(comum):
    resp = _client(comum).post(
        "/api/painel-admin/empresas/",
        {
            "nome_empresa": "X", "segmento": "eventos", "plano": "pro",
            "admin_nome": "Y", "admin_email": "a@b.com", "admin_senha": "SenhaForte@123",
        },
        format="json",
    )
    assert resp.status_code == 403


# ── Parte 3: suspender / reativar ───────────────────────────────────────────

@pytest.mark.django_db
def test_suspender_com_motivo(staff, empresa):
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/suspender/",
        {"motivo": "Inadimplência de 3 meses seguidos."}, format="json",
    )
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.status == "suspensa"
    assert empresa.data_suspensao is not None
    assert empresa.suspensa_por_id == staff.id
    assert LogAlteracaoPlano.objects.filter(empresa=empresa, acao="suspenso").exists()


@pytest.mark.django_db
def test_suspender_motivo_curto_400(staff, empresa):
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/suspender/",
        {"motivo": "curto"}, format="json",
    )
    assert resp.status_code == 400
    empresa.refresh_from_db()
    assert empresa.status == "ativa"


@pytest.mark.django_db
def test_reativar_restaura_acesso(staff, empresa):
    PainelAdminService.suspender(empresa.id, "Motivo suficiente aqui", staff)
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/reativar/", {}, format="json",
    )
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.status == "ativa"
    assert empresa.data_suspensao is None
    assert LogAlteracaoPlano.objects.filter(empresa=empresa, acao="reativado").exists()


@pytest.mark.django_db
def test_usuario_empresa_suspensa_ainda_loga(empresa, usuario_empresa, staff):
    # A empresa suspensa NÃO bloqueia o login (o front mostra o aviso).
    PainelAdminService.suspender(empresa.id, "Motivo suficiente aqui", staff)
    resp = APIClient().post(
        "/api/auth/login/",
        {"email": "joao@alpha.com", "senha": "Senha@12345"}, format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["usuario"]["empresa"]["status"] == "suspensa"


# ── Parte 4: hard delete com trava de 30 dias ───────────────────────────────

@pytest.mark.django_db
def test_delete_empresa_ativa_400(staff, empresa):
    resp = _client(staff).delete(f"/api/painel-admin/empresas/{empresa.id}/")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "EXCLUSAO_BLOQUEADA"
    assert Empresa.objects.filter(id=empresa.id).exists()


@pytest.mark.django_db
def test_delete_suspensa_menos_de_30_dias_400(staff, empresa):
    PainelAdminService.suspender(empresa.id, "Motivo suficiente aqui", staff)
    # Suspensa há apenas 10 dias
    Empresa.objects.filter(id=empresa.id).update(
        data_suspensao=_tz.now() - timedelta(days=10)
    )
    resp = _client(staff).delete(f"/api/painel-admin/empresas/{empresa.id}/")
    assert resp.status_code == 400
    assert Empresa.objects.filter(id=empresa.id).exists()


@pytest.mark.django_db
def test_delete_suspensa_30_dias_apaga_tudo(staff, empresa, usuario_empresa):
    # Um staff da plataforma que pertence à empresa deve sobreviver.
    staff_na_empresa = CustomUser.objects.create_user(
        email="platstaff@synapse.com", nome="Plat", senha="Senha@12345",
        empresa=empresa, perfil="admin", is_staff_synapse=True,
    )
    Cliente.objects.create(empresa=empresa, nome="Cliente a apagar")

    PainelAdminService.suspender(empresa.id, "Motivo suficiente aqui", staff)
    Empresa.objects.filter(id=empresa.id).update(
        data_suspensao=_tz.now() - timedelta(days=31)
    )
    resp = _client(staff).delete(f"/api/painel-admin/empresas/{empresa.id}/")
    assert resp.status_code == 200

    # Empresa e dados apagados
    assert not Empresa.objects.filter(id=empresa.id).exists()
    assert not Cliente.objects.filter(empresa_id=empresa.id).exists()
    # Usuário comum apagado; staff da plataforma sobrevive (empresa NULL)
    assert not CustomUser.objects.filter(id=usuario_empresa.id).exists()
    staff_na_empresa.refresh_from_db()
    assert staff_na_empresa.empresa_id is None
    # AuditLog persiste
    audit = AuditLog.objects.get(empresa_id=empresa.id)
    assert audit.empresa_nome == "Cliente Alpha"
    assert audit.acao == "empresa_excluida"
    assert audit.realizado_por_id == staff.id


# ── Parte 5: gerenciar usuários ─────────────────────────────────────────────

@pytest.mark.django_db
def test_listar_usuarios_da_empresa(staff, empresa, usuario_empresa):
    resp = _client(staff).get(f"/api/painel-admin/empresas/{empresa.id}/usuarios/")
    assert resp.status_code == 200
    emails = {u["email"] for u in resp.json()["data"]}
    assert {"staff@synapse.com", "joao@alpha.com"} <= emails


@pytest.mark.django_db
def test_editar_perfil_usuario(staff, empresa, usuario_empresa):
    resp = _client(staff).patch(
        f"/api/painel-admin/empresas/{empresa.id}/usuarios/{usuario_empresa.id}/",
        {"perfil": "gerente"}, format="json",
    )
    assert resp.status_code == 200
    usuario_empresa.refresh_from_db()
    assert usuario_empresa.perfil == "gerente"


@pytest.mark.django_db
def test_editar_usuario_staff_synapse_bloqueado(staff, empresa):
    resp = _client(staff).patch(
        f"/api/painel-admin/empresas/{empresa.id}/usuarios/{staff.id}/",
        {"perfil": "colaborador"}, format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "USUARIO_STAFF_PROTEGIDO"
    staff.refresh_from_db()
    assert staff.perfil == "admin"  # inalterado


@pytest.mark.django_db
def test_desativar_usuario(staff, empresa, usuario_empresa):
    resp = _client(staff).patch(
        f"/api/painel-admin/empresas/{empresa.id}/usuarios/{usuario_empresa.id}/",
        {"is_active": False}, format="json",
    )
    assert resp.status_code == 200
    usuario_empresa.refresh_from_db()
    assert usuario_empresa.is_active is False
    assert usuario_empresa.ativo is False


@pytest.mark.django_db
def test_redefinir_senha_retorna_nova_senha(staff, empresa, usuario_empresa):
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/usuarios/{usuario_empresa.id}/redefinir-senha/",
        {}, format="json",
    )
    assert resp.status_code == 200
    nova = resp.json()["data"]["senha_temporaria"]
    assert len(nova) >= 8
    # A nova senha realmente funciona
    usuario_empresa.refresh_from_db()
    assert usuario_empresa.check_password(nova)


@pytest.mark.django_db
def test_redefinir_senha_staff_bloqueado(staff, empresa):
    resp = _client(staff).post(
        f"/api/painel-admin/empresas/{empresa.id}/usuarios/{staff.id}/redefinir-senha/",
        {}, format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "USUARIO_STAFF_PROTEGIDO"


# ── Parte 6: editar empresa (nome/segmento) ─────────────────────────────────

@pytest.mark.django_db
def test_editar_nome_e_segmento(staff, empresa):
    resp = _client(staff).patch(
        f"/api/painel-admin/empresas/{empresa.id}/",
        {"nome": "Alpha Renomeada", "segmento": "servicos"}, format="json",
    )
    assert resp.status_code == 200
    empresa.refresh_from_db()
    assert empresa.nome == "Alpha Renomeada"
    assert empresa.segmento == "servicos"
