"""
Synapse — Expediente da empresa (AGENDA_AUDIT, item 8).

O expediente recorta a GRADE das visões de dia e semana. O que importa aqui:
persiste, só admin muda, cada empresa tem o seu — e, acima de tudo, NÃO filtra
evento nenhum: quem marcou às 5h continua recebendo o evento da API.
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.agenda.models import Evento
from modules.auth.models import CustomUser, Empresa

URL = "/api/auth/empresa/agenda/"


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A Expediente", plano="starter")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B Expediente", plano="starter")


@pytest.fixture
def admin_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="admin@expediente.com", nome="Admin", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def membro_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="membro@expediente.com", nome="Membro", senha="Senha@12345",
        empresa=empresa_a, perfil="membro",
    )


@pytest.fixture
def admin_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="admin@expediente-b.com", nome="Admin B", senha="Senha@12345",
        empresa=empresa_b, perfil="admin",
    )


def _client(usuario):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(usuario).access_token)
    return c


# ── O padrão ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_empresa_nova_ja_vem_com_expediente_comercial(empresa_a):
    """Quem nunca configurou nada não vê 24h de grade."""
    assert empresa_a.agenda_hora_inicio == 7
    assert empresa_a.agenda_hora_fim == 20


@pytest.mark.django_db
def test_get_devolve_o_expediente(admin_a):
    r = _client(admin_a).get(URL)

    assert r.status_code == 200
    assert r.data["data"] == {"agenda_hora_inicio": 7, "agenda_hora_fim": 20}


# ── Salvar ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_muda_o_expediente(admin_a, empresa_a):
    r = _client(admin_a).patch(
        URL, {"agenda_hora_inicio": 9, "agenda_hora_fim": 18}, format="json"
    )

    assert r.status_code == 200, r.data
    empresa_a.refresh_from_db()
    assert (empresa_a.agenda_hora_inicio, empresa_a.agenda_hora_fim) == (9, 18)


@pytest.mark.django_db
def test_patch_parcial_nao_zera_o_outro_campo(admin_a, empresa_a):
    _client(admin_a).patch(URL, {"agenda_hora_inicio": 6}, format="json")

    empresa_a.refresh_from_db()
    assert empresa_a.agenda_hora_inicio == 6
    assert empresa_a.agenda_hora_fim == 20, "o fim não podia voltar ao default"


@pytest.mark.django_db
def test_membro_nao_muda_o_expediente(membro_a, empresa_a):
    """É como a empresa trabalha, não preferência individual."""
    r = _client(membro_a).patch(URL, {"agenda_hora_inicio": 3}, format="json")

    assert r.status_code == 403
    empresa_a.refresh_from_db()
    assert empresa_a.agenda_hora_inicio == 7


@pytest.mark.django_db
def test_membro_ainda_consegue_ver(membro_a):
    assert _client(membro_a).get(URL).status_code == 200


@pytest.mark.django_db
def test_nao_autenticado_401():
    assert APIClient().get(URL).status_code == 401


# ── Validação ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_expediente_invertido_e_recusado(admin_a, empresa_a):
    r = _client(admin_a).patch(
        URL, {"agenda_hora_inicio": 18, "agenda_hora_fim": 9}, format="json"
    )

    assert r.status_code == 400
    empresa_a.refresh_from_db()
    assert empresa_a.agenda_hora_inicio == 7


@pytest.mark.django_db
def test_expediente_de_duracao_zero_e_recusado(admin_a):
    r = _client(admin_a).patch(
        URL, {"agenda_hora_inicio": 9, "agenda_hora_fim": 9}, format="json"
    )

    assert r.status_code == 400


@pytest.mark.django_db
def test_hora_fora_do_dia_e_recusada(admin_a):
    """
    Olha o CAMPO que o erro aponta, não só o 400: uma hora de início acima de
    23 também cai na regra de inversão (o fim vai no máximo a 24), então o
    status sozinho passaria pelo motivo errado.
    """
    r_inicio = _client(admin_a).patch(URL, {"agenda_hora_inicio": 30}, format="json")
    assert r_inicio.status_code == 400
    assert "agenda_hora_inicio" in r_inicio.data["error"]["details"]

    r_fim = _client(admin_a).patch(URL, {"agenda_hora_fim": 25}, format="json")
    assert r_fim.status_code == 400
    assert "agenda_hora_fim" in r_fim.data["error"]["details"]


@pytest.mark.django_db
def test_patch_parcial_invertido_tambem_e_recusado(admin_a, empresa_a):
    """Mandar só o início, com o fim atual, não pode passar por cima da regra."""
    r = _client(admin_a).patch(URL, {"agenda_hora_inicio": 22}, format="json")

    assert r.status_code == 400, "22h começa depois das 20h que já estavam lá"


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_cada_empresa_tem_o_seu(admin_a, admin_b, empresa_a, empresa_b):
    _client(admin_a).patch(URL, {"agenda_hora_inicio": 6, "agenda_hora_fim": 14},
                           format="json")

    empresa_a.refresh_from_db()
    empresa_b.refresh_from_db()
    assert (empresa_a.agenda_hora_inicio, empresa_a.agenda_hora_fim) == (6, 14)
    assert (empresa_b.agenda_hora_inicio, empresa_b.agenda_hora_fim) == (7, 20)


# ── O expediente NÃO esconde evento ─────────────────────────────────────────

@pytest.mark.django_db
def test_evento_fora_do_expediente_continua_vindo_da_api(admin_a, empresa_a):
    """
    O recorte é de DESENHO, no calendário. Se a API passasse a filtrar pelo
    expediente, o compromisso das 5h sumiria do sistema — que é justamente o
    que o audit não queria.
    """
    empresa_a.agenda_hora_inicio = 9
    empresa_a.agenda_hora_fim = 18
    empresa_a.save(update_fields=["agenda_hora_inicio", "agenda_hora_fim"])

    madrugada = timezone.localtime(timezone.now() + timedelta(days=1)).replace(
        hour=5, minute=0, second=0, microsecond=0
    )
    Evento.objects.create(
        empresa=empresa_a, titulo="Entrega na madrugada",
        data_inicio=madrugada, data_fim=madrugada + timedelta(hours=1),
    )

    r = _client(admin_a).get("/api/agenda/")

    assert r.status_code == 200
    assert [e["titulo"] for e in r.data["data"]] == ["Entrega na madrugada"]


@pytest.mark.django_db
def test_expediente_viaja_no_me(admin_a, empresa_a):
    """A agenda lê o expediente do /auth/me; sem isso a grade nunca mudaria."""
    empresa_a.agenda_hora_inicio = 8
    empresa_a.agenda_hora_fim = 17
    empresa_a.save(update_fields=["agenda_hora_inicio", "agenda_hora_fim"])

    r = _client(admin_a).get("/api/auth/me/")

    assert r.status_code == 200
    assert r.data["data"]["empresa"]["agenda_hora_inicio"] == 8
    assert r.data["data"]["empresa"]["agenda_hora_fim"] == 17
