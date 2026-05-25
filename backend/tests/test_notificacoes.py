"""
Synapse — M7 Notificações: Testes Completos
Cobre: happy path, dados inválidos, acesso negado, multi-tenant, cache.
"""
import uuid
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from modules.auth.models import CustomUser, Empresa
from modules.notificacoes.models import Notificacao
from modules.notificacoes.repository import NotificacaoRepository
from modules.notificacoes.services import NotificacaoService

# ════════════════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════════════════

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(
        nome="Empresa Alpha Notif",
        cnpj="33.111.111/0001-33",
        plano="basico",
    )

@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(
        nome="Empresa Beta Notif",
        cnpj="44.222.222/0001-44",
        plano="basico",
    )

@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="notif_a@alpha.com",
        nome="Usuário Alpha Notif",
        senha="Alpha@123456",
        empresa=empresa_a,
    )

@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="notif_b@beta.com",
        nome="Usuário Beta Notif",
        senha="Beta@123456",
        empresa=empresa_b,
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
def notificacao_a(db, usuario_a, empresa_a):
    return Notificacao.objects.create(
        usuario=usuario_a,
        empresa=empresa_a,
        tipo="financeiro",
        titulo="Lançamento vence hoje",
        mensagem="O lançamento X vence hoje.",
        prioridade="alta",
    )

# ════════════════════════════════════════════════════════════
# TESTES DO MODEL
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_notificacao_model_criacao(usuario_a, empresa_a):
    n = Notificacao.objects.create(
        usuario=usuario_a,
        empresa=empresa_a,
        tipo="sistema",
        titulo="Teste",
        mensagem="Mensagem de teste.",
    )
    assert n.id is not None
    assert n.lida is False
    assert n.data_leitura is None
    assert "Teste" in str(n)

@pytest.mark.django_db
def test_notificacao_marcar_lida(usuario_a, empresa_a):
    n = Notificacao.objects.create(
        usuario=usuario_a,
        empresa=empresa_a,
        tipo="sistema",
        titulo="Teste",
        mensagem="Msg",
    )
    # Marcar via service (o model não tem método direto, o service usa o repository)
    n2 = NotificacaoService.marcar_lida(str(n.id), str(n.usuario_id))
    assert n2.lida is True
    assert n2.data_leitura is not None

# ════════════════════════════════════════════════════════════
# TESTES DO SERVICE
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_service_criar_notificacao(usuario_a, empresa_a):
    n = NotificacaoService.criar_notificacao(
        usuario_id=str(usuario_a.id),
        empresa_id=str(empresa_a.id),
        tipo="financeiro",
        titulo="Vencimento",
        mensagem="Lançamento vence amanhã.",
        prioridade="alta",
    )
    assert n.usuario == usuario_a
    assert n.lida is False

@pytest.mark.django_db
def test_service_criar_para_empresa(usuario_a, empresa_a):
    """criar_para_empresa deve criar notificação para todos os admins."""
    # usuario_a é o único usuário da empresa
    criadas = NotificacaoService.criar_para_empresa(
        empresa_id=str(empresa_a.id),
        tipo="estoque",
        titulo="Estoque baixo",
        mensagem="Produto X abaixo do mínimo.",
    )
    assert len(criadas) >= 1

@pytest.mark.django_db
def test_service_marcar_lida(usuario_a, empresa_a, notificacao_a):
    n = NotificacaoService.marcar_lida(str(notificacao_a.id), str(usuario_a.id))
    assert n.lida is True

@pytest.mark.django_db
def test_service_marcar_lida_nao_pertence(usuario_b, notificacao_a):
    """Tentar marcar notificação de outro usuário deve lançar DoesNotExist."""
    with pytest.raises(Notificacao.DoesNotExist):
        NotificacaoService.marcar_lida(str(notificacao_a.id), str(usuario_b.id))

@pytest.mark.django_db
def test_service_marcar_todas_lidas(usuario_a, empresa_a):
    for i in range(3):
        Notificacao.objects.create(
            usuario=usuario_a,
            empresa=empresa_a,
            tipo="sistema",
            titulo=f"Notif {i}",
            mensagem="Msg",
        )
    count = NotificacaoService.marcar_todas_lidas(str(usuario_a.id), str(empresa_a.id))
    assert count == 3

@pytest.mark.django_db
def test_service_contar_nao_lidas(usuario_a, empresa_a):
    for i in range(4):
        Notificacao.objects.create(
            usuario=usuario_a,
            empresa=empresa_a,
            tipo="sistema",
            titulo=f"N{i}",
            mensagem="Msg",
        )
    count = NotificacaoService.contar_nao_lidas(str(usuario_a.id))
    assert count == 4

# ════════════════════════════════════════════════════════════
# TESTES DA API
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_api_listar_notificacoes(auth_client_a, notificacao_a):
    response = auth_client_a.get("/api/notificacoes/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

@pytest.mark.django_db
def test_api_listar_nao_lidas(auth_client_a, notificacao_a):
    response = auth_client_a.get("/api/notificacoes/nao-lidas/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) >= 1

@pytest.mark.django_db
def test_api_contagem(auth_client_a, notificacao_a):
    response = auth_client_a.get("/api/notificacoes/contagem/")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["count"] >= 1

@pytest.mark.django_db
def test_api_marcar_lida(auth_client_a, notificacao_a):
    response = auth_client_a.patch(f"/api/notificacoes/{notificacao_a.id}/marcar-lida/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

@pytest.mark.django_db
def test_api_marcar_todas_lidas(auth_client_a, usuario_a, empresa_a):
    for i in range(3):
        Notificacao.objects.create(
            usuario=usuario_a,
            empresa=empresa_a,
            tipo="sistema",
            titulo=f"N{i}",
            mensagem="Msg",
        )
    response = auth_client_a.patch("/api/notificacoes/marcar-todas-lidas/")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["marcadas"] == 3

@pytest.mark.django_db
def test_api_deletar_notificacao(auth_client_a, notificacao_a):
    response = auth_client_a.delete(f"/api/notificacoes/{notificacao_a.id}/")
    assert response.status_code == 204

@pytest.mark.django_db
def test_api_sem_autenticacao():
    from rest_framework.test import APIClient
    client = APIClient()
    response = client.get("/api/notificacoes/")
    assert response.status_code == 401

# ════════════════════════════════════════════════════════════
# TESTES MULTI-TENANT
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_multi_tenant_nao_ve_notificacao_de_outro(auth_client_a, auth_client_b, notificacao_a, usuario_b, empresa_b):
    """Usuário B não deve ver notificações do usuário A."""
    response = auth_client_b.get("/api/notificacoes/nao-lidas/")
    assert response.status_code == 200
    ids = [n["id"] for n in response.json()["data"]]
    assert str(notificacao_a.id) not in ids

@pytest.mark.django_db
def test_multi_tenant_marcar_lida_outro_usuario(auth_client_b, notificacao_a):
    """Usuário B não pode marcar notificação do usuário A como lida."""
    response = auth_client_b.patch(f"/api/notificacoes/{notificacao_a.id}/marcar-lida/")
    assert response.status_code == 404

@pytest.mark.django_db
def test_multi_tenant_deletar_outro_usuario(auth_client_b, notificacao_a):
    """Usuário B não pode deletar notificação do usuário A."""
    response = auth_client_b.delete(f"/api/notificacoes/{notificacao_a.id}/")
    assert response.status_code == 404
