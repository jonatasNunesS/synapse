"""
Synapse — M7 Equipe: Testes Completos
Cobre: CRUD membros, metas, convite, resumo, multi-tenant, acesso negado.
"""
import uuid
from datetime import date, timedelta
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from modules.auth.models import CustomUser, Empresa
from modules.equipe.models import MembroEquipe, MetaMembro
from modules.equipe.repository import EquipeRepository
from modules.equipe.services import EquipeService

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
    assert response.status_code == 200

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
    assert response.status_code == 200

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
