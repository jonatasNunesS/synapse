"""
Synapse — Agenda v1: Testes
Cobre: CRUD, vínculo com cliente (com/sem), multi-tenant, listagem por
intervalo, acesso não autenticado.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.agenda.models import Evento
from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A Agenda", plano="starter")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B Agenda", plano="starter")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@agenda.com", nome="Admin A", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="b@agenda.com", nome="Admin B", senha="Senha@12345",
        empresa=empresa_b, perfil="admin",
    )


@pytest.fixture
def cliente_a(db, empresa_a):
    return Cliente.objects.create(empresa=empresa_a, nome="Cliente Casamento A")


@pytest.fixture
def cliente_b(db, empresa_b):
    return Cliente.objects.create(empresa=empresa_b, nome="Cliente B")


def _client(usuario):
    c = APIClient()
    refresh = RefreshToken.for_user(usuario)
    c.cookies["access_token"] = str(refresh.access_token)
    return c


@pytest.fixture
def client_a(usuario_a):
    return _client(usuario_a)


@pytest.fixture
def client_b(usuario_b):
    return _client(usuario_b)


def _payload(**over):
    inicio = timezone.now().replace(microsecond=0)
    dados = {
        "titulo": "Reunião de cerimonial",
        "descricao": "Alinhamento com noivos",
        "data_inicio": inicio.isoformat(),
        "data_fim": (inicio + timedelta(hours=2)).isoformat(),
        "dia_inteiro": False,
        "local": "Escritório",
        "cor": "#6D28D9",
    }
    dados.update(over)
    return dados


# ── CRUD ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_criar_evento(client_a):
    resp = client_a.post("/api/agenda/", _payload(), format="json")
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["titulo"] == "Reunião de cerimonial"
    assert data["cliente"] is None
    assert Evento.objects.count() == 1


@pytest.mark.django_db
def test_obter_evento(client_a, empresa_a, usuario_a):
    ev = Evento.objects.create(
        empresa=empresa_a, criado_por=usuario_a, titulo="X",
        data_inicio=timezone.now(), data_fim=timezone.now() + timedelta(hours=1),
    )
    resp = client_a.get(f"/api/agenda/{ev.id}/")
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == str(ev.id)


@pytest.mark.django_db
def test_atualizar_evento(client_a, empresa_a, usuario_a):
    ev = Evento.objects.create(
        empresa=empresa_a, criado_por=usuario_a, titulo="Antigo",
        data_inicio=timezone.now(), data_fim=timezone.now() + timedelta(hours=1),
    )
    resp = client_a.patch(f"/api/agenda/{ev.id}/", {"titulo": "Novo"}, format="json")
    assert resp.status_code == 200
    ev.refresh_from_db()
    assert ev.titulo == "Novo"


@pytest.mark.django_db
def test_excluir_evento(client_a, empresa_a, usuario_a):
    ev = Evento.objects.create(
        empresa=empresa_a, criado_por=usuario_a, titulo="Del",
        data_inicio=timezone.now(), data_fim=timezone.now() + timedelta(hours=1),
    )
    resp = client_a.delete(f"/api/agenda/{ev.id}/")
    assert resp.status_code == 204
    assert Evento.objects.filter(id=ev.id).exists() is False


@pytest.mark.django_db
def test_data_fim_antes_de_inicio_invalido(client_a):
    inicio = timezone.now().replace(microsecond=0)
    resp = client_a.post(
        "/api/agenda/",
        _payload(data_inicio=inicio.isoformat(), data_fim=(inicio - timedelta(hours=1)).isoformat()),
        format="json",
    )
    assert resp.status_code == 400


# ── Vínculo com cliente ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_criar_evento_com_cliente(client_a, cliente_a):
    resp = client_a.post("/api/agenda/", _payload(cliente=str(cliente_a.id)), format="json")
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["cliente"] == str(cliente_a.id)
    assert data["cliente_nome"] == "Cliente Casamento A"


@pytest.mark.django_db
def test_criar_evento_sem_cliente(client_a):
    resp = client_a.post("/api/agenda/", _payload(), format="json")
    assert resp.status_code == 201
    assert resp.json()["data"]["cliente"] is None


@pytest.mark.django_db
def test_nao_vincula_cliente_de_outra_empresa(client_a, cliente_b):
    """Vincular cliente de outra empresa deve ser rejeitado (400)."""
    resp = client_a.post("/api/agenda/", _payload(cliente=str(cliente_b.id)), format="json")
    assert resp.status_code == 400


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_multitenant_lista_nao_vaza(client_a, client_b, empresa_a, empresa_b, usuario_a, usuario_b):
    Evento.objects.create(
        empresa=empresa_a, criado_por=usuario_a, titulo="Evento A",
        data_inicio=timezone.now(), data_fim=timezone.now() + timedelta(hours=1),
    )
    Evento.objects.create(
        empresa=empresa_b, criado_por=usuario_b, titulo="Evento B",
        data_inicio=timezone.now(), data_fim=timezone.now() + timedelta(hours=1),
    )
    resp = client_b.get("/api/agenda/")
    assert resp.status_code == 200
    titulos = [e["titulo"] for e in resp.json()["data"]]
    assert "Evento B" in titulos
    assert "Evento A" not in titulos


@pytest.mark.django_db
def test_multitenant_nao_acessa_evento_de_outro(client_b, empresa_a, usuario_a):
    ev = Evento.objects.create(
        empresa=empresa_a, criado_por=usuario_a, titulo="Privado A",
        data_inicio=timezone.now(), data_fim=timezone.now() + timedelta(hours=1),
    )
    assert client_b.get(f"/api/agenda/{ev.id}/").status_code == 404
    assert client_b.delete(f"/api/agenda/{ev.id}/").status_code == 404


# ── Listagem por intervalo ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_listagem_por_intervalo(client_a, empresa_a, usuario_a):
    base = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0)
    # Evento dentro da janela (hoje)
    Evento.objects.create(
        empresa=empresa_a, criado_por=usuario_a, titulo="Dentro",
        data_inicio=base, data_fim=base + timedelta(hours=1),
    )
    # Evento fora da janela (daqui a 40 dias)
    Evento.objects.create(
        empresa=empresa_a, criado_por=usuario_a, titulo="Fora",
        data_inicio=base + timedelta(days=40), data_fim=base + timedelta(days=40, hours=1),
    )
    # Passa via dict para o client encodar o '+' do offset de timezone
    resp = client_a.get("/api/agenda/", {
        "inicio": (base - timedelta(days=2)).isoformat(),
        "fim": (base + timedelta(days=2)).isoformat(),
    })
    assert resp.status_code == 200
    titulos = [e["titulo"] for e in resp.json()["data"]]
    assert "Dentro" in titulos
    assert "Fora" not in titulos


@pytest.mark.django_db
def test_listagem_paginada(client_a):
    """A resposta de listagem deve trazer paginação."""
    resp = client_a.get("/api/agenda/")
    assert resp.status_code == 200
    body = resp.json()
    assert "pagination" in body


# ── Acesso não autenticado ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_autenticado_401():
    c = APIClient()
    assert c.get("/api/agenda/").status_code == 401
    assert c.post("/api/agenda/", _payload(), format="json").status_code == 401
