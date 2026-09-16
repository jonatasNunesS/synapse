"""
Synapse — Agenda: filtro de eventos por cliente.

É o que o perfil do cliente usa para mostrar os compromissos dele. O que
importa: traz só os daquele cliente, e o recorte por empresa continua de pé
mesmo quando o id pedido é de outra.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.agenda.models import Evento
from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A PorCliente", plano="starter")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B PorCliente", plano="starter")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@porcliente.com", nome="Admin A", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def client_a(usuario_a):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(usuario_a).access_token)
    return c


@pytest.fixture
def maria(db, empresa_a):
    return Cliente.objects.create(empresa=empresa_a, nome="Maria")


@pytest.fixture
def joao(db, empresa_a):
    return Cliente.objects.create(empresa=empresa_a, nome="João")


def _evento(empresa, titulo, cliente=None, daqui_horas=24):
    inicio = timezone.now() + timedelta(hours=daqui_horas)
    return Evento.objects.create(
        empresa=empresa, titulo=titulo, cliente=cliente,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )


def _titulos(resposta):
    return [e["titulo"] for e in resposta.data["data"]]


@pytest.mark.django_db
def test_traz_so_os_eventos_do_cliente_pedido(client_a, empresa_a, maria, joao):
    _evento(empresa_a, "Com a Maria", maria)
    _evento(empresa_a, "Com o João", joao)
    _evento(empresa_a, "Sem cliente")

    r = client_a.get(f"/api/agenda/?cliente={maria.id}")

    assert r.status_code == 200
    assert _titulos(r) == ["Com a Maria"]


@pytest.mark.django_db
def test_sem_o_filtro_a_lista_segue_completa(client_a, empresa_a, maria, joao):
    _evento(empresa_a, "Com a Maria", maria)
    _evento(empresa_a, "Com o João", joao)

    r = client_a.get("/api/agenda/")

    assert sorted(_titulos(r)) == ["Com a Maria", "Com o João"]


@pytest.mark.django_db
def test_cliente_de_outra_empresa_nao_devolve_nada(client_a, empresa_b):
    """O recorte por empresa vem antes do filtro: pedir o cliente do vizinho
    devolve lista vazia, nunca os eventos dele."""
    outro = Cliente.objects.create(empresa=empresa_b, nome="Cliente da B")
    _evento(empresa_b, "Segredo da B", outro)

    r = client_a.get(f"/api/agenda/?cliente={outro.id}")

    assert r.status_code == 200
    assert _titulos(r) == []


@pytest.mark.django_db
def test_cliente_invalido_nao_derruba_a_listagem(client_a, empresa_a, maria):
    """Um `?cliente=` com lixo não pode virar 500 — lista sem o filtro."""
    _evento(empresa_a, "Com a Maria", maria)

    r = client_a.get("/api/agenda/?cliente=isso-nao-e-um-uuid")

    assert r.status_code == 200
    assert _titulos(r) == ["Com a Maria"]


@pytest.mark.django_db
def test_filtro_por_cliente_combina_com_o_intervalo(client_a, empresa_a, maria):
    _evento(empresa_a, "Amanhã", maria, daqui_horas=24)
    _evento(empresa_a, "Daqui a um mês", maria, daqui_horas=24 * 30)

    inicio = timezone.now()
    fim = inicio + timedelta(days=7)
    # Params pelo dicionário, não concatenados na URL: o `+00:00` do fuso
    # vira espaço numa query string crua e o filtro cairia fora calado.
    r = client_a.get("/api/agenda/", {
        "cliente": str(maria.id),
        "inicio": inicio.isoformat(),
        "fim": fim.isoformat(),
    })

    assert _titulos(r) == ["Amanhã"]


@pytest.mark.django_db
def test_traz_passados_e_futuros_do_cliente(client_a, empresa_a, maria):
    """O perfil separa os dois no front; a API entrega os dois."""
    _evento(empresa_a, "Mês passado", maria, daqui_horas=-24 * 30)
    _evento(empresa_a, "Semana que vem", maria, daqui_horas=24 * 7)

    r = client_a.get(f"/api/agenda/?cliente={maria.id}")

    assert _titulos(r) == ["Mês passado", "Semana que vem"]


@pytest.mark.django_db
def test_modulo_agenda_desligado_bloqueia_a_rota(client_a, empresa_a, maria):
    _evento(empresa_a, "Com a Maria", maria)
    empresa_a.modulo_agenda = False
    empresa_a.save(update_fields=["modulo_agenda"])

    r = client_a.get(f"/api/agenda/?cliente={maria.id}")

    assert r.status_code == 403
