"""
Synapse — Testes: Busca Global (GET /api/search/)
Cobre: happy path, query curta, multi-tenant, cache, limite por categoria.
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from modules.auth.models import Empresa, CustomUser
from modules.clientes.models import Cliente


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Alpha Search", cnpj="11222333000181", plano="basico")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Beta Search", cnpj="22333444000192", plano="basico")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="search_a@alpha.com", senha="senha123",
        empresa=empresa_a, nome="Admin Alpha", perfil="admin",
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="search_b@beta.com", senha="senha123",
        empresa=empresa_b, nome="Admin Beta", perfil="admin",
    )


@pytest.fixture
def client_a(usuario_a):
    c = APIClient()
    c.force_authenticate(user=usuario_a)
    return c


@pytest.fixture
def client_b(usuario_b):
    c = APIClient()
    c.force_authenticate(user=usuario_b)
    return c


@pytest.fixture
def cliente_a(db, empresa_a):
    return Cliente.objects.create(
        empresa=empresa_a, nome="ClienteAlpha Único", tipo="pessoa_fisica", status_funil="lead"
    )


@pytest.fixture(autouse=True)
def limpar_cache():
    cache.clear()
    yield
    cache.clear()


# ─── Testes ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBuscaGlobal:
    """Testa o endpoint GET /api/search/?q=termo"""

    def test_busca_retorna_estrutura_correta(self, client_a):
        """Busca com termo válido retorna dict com 5 categorias."""
        r = client_a.get("/api/search/?q=teste")
        assert r.status_code == 200
        assert r.data["success"] is True
        data = r.data["data"]
        for cat in ("clientes", "produtos", "fornecedores", "projetos", "lancamentos"):
            assert cat in data

    def test_busca_query_muito_curta(self, client_a):
        """Query com 1 caractere deve retornar 400."""
        r = client_a.get("/api/search/?q=a")
        assert r.status_code == 400
        assert r.data["success"] is False
        assert r.data["error"]["code"] == "QUERY_TOO_SHORT"

    def test_busca_query_vazia(self, client_a):
        """Query vazia deve retornar 400."""
        r = client_a.get("/api/search/?q=")
        assert r.status_code == 400
        assert r.data["success"] is False

    def test_busca_sem_autenticacao(self):
        """Sem autenticação deve retornar 401."""
        r = APIClient().get("/api/search/?q=teste")
        assert r.status_code == 401

    def test_busca_multi_tenant(self, client_a, client_b, cliente_a):
        """Empresa B não deve ver resultados da empresa A."""
        r_a = client_a.get(f"/api/search/?q=ClienteAlpha")
        assert r_a.status_code == 200
        ids_a = [str(c["id"]) for c in r_a.data["data"]["clientes"]]
        assert str(cliente_a.id) in ids_a

        r_b = client_b.get(f"/api/search/?q=ClienteAlpha")
        assert r_b.status_code == 200
        ids_b = [str(c["id"]) for c in r_b.data["data"]["clientes"]]
        assert str(cliente_a.id) not in ids_b

    def test_busca_usa_cache(self, client_a):
        """Segunda busca com mesmo termo deve usar cache (mesmos dados)."""
        r1 = client_a.get("/api/search/?q=teste")
        r2 = client_a.get("/api/search/?q=teste")
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.data["data"] == r2.data["data"]

    def test_busca_max_3_por_categoria(self, client_a, empresa_a):
        """Deve retornar no máximo 3 resultados por categoria."""
        for i in range(5):
            Cliente.objects.create(
                empresa=empresa_a,
                nome=f"BuscaTeste{i}",
                tipo="pessoa_fisica",
                status_funil="lead",
            )
        r = client_a.get("/api/search/?q=BuscaTeste")
        assert r.status_code == 200
        assert len(r.data["data"]["clientes"]) <= 3
