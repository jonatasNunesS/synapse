"""
Synapse — Agenda: "dia inteiro" que não mente mais (AG-03).

Antes, marcar dia inteiro deixava os campos de hora intactos: dava para gravar
"dia inteiro das 14h às 15h", e a tela escondia a hora depois. A normalização
mora no save do modelo porque o evento nasce por mais de um caminho.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.agenda.models import Evento
from modules.agenda.services import AgendaService
from modules.auth.models import CustomUser, Empresa


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A DiaInteiro", plano="starter")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@diainteiro.com", nome="Admin A", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def client_a(usuario_a):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(usuario_a).access_token)
    return c


def _as_14h(dias=1):
    """Um horário cravado às 14h no fuso da empresa."""
    base = timezone.localtime(timezone.now()) + timedelta(days=dias)
    return base.replace(hour=14, minute=0, second=0, microsecond=0)


def _local(dt):
    return timezone.localtime(dt)


# ── A normalização ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_dia_inteiro_vira_o_dia_todo(empresa_a):
    inicio = _as_14h()
    evento = Evento.objects.create(
        empresa=empresa_a, titulo="Feira", dia_inteiro=True,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )
    evento.refresh_from_db()

    assert (_local(evento.data_inicio).hour, _local(evento.data_inicio).minute) == (0, 0)
    assert (_local(evento.data_fim).hour, _local(evento.data_fim).minute) == (23, 59)


@pytest.mark.django_db
def test_dia_inteiro_nao_muda_o_dia(empresa_a):
    """Normalizar a hora não pode empurrar o evento para outro dia."""
    inicio = _as_14h(dias=3)
    evento = Evento.objects.create(
        empresa=empresa_a, titulo="Feira", dia_inteiro=True,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )
    evento.refresh_from_db()

    assert _local(evento.data_inicio).date() == inicio.date()
    assert _local(evento.data_fim).date() == inicio.date()


@pytest.mark.django_db
def test_dia_inteiro_de_varios_dias_pega_as_duas_pontas(empresa_a):
    inicio = _as_14h(dias=1)
    fim = inicio + timedelta(days=2)
    evento = Evento.objects.create(
        empresa=empresa_a, titulo="Viagem", dia_inteiro=True,
        data_inicio=inicio, data_fim=fim,
    )
    evento.refresh_from_db()

    assert _local(evento.data_inicio).hour == 0
    assert _local(evento.data_inicio).date() == inicio.date()
    assert _local(evento.data_fim).hour == 23
    assert _local(evento.data_fim).date() == fim.date()


@pytest.mark.django_db
def test_evento_com_hora_nao_e_tocado(empresa_a):
    """Quem NÃO é dia inteiro mantém a hora exata que a pessoa escolheu."""
    inicio = _as_14h()
    evento = Evento.objects.create(
        empresa=empresa_a, titulo="Reunião", dia_inteiro=False,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )
    evento.refresh_from_db()

    assert _local(evento.data_inicio).hour == 14
    assert _local(evento.data_fim).hour == 15


# ── Pelos outros caminhos ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_normaliza_pela_api(client_a):
    inicio = _as_14h()

    r = client_a.post("/api/agenda/", {
        "titulo": "Feira",
        "dia_inteiro": True,
        "data_inicio": inicio.isoformat(),
        "data_fim": (inicio + timedelta(hours=1)).isoformat(),
    }, format="json")

    assert r.status_code == 201, r.data
    evento = Evento.objects.get(id=r.data["data"]["id"])
    assert _local(evento.data_inicio).hour == 0
    assert _local(evento.data_fim).hour == 23


@pytest.mark.django_db
def test_marcar_dia_inteiro_depois_tambem_normaliza(empresa_a):
    """Criou com hora e só depois marcou dia inteiro: a hora some agora."""
    inicio = _as_14h()
    evento = Evento.objects.create(
        empresa=empresa_a, titulo="Feira", dia_inteiro=False,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )

    AgendaService.atualizar_evento(empresa_a.id, evento.id, {"dia_inteiro": True})

    evento.refresh_from_db()
    assert _local(evento.data_inicio).hour == 0
    assert _local(evento.data_fim).hour == 23


@pytest.mark.django_db
def test_desmarcar_dia_inteiro_deixa_a_hora_editavel(empresa_a):
    """Desmarcar não inventa hora: fica o 00:00–23:59 que estava guardado, e a
    pessoa escolhe outra se quiser."""
    inicio = _as_14h()
    evento = Evento.objects.create(
        empresa=empresa_a, titulo="Feira", dia_inteiro=True,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )

    AgendaService.atualizar_evento(empresa_a.id, evento.id, {"dia_inteiro": False})

    evento.refresh_from_db()
    assert evento.dia_inteiro is False
    assert _local(evento.data_inicio).hour == 0


# ── A validação não pode brigar com a hora escondida ────────────────────────

@pytest.mark.django_db
def test_dia_inteiro_de_um_dia_so_perto_da_meia_noite(client_a):
    """
    O formulário esconde a hora no dia inteiro, então ela fica sendo o que
    estava lá. Criado às 23h, o evento chega com início 23:xx e fim 00:xx do
    MESMO dia — horas invertidas que ninguém escolheu e que a tela não mostra.
    Comparar por data é o que impede a recusa de um evento perfeitamente válido.
    """
    dia = (timezone.localtime(timezone.now()) + timedelta(days=1)).replace(
        hour=23, minute=30, second=0, microsecond=0
    )
    fim_invertido = dia.replace(hour=0, minute=30)

    r = client_a.post("/api/agenda/", {
        "titulo": "Feira",
        "dia_inteiro": True,
        "data_inicio": dia.isoformat(),
        "data_fim": fim_invertido.isoformat(),
    }, format="json")

    assert r.status_code == 201, r.data
    evento = Evento.objects.get(id=r.data["data"]["id"])
    assert _local(evento.data_inicio).hour == 0
    assert _local(evento.data_fim).hour == 23


@pytest.mark.django_db
def test_dia_inteiro_com_termino_em_dia_anterior_continua_recusado(client_a):
    """A guarda não pode sumir: término num dia ANTERIOR segue erro."""
    dia = (timezone.localtime(timezone.now()) + timedelta(days=5)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )

    r = client_a.post("/api/agenda/", {
        "titulo": "Viagem impossível",
        "dia_inteiro": True,
        "data_inicio": dia.isoformat(),
        "data_fim": (dia - timedelta(days=2)).isoformat(),
    }, format="json")

    assert r.status_code == 400


@pytest.mark.django_db
def test_evento_com_hora_segue_com_a_regra_estrita(client_a):
    """Sem dia inteiro, a hora importa: 15h → 14h continua sendo erro."""
    dia = (timezone.localtime(timezone.now()) + timedelta(days=1)).replace(
        hour=15, minute=0, second=0, microsecond=0
    )

    r = client_a.post("/api/agenda/", {
        "titulo": "Reunião ao contrário",
        "dia_inteiro": False,
        "data_inicio": dia.isoformat(),
        "data_fim": dia.replace(hour=14).isoformat(),
    }, format="json")

    assert r.status_code == 400


# ── A migração dos antigos ──────────────────────────────────────────────────

def _forcar_hora_torta(evento, inicio):
    """Grava direto no banco, driblando o save() — é assim que os eventos
    antigos ficaram, antes da normalização existir."""
    Evento.objects.filter(pk=evento.pk).update(
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1)
    )


def _rodar_migracao():
    """
    Chama a função da migração de dados sobre o banco de teste.

    Ela recebe o registro de models congelado quando roda de verdade; aqui o
    registro real serve, porque só usa `get_model` e os campos de data.
    """
    import importlib

    from django.apps import apps as registro

    migracao = importlib.import_module(
        "modules.agenda.migrations.0003_normaliza_dia_inteiro"
    )
    migracao.normalizar(registro, None)


@pytest.mark.django_db
def test_migracao_conserta_os_dia_inteiro_antigos(empresa_a):
    inicio = _as_14h()
    torto = Evento.objects.create(
        empresa=empresa_a, titulo="Feira antiga", dia_inteiro=True,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )
    _forcar_hora_torta(torto, inicio)
    torto.refresh_from_db()
    assert _local(torto.data_inicio).hour == 14, "cenário: o evento está torto"

    _rodar_migracao()

    torto.refresh_from_db()
    assert _local(torto.data_inicio).hour == 0
    assert _local(torto.data_fim).hour == 23
    assert _local(torto.data_inicio).date() == inicio.date()


@pytest.mark.django_db
def test_migracao_nao_toca_em_quem_tem_hora_de_verdade(empresa_a):
    inicio = _as_14h()
    comum = Evento.objects.create(
        empresa=empresa_a, titulo="Reunião", dia_inteiro=False,
        data_inicio=inicio, data_fim=inicio + timedelta(hours=1),
    )

    _rodar_migracao()

    comum.refresh_from_db()
    assert _local(comum.data_inicio).hour == 14
    assert _local(comum.data_fim).hour == 15


@pytest.mark.django_db
def test_followup_do_crm_nao_e_dia_inteiro(empresa_a, usuario_a):
    """O evento de follow-up nasce às 9h e continua com hora — a normalização
    não pode atropelar quem não pediu dia inteiro."""
    from modules.clientes.models import Cliente
    from modules.clientes.services import ClienteService

    amanha = (timezone.localtime(timezone.now()) + timedelta(days=1)).date()
    cliente = Cliente.objects.create(
        empresa=empresa_a, nome="Maria", proximo_followup=amanha
    )

    evento, _ = ClienteService.criar_evento_followup(
        empresa_a.id, usuario_a.id, cliente.id
    )

    assert evento.dia_inteiro is False
    assert _local(evento.data_inicio).hour == 9
