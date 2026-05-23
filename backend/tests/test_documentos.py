"""
Synapse — M7 Documentos: Testes Completos
Cobre: CRUD, versionamento, filtros, multi-tenant, acesso negado.
"""
import uuid
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from modules.auth.models import CustomUser, Empresa
from modules.documentos.models import Documento, VersaoDocumento
from modules.documentos.repository import DocumentoRepository
from modules.documentos.services import DocumentoService

# ════════════════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════════════════

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(
        nome="Empresa Alpha Docs",
        cnpj="77.111.111/0001-77",
        plano="basico",
    )

@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(
        nome="Empresa Beta Docs",
        cnpj="88.222.222/0001-88",
        plano="basico",
    )

@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="docs_a@alpha.com",
        nome="Usuário Alpha Docs",
        senha="Alpha@123456",
        empresa=empresa_a,
    )

@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="docs_b@beta.com",
        nome="Usuário Beta Docs",
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
def documento_a(db, usuario_a, empresa_a):
    return Documento.objects.create(
        empresa=empresa_a,
        criado_por=usuario_a,
        titulo="Contrato de Prestação de Serviços",
        tipo="contrato",
        status="rascunho",
        tags=["juridico", "servicos"],
    )

# ════════════════════════════════════════════════════════════
# TESTES DO MODEL
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_documento_model_criacao(usuario_a, empresa_a):
    doc = Documento.objects.create(
        empresa=empresa_a,
        criado_por=usuario_a,
        titulo="Manual do Usuário",
        tipo="manual",
        status="aprovado",
    )
    assert doc.id is not None
    assert doc.total_versoes == 0
    assert doc.versao_atual is None
    assert str(doc) == "Manual do Usuário (Manual)"

@pytest.mark.django_db
def test_versao_documento_model(usuario_a, empresa_a, documento_a):
    v = VersaoDocumento.objects.create(
        documento=documento_a,
        empresa=empresa_a,
        criado_por=usuario_a,
        numero_versao=1,
        notas="Versão inicial.",
    )
    assert v.id is not None
    assert documento_a.total_versoes == 1
    assert documento_a.versao_atual == v

# ════════════════════════════════════════════════════════════
# TESTES DO REPOSITORY
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_repository_listar(empresa_a, documento_a):
    docs = DocumentoRepository.listar(str(empresa_a.id))
    assert docs.count() == 1

@pytest.mark.django_db
def test_repository_listar_filtro_tipo(empresa_a, documento_a):
    docs = DocumentoRepository.listar(str(empresa_a.id), {"tipo": "contrato"})
    assert docs.count() == 1

@pytest.mark.django_db
def test_repository_listar_filtro_busca(empresa_a, documento_a):
    docs = DocumentoRepository.listar(str(empresa_a.id), {"busca": "Prestação"})
    assert docs.count() == 1
    docs_none = DocumentoRepository.listar(str(empresa_a.id), {"busca": "XYZ_INEXISTENTE"})
    assert docs_none.count() == 0

@pytest.mark.django_db
def test_repository_criar_versao(usuario_a, empresa_a, documento_a):
    v1 = DocumentoRepository.criar_versao(
        str(documento_a.id), str(empresa_a.id), str(usuario_a.id), {"notas": "v1"}
    )
    v2 = DocumentoRepository.criar_versao(
        str(documento_a.id), str(empresa_a.id), str(usuario_a.id), {"notas": "v2"}
    )
    assert v1.numero_versao == 1
    assert v2.numero_versao == 2

# ════════════════════════════════════════════════════════════
# TESTES DA API
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_api_listar_documentos(auth_client_a, documento_a):
    response = auth_client_a.get("/api/documentos/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

@pytest.mark.django_db
def test_api_criar_documento(auth_client_a):
    response = auth_client_a.post(
        "/api/documentos/",
        data={
            "titulo": "Proposta Comercial",
            "tipo": "proposta",
            "status": "rascunho",
            "tags": ["comercial"],
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["data"]["titulo"] == "Proposta Comercial"

@pytest.mark.django_db
def test_api_detalhe_documento(auth_client_a, documento_a):
    response = auth_client_a.get(f"/api/documentos/{documento_a.id}/")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["id"] == str(documento_a.id)

@pytest.mark.django_db
def test_api_atualizar_documento(auth_client_a, documento_a):
    response = auth_client_a.patch(
        f"/api/documentos/{documento_a.id}/",
        data={"status": "aprovado"},
        content_type="application/json",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["status"] == "aprovado"

@pytest.mark.django_db
def test_api_deletar_documento(auth_client_a, documento_a):
    response = auth_client_a.delete(f"/api/documentos/{documento_a.id}/")
    assert response.status_code == 200

@pytest.mark.django_db
def test_api_criar_versao(auth_client_a, documento_a):
    response = auth_client_a.post(
        f"/api/documentos/{documento_a.id}/versoes/",
        data={"notas": "Primeira versão."},
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.json()
    assert data["data"]["numero_versao"] == 1

@pytest.mark.django_db
def test_api_listar_versoes(auth_client_a, usuario_a, empresa_a, documento_a):
    VersaoDocumento.objects.create(
        documento=documento_a,
        empresa=empresa_a,
        criado_por=usuario_a,
        numero_versao=1,
        notas="v1",
    )
    response = auth_client_a.get(f"/api/documentos/{documento_a.id}/versoes/")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1

@pytest.mark.django_db
def test_api_documento_nao_encontrado(auth_client_a):
    fake_id = uuid.uuid4()
    response = auth_client_a.get(f"/api/documentos/{fake_id}/")
    assert response.status_code == 404

@pytest.mark.django_db
def test_api_sem_autenticacao():
    from rest_framework.test import APIClient
    client = APIClient()
    response = client.get("/api/documentos/")
    assert response.status_code == 401

# ════════════════════════════════════════════════════════════
# TESTES MULTI-TENANT
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_multi_tenant_nao_ve_documento_de_outra_empresa(auth_client_b, documento_a):
    """Usuário B não deve ver documentos da empresa A."""
    response = auth_client_b.get("/api/documentos/")
    assert response.status_code == 200
    ids = [d["id"] for d in response.json()["data"]]
    assert str(documento_a.id) not in ids

@pytest.mark.django_db
def test_multi_tenant_nao_acessa_documento_de_outra_empresa(auth_client_b, documento_a):
    response = auth_client_b.get(f"/api/documentos/{documento_a.id}/")
    assert response.status_code == 404

@pytest.mark.django_db
def test_multi_tenant_nao_edita_documento_de_outra_empresa(auth_client_b, documento_a):
    response = auth_client_b.patch(
        f"/api/documentos/{documento_a.id}/",
        data={"status": "aprovado"},
        content_type="application/json",
    )
    assert response.status_code == 404

@pytest.mark.django_db
def test_multi_tenant_nao_deleta_documento_de_outra_empresa(auth_client_b, documento_a):
    response = auth_client_b.delete(f"/api/documentos/{documento_a.id}/")
    assert response.status_code == 404
