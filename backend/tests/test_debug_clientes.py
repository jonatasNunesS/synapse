import pytest
from rest_framework.test import APIClient
from modules.auth.models import Empresa, CustomUser


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Alpha", cnpj="11222333000181", plano="basico")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="admin@alpha.com",
        senha="senha123",
        empresa=empresa_a,
        nome="Admin Alpha",
        perfil="admin",
    )


@pytest.fixture
def client_a(usuario_a):
    client = APIClient()
    client.force_authenticate(user=usuario_a)
    return client


@pytest.mark.django_db
def test_debug_criar_cliente(client_a):
    resp = client_a.post("/api/clientes/", {
        "nome": "Carlos",
        "tipo": "pessoa_fisica",
        "email": "carlos@email.com",
        "status_funil": "lead",
    }, format="json")
    print("STATUS:", resp.status_code)
    print("CONTENT:", resp.content.decode())
    assert resp.status_code == 201
