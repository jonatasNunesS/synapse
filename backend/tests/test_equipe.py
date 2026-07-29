"""
Synapse — M7 Equipe: Testes Completos
Cobre: CRUD membros, metas, convite, resumo, multi-tenant, acesso negado.
"""
import uuid
from datetime import date, timedelta
from unittest.mock import patch
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from modules.auth.models import CustomUser, Empresa
from modules.equipe.models import MembroEquipe, MetaMembro
from modules.equipe.repository import EquipeRepository
from modules.equipe.services import EquipeService


@pytest.fixture
def convite_email_ok():
    """
    Simula envio de e-mail de convite bem-sucedido. Sem isso, os testes de
    sucesso falhariam: RESEND_API_KEY é vazia em testes e o envio (agora
    síncrono e atômico) levantaria ConviteEmailError, revertendo a criação.
    """
    with patch("modules.equipe.tasks.enviar_convite_email") as m:
        yield m

# ════════════════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════════════════

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(
        nome="Empresa Alpha Equipe",
        cnpj="55.111.111/0001-55",
        plano="basico",
    )

@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(
        nome="Empresa Beta Equipe",
        cnpj="66.222.222/0001-66",
        plano="basico",
    )

@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="equipe_a@alpha.com",
        nome="Admin Alpha Equipe",
        senha="Alpha@123456",
        empresa=empresa_a,
        perfil="admin",
    )

@pytest.fixture
def usuario_a2(db, empresa_a):
    return CustomUser.objects.create_user(
        email="equipe_a2@alpha.com",
        nome="Colab Alpha Equipe",
        senha="Alpha@123456",
        empresa=empresa_a,
        perfil="colaborador",
    )

@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="equipe_b@beta.com",
        nome="Admin Beta Equipe",
        senha="Beta@123456",
        empresa=empresa_b,
        perfil="admin",
    )

@pytest.fixture
def auth_client_a(usuario_a, client):
    refresh = RefreshToken.for_user(usuario_a)
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {str(refresh.access_token)}"
    return client

@pytest.fixture
def auth_client_b(usuario_b, client):
    refresh = RefreshToken.for_user(usuario_b)
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {str(refresh.access_token)}"
    return client

@pytest.fixture
def membro_a(db, usuario_a, empresa_a):
    return MembroEquipe.objects.create(
        empresa=empresa_a,
        usuario=usuario_a,
        cargo="CTO",
        departamento="Tecnologia",
    )

@pytest.fixture
def membro_a2(db, usuario_a2, empresa_a):
    return MembroEquipe.objects.create(
        empresa=empresa_a,
        usuario=usuario_a2,
        cargo="Dev",
        departamento="Tecnologia",
    )

# ════════════════════════════════════════════════════════════
# TESTES DO MODEL
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_membro_equipe_model_criacao(usuario_a, empresa_a):
    m = MembroEquipe.objects.create(
        empresa=empresa_a,
        usuario=usuario_a,
        cargo="CEO",
        departamento="Diretoria",
    )
    assert m.id is not None
    assert m.ativo is True
    assert m.nome == usuario_a.nome
    assert m.email == usuario_a.email

@pytest.mark.django_db
def test_membro_equipe_unique_constraint(usuario_a, empresa_a, membro_a):
    """Não deve permitir dois registros do mesmo usuário na mesma empresa."""
    from django.db import IntegrityError
    with pytest.raises(IntegrityError):
        MembroEquipe.objects.create(
            empresa=empresa_a,
            usuario=usuario_a,
            cargo="Duplicado",
        )

@pytest.mark.django_db
def test_meta_membro_progresso(membro_a):
    meta = MetaMembro.objects.create(
        membro=membro_a,
        empresa=membro_a.empresa,
        titulo="Meta de vendas",
        tipo="vendas",
        valor_meta=100,
        valor_atual=50,
        periodo="mensal",
        data_inicio=date.today(),
        data_fim=date.today() + timedelta(days=30),
    )
    assert meta.progresso_percentual == 50.0

# ════════════════════════════════════════════════════════════
# TESTES DO REPOSITORY
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_repository_listar(empresa_a, membro_a, membro_a2):
    membros = EquipeRepository.listar(str(empresa_a.id))
    assert membros.count() == 2

@pytest.mark.django_db
def test_repository_listar_filtro_departamento(empresa_a, membro_a, membro_a2):
    membros = EquipeRepository.listar(str(empresa_a.id), {"departamento": "Tecnologia"})
    assert membros.count() == 2

@pytest.mark.django_db
def test_repository_resumo(empresa_a, membro_a, membro_a2):
    resumo = EquipeRepository.resumo(str(empresa_a.id))
    assert resumo["total_membros"] == 2
    assert resumo["membros_ativos"] == 2

# ════════════════════════════════════════════════════════════
# TESTES DA API — MEMBROS
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_api_listar_membros(auth_client_a, membro_a):
    response = auth_client_a.get("/api/equipe/membros/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

@pytest.mark.django_db
def test_api_detalhe_membro(auth_client_a, membro_a):
    response = auth_client_a.get(f"/api/equipe/membros/{membro_a.id}/")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["id"] == str(membro_a.id)

@pytest.mark.django_db
def test_api_adicionar_membro(auth_client_a, usuario_a2, empresa_a):
    """Adicionar usuário existente da empresa como membro."""
    response = auth_client_a.post(
        "/api/equipe/membros/",
        data={"usuario_id": str(usuario_a2.id), "cargo": "Dev", "departamento": "TI"},
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True

@pytest.mark.django_db
def test_api_adicionar_membro_duplicado(auth_client_a, membro_a, usuario_a):
    """Tentar adicionar membro já existente deve retornar 400."""
    response = auth_client_a.post(
        "/api/equipe/membros/",
        data={"usuario_id": str(usuario_a.id), "cargo": "CEO"},
        content_type="application/json",
    )
    assert response.status_code == 400

@pytest.mark.django_db
def test_api_atualizar_membro(auth_client_a, membro_a):
    response = auth_client_a.patch(
        f"/api/equipe/membros/{membro_a.id}/",
        data={"cargo": "CTO Sênior"},
        content_type="application/json",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["cargo"] == "CTO Sênior"

@pytest.mark.django_db
def test_api_remover_membro(auth_client_a, membro_a):
    response = auth_client_a.delete(f"/api/equipe/membros/{membro_a.id}/")
    assert response.status_code == 204

@pytest.mark.django_db
def test_api_resumo_equipe(auth_client_a, membro_a, membro_a2):
    response = auth_client_a.get("/api/equipe/resumo/")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["total_membros"] == 2

# ════════════════════════════════════════════════════════════
# TESTES DA API — METAS
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_api_criar_meta(auth_client_a, membro_a):
    response = auth_client_a.post(
        f"/api/equipe/membros/{membro_a.id}/metas/",
        data={
            "titulo": "Meta mensal",
            "tipo": "tarefas",
            "valor_meta": "50.00",
            "valor_atual": "10.00",
            "periodo": "mensal",
            "data_inicio": str(date.today()),
            "data_fim": str(date.today() + timedelta(days=30)),
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["data"]["titulo"] == "Meta mensal"

@pytest.mark.django_db
def test_api_listar_metas(auth_client_a, membro_a):
    MetaMembro.objects.create(
        membro=membro_a,
        empresa=membro_a.empresa,
        titulo="Meta 1",
        tipo="vendas",
        valor_meta=100,
        periodo="mensal",
        data_inicio=date.today(),
        data_fim=date.today() + timedelta(days=30),
    )
    response = auth_client_a.get(f"/api/equipe/membros/{membro_a.id}/metas/")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) >= 1

@pytest.mark.django_db
def test_api_atualizar_meta(auth_client_a, membro_a):
    meta = MetaMembro.objects.create(
        membro=membro_a,
        empresa=membro_a.empresa,
        titulo="Meta X",
        tipo="vendas",
        valor_meta=100,
        periodo="mensal",
        data_inicio=date.today(),
        data_fim=date.today() + timedelta(days=30),
    )
    response = auth_client_a.patch(
        f"/api/equipe/membros/{membro_a.id}/metas/{meta.id}/",
        data={"valor_atual": "75.00"},
        content_type="application/json",
    )
    assert response.status_code == 200

@pytest.mark.django_db
def test_api_deletar_meta(auth_client_a, membro_a):
    meta = MetaMembro.objects.create(
        membro=membro_a,
        empresa=membro_a.empresa,
        titulo="Meta Y",
        tipo="outro",
        periodo="mensal",
        data_inicio=date.today(),
        data_fim=date.today() + timedelta(days=30),
    )
    response = auth_client_a.delete(f"/api/equipe/membros/{membro_a.id}/metas/{meta.id}/")
    assert response.status_code == 204

# ════════════════════════════════════════════════════════════
# TESTES MULTI-TENANT
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_multi_tenant_nao_ve_membro_de_outra_empresa(auth_client_b, membro_a):
    """Usuário B não deve ver membros da empresa A."""
    response = auth_client_b.get("/api/equipe/membros/")
    assert response.status_code == 200
    ids = [m["id"] for m in response.json()["data"]]
    assert str(membro_a.id) not in ids

@pytest.mark.django_db
def test_multi_tenant_nao_acessa_membro_de_outra_empresa(auth_client_b, membro_a):
    response = auth_client_b.get(f"/api/equipe/membros/{membro_a.id}/")
    assert response.status_code == 404

@pytest.mark.django_db
def test_api_sem_autenticacao():
    from rest_framework.test import APIClient
    client = APIClient()
    response = client.get("/api/equipe/membros/")
    assert response.status_code == 401


# ─── Testes: Convidar Membro (Item 7) ────────────────────────────────────────

@pytest.mark.django_db
def test_convidar_membro_sucesso(auth_client_a, convite_email_ok):
    """POST /equipe/convidar/ cria usuário e membro em transação atômica."""
    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "novo@empresa.com", "nome": "Novo Colaborador", "perfil": "colaborador", "cargo": "Analista", "departamento": "Vendas"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["email"] == "novo@empresa.com"
    assert data["cargo"] == "Analista"
    assert data["departamento"] == "Vendas"


@pytest.mark.django_db
def test_convidar_membro_email_duplicado(auth_client_a, usuario_a2):
    """Convidar e-mail já cadastrado na empresa deve retornar 400."""
    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": usuario_a2.email, "nome": "Duplicado", "perfil": "colaborador"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert resp.json()["success"] is False


@pytest.mark.django_db
def test_convidar_membro_perfil_invalido(auth_client_a):
    """Perfil inválido deve retornar 400."""
    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "invalido@empresa.com", "nome": "Teste", "perfil": "superadmin"},
        content_type="application/json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_convidar_membro_sem_autenticacao():
    """Sem autenticação deve retornar 401."""
    from rest_framework.test import APIClient
    c = APIClient()
    resp = c.post("/api/equipe/convidar/", {
        "email": "anonimo@empresa.com",
        "nome": "Anônimo",
        "perfil": "colaborador",
    })
    assert resp.status_code == 401


# ─── Testes: Fluxo de Primeiro Acesso (convite → definir senha) ──────────────

@pytest.mark.django_db
def test_convidado_nasce_sem_senha_utilizavel(auth_client_a, convite_email_ok):
    """O convidado não deve ter senha utilizável nem conseguir logar antes do link."""
    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "primeiro@empresa.com", "nome": "Primeiro Acesso", "perfil": "colaborador"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    convidado = CustomUser.objects.get(email="primeiro@empresa.com")
    assert convidado.has_usable_password() is False


@pytest.mark.django_db
def test_convite_gera_token_de_convite_48h(auth_client_a, convite_email_ok):
    """Convidar deve gerar um PasswordResetToken tipo=convite válido por ~48h."""
    from django.utils import timezone
    from modules.auth.models import PasswordResetToken

    auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "token@empresa.com", "nome": "Token Convite", "perfil": "colaborador"},
        content_type="application/json",
    )
    convidado = CustomUser.objects.get(email="token@empresa.com")
    token = PasswordResetToken.objects.get(usuario=convidado)
    assert token.tipo == "convite"
    assert token.valido is True
    horas = (token.expira_em - timezone.now()).total_seconds() / 3600
    assert 47 <= horas <= 48


@pytest.mark.django_db
def test_convidado_define_senha_e_loga(auth_client_a, convite_email_ok):
    """Ponta a ponta: convite → definir senha via /redefinir-senha/ → login OK."""
    from rest_framework.test import APIClient
    from modules.auth.models import PasswordResetToken

    auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "acesso@empresa.com", "nome": "Novo Acesso", "perfil": "colaborador"},
        content_type="application/json",
    )
    convidado = CustomUser.objects.get(email="acesso@empresa.com")
    token = PasswordResetToken.objects.get(usuario=convidado, tipo="convite")

    anon = APIClient()
    # Define a senha pelo mesmo endpoint do reset
    resp_def = anon.post(
        "/api/auth/redefinir-senha/",
        {"token": token.token, "nova_senha": "NovaSenha@123", "confirmar_senha": "NovaSenha@123"},
        format="json",
    )
    assert resp_def.status_code == 200

    # Agora consegue logar
    resp_login = anon.post(
        "/api/auth/login/",
        {"email": "acesso@empresa.com", "senha": "NovaSenha@123"},
        format="json",
    )
    assert resp_login.status_code == 200

    # Token de uso único
    token.refresh_from_db()
    assert token.usado is True


@pytest.mark.django_db
def test_convidado_pertence_a_empresa_certa_e_nao_ve_outra(auth_client_a, empresa_a, empresa_b, convite_email_ok):
    """Multi-tenant: convidado fica na empresa do admin, não na outra."""
    auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "tenant@empresa.com", "nome": "Tenant Check", "perfil": "colaborador"},
        content_type="application/json",
    )
    convidado = CustomUser.objects.get(email="tenant@empresa.com")
    assert convidado.empresa_id == empresa_a.id
    assert convidado.empresa_id != empresa_b.id


# ─── Testes: Integridade de estado do convite (atomicidade + reconvite) ──────

@pytest.mark.django_db
def test_convite_falha_email_nao_cria_membro_fantasma(auth_client_a):
    """
    Se o e-mail de convite não pode ser enviado, o convite INTEIRO falha (502)
    e nada é persistido — sem membro fantasma. Em testes RESEND_API_KEY é vazia,
    então o envio real levanta ConviteEmailError (sem mock aqui, de propósito).
    """
    antes_users = CustomUser.objects.count()
    antes_membros = MembroEquipe.objects.count()

    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "fantasma@empresa.com", "nome": "Fantasma", "perfil": "colaborador"},
        content_type="application/json",
    )

    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "CONVITE_EMAIL_FALHOU"
    # Rollback: nenhum usuário/membro criado
    assert CustomUser.objects.filter(email="fantasma@empresa.com").exists() is False
    assert CustomUser.objects.count() == antes_users
    assert MembroEquipe.objects.count() == antes_membros


@pytest.mark.django_db
def test_excluir_membro_libera_email_para_reconvite(auth_client_a, convite_email_ok):
    """Excluir um membro deve liberar o e-mail para um novo convite."""
    # Convida
    r1 = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "recon@empresa.com", "nome": "Recon", "perfil": "colaborador"},
        content_type="application/json",
    )
    assert r1.status_code == 201
    membro_id = r1.json()["data"]["id"]

    # Exclui
    r2 = auth_client_a.delete(f"/api/equipe/membros/{membro_id}/")
    assert r2.status_code == 204
    # Conta liberada: usuário órfão não deve permanecer
    assert CustomUser.objects.filter(email="recon@empresa.com").exists() is False

    # Reconvida o mesmo e-mail — deve funcionar, sem "já cadastrado"
    r3 = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "recon@empresa.com", "nome": "Recon 2", "perfil": "colaborador"},
        content_type="application/json",
    )
    assert r3.status_code == 201


@pytest.mark.django_db
def test_excluir_nao_apaga_a_propria_conta(auth_client_a, usuario_a, empresa_a, membro_a):
    """Remover a própria participação não deve apagar a conta do solicitante."""
    resp = auth_client_a.delete(f"/api/equipe/membros/{membro_a.id}/")
    assert resp.status_code == 204
    # O membro (vínculo) some, mas a conta do admin permanece
    assert MembroEquipe.objects.filter(id=membro_a.id).exists() is False
    assert CustomUser.objects.filter(id=usuario_a.id).exists() is True


# ─── Teste: Resumo inclui KPIs de metas (bug "undefined (0%)") ────────────────

@pytest.mark.django_db
def test_resumo_inclui_metas(auth_client_a, membro_a, empresa_a):
    """O resumo deve trazer metas_ativas/metas_atingidas e membros_inativos."""
    MetaMembro.objects.create(
        membro=membro_a, empresa=empresa_a, titulo="Meta 1",
        valor_meta=100, valor_atual=100, atingida=True,
        data_inicio=date.today(), data_fim=date.today() + timedelta(days=30),
    )
    MetaMembro.objects.create(
        membro=membro_a, empresa=empresa_a, titulo="Meta 2",
        valor_meta=100, valor_atual=10, atingida=False,
        data_inicio=date.today(), data_fim=date.today() + timedelta(days=30),
    )
    resp = auth_client_a.get("/api/equipe/resumo/")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["metas_ativas"] == 2
    assert data["metas_atingidas"] == 1
    assert "membros_inativos" in data


# ════════════════════════════════════════════════════════════
# BUG: convite com e-mail já existente → 400 claro (não 500)
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_convidar_email_de_outra_empresa_400(auth_client_a, usuario_b, convite_email_ok):
    """E-mail já cadastrado em OUTRA empresa → 400 EMAIL_OUTRA_EMPRESA (não 500)."""
    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": usuario_b.email, "nome": "De Outra", "perfil": "colaborador"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "EMAIL_OUTRA_EMPRESA"


@pytest.mark.django_db
def test_convidar_email_ja_membro_da_empresa_400(auth_client_a, usuario_a2, convite_email_ok):
    """E-mail já é membro da MESMA empresa → 400 MEMBRO_JA_NA_EQUIPE."""
    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": usuario_a2.email, "nome": "Já membro", "perfil": "colaborador"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "MEMBRO_JA_NA_EQUIPE"


@pytest.mark.django_db
def test_convidar_email_novo_201(auth_client_a, convite_email_ok):
    """E-mail livre → 201 (comportamento atual preservado)."""
    resp = auth_client_a.post(
        "/api/equipe/convidar/",
        data={"email": "novo.membro@alpha.com", "nome": "Novo", "perfil": "colaborador"},
        content_type="application/json",
    )
    assert resp.status_code == 201
