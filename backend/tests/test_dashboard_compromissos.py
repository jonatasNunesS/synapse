"""
Synapse — Dashboard: próximos compromissos da Agenda.

O bloco existe para a agenda deixar de ser um beco sem saída. O que importa
aqui: traz o que vem, não atravessa a fronteira da empresa, e some junto com
o módulo — inclusive no backend, não só na tela.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.agenda.models import Evento
from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente
from modules.dashboard.services import DashboardService

URL = "/api/dashboard/proximos-compromissos/"


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A Compromissos", plano="starter")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B Compromissos", plano="starter")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@compromissos.com", nome="Admin A", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="b@compromissos.com", nome="Admin B", senha="Senha@12345",
        empresa=empresa_b, perfil="admin",
    )


@pytest.fixture
def client_a(usuario_a):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(usuario_a).access_token)
    return c


def _evento(empresa, *, daqui_horas=2, duracao_horas=1, **over):
    inicio = timezone.now() + timedelta(hours=daqui_horas)
    dados = {
        "empresa": empresa,
        "titulo": "Reunião com o fornecedor",
        "data_inicio": inicio,
        "data_fim": inicio + timedelta(hours=duracao_horas),
    }
    dados.update(over)
    return Evento.objects.create(**dados)


def _titulos(empresa_id, dias=7):
    return [c["titulo"] for c in
            DashboardService.obter_proximos_compromissos(empresa_id, dias)]


# ── O que vem aparece ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_traz_o_compromisso_de_hoje(empresa_a):
    _evento(empresa_a, daqui_horas=2, titulo="Daqui a pouco")

    assert _titulos(empresa_a.id) == ["Daqui a pouco"]


@pytest.mark.django_db
def test_traz_os_proximos_dias_em_ordem(empresa_a):
    _evento(empresa_a, daqui_horas=72, titulo="Depois de amanhã")
    _evento(empresa_a, daqui_horas=2, titulo="Hoje")
    _evento(empresa_a, daqui_horas=26, titulo="Amanhã")

    assert _titulos(empresa_a.id) == ["Hoje", "Amanhã", "Depois de amanhã"]


@pytest.mark.django_db
def test_nao_traz_o_que_esta_fora_da_janela(empresa_a):
    _evento(empresa_a, daqui_horas=2, titulo="Dentro")
    _evento(empresa_a, daqui_horas=24 * 20, titulo="Daqui a 20 dias")

    assert _titulos(empresa_a.id, dias=7) == ["Dentro"]


@pytest.mark.django_db
def test_nao_traz_o_que_ja_passou(empresa_a):
    _evento(empresa_a, daqui_horas=-48, titulo="Semana passada")

    assert _titulos(empresa_a.id) == []


@pytest.mark.django_db
def test_compromisso_em_andamento_continua_aparecendo(empresa_a):
    """Começou às 9h, vai até as 11h: ao meio-dia ainda está acontecendo.
    Filtrar por data_inicio faria ele sumir da tela no meio da reunião."""
    _evento(empresa_a, daqui_horas=-1, duracao_horas=3, titulo="Acontecendo agora")

    assert _titulos(empresa_a.id) == ["Acontecendo agora"]


@pytest.mark.django_db
def test_traz_o_cliente_vinculado(empresa_a):
    cliente = Cliente.objects.create(empresa=empresa_a, nome="Padaria do Zé")
    _evento(empresa_a, daqui_horas=2, cliente=cliente, local="Escritório")

    item = DashboardService.obter_proximos_compromissos(empresa_a.id)[0]

    assert item["cliente_nome"] == "Padaria do Zé"
    assert item["cliente_id"] == str(cliente.id)
    assert item["local"] == "Escritório"


@pytest.mark.django_db
def test_dias_restantes_diz_hoje_e_amanha(empresa_a):
    _evento(empresa_a, daqui_horas=2, titulo="Hoje")
    _evento(empresa_a, daqui_horas=26, titulo="Amanhã")

    itens = DashboardService.obter_proximos_compromissos(empresa_a.id)
    por_titulo = {i["titulo"]: i["dias_restantes"] for i in itens}

    assert por_titulo["Hoje"] == 0
    assert por_titulo["Amanhã"] == 1


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_vaza_compromisso_de_outra_empresa(empresa_a, empresa_b):
    _evento(empresa_a, daqui_horas=2, titulo="Da empresa A")
    _evento(empresa_b, daqui_horas=2, titulo="Da empresa B")

    assert _titulos(empresa_a.id) == ["Da empresa A"]
    assert _titulos(empresa_b.id) == ["Da empresa B"]


# ── Módulo desligado ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_modulo_agenda_desligado_nao_entrega_nada(empresa_a):
    """O widget some no front, mas o backend também não entrega: senão o dado
    vazaria por qualquer cliente de API que ignore o gating da tela."""
    _evento(empresa_a, daqui_horas=2, titulo="Não deveria aparecer")
    empresa_a.modulo_agenda = False
    empresa_a.save(update_fields=["modulo_agenda"])

    assert _titulos(empresa_a.id) == []


@pytest.mark.django_db
def test_religar_o_modulo_devolve_os_compromissos(empresa_a):
    _evento(empresa_a, daqui_horas=2, titulo="Continua lá")
    empresa_a.modulo_agenda = False
    empresa_a.save(update_fields=["modulo_agenda"])
    assert _titulos(empresa_a.id) == []

    empresa_a.modulo_agenda = True
    empresa_a.save(update_fields=["modulo_agenda"])

    # `dias` diferente para escapar do cache da chamada anterior.
    assert _titulos(empresa_a.id, dias=8) == ["Continua lá"]


# ── A rota ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_endpoint_responde_com_os_compromissos(client_a, empresa_a):
    _evento(empresa_a, daqui_horas=2, titulo="Consulta")

    r = client_a.get(URL)

    assert r.status_code == 200, r.data
    assert r.data["data"]["dias"] == 7
    assert [c["titulo"] for c in r.data["data"]["compromissos"]] == ["Consulta"]


@pytest.mark.django_db
def test_endpoint_aceita_a_janela_em_dias(client_a, empresa_a):
    _evento(empresa_a, daqui_horas=24 * 10, titulo="Daqui a 10 dias")

    assert r_titulos(client_a.get(URL)) == []
    assert r_titulos(client_a.get(f"{URL}?dias=14")) == ["Daqui a 10 dias"]


def r_titulos(resposta):
    return [c["titulo"] for c in resposta.data["data"]["compromissos"]]


@pytest.mark.django_db
def test_endpoint_recusa_janela_invalida(client_a):
    r = client_a.get(f"{URL}?dias=999")

    assert r.status_code == 400
    assert r.data["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_endpoint_exige_autenticacao():
    assert APIClient().get(URL).status_code == 401
