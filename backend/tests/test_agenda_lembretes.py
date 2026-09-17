"""
Synapse — Agenda: testes do lembrete.

O que importa aqui: o aviso sai na hora certa, sai UMA vez só, não sai para
quem não pediu, e não atravessa a fronteira da empresa.
"""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from modules.agenda.models import SEM_LEMBRETE, Evento
from modules.agenda.services import AgendaService
from modules.agenda.tasks import enviar_lembretes
from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente
from modules.notificacoes.models import Notificacao


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Empresa A Lembrete", plano="starter")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Empresa B Lembrete", plano="starter")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@lembrete.com", nome="Admin A", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="b@lembrete.com", nome="Admin B", senha="Senha@12345",
        empresa=empresa_b, perfil="admin",
    )


def _evento(empresa, criado_por, *, faltando_min=30, antecedencia=30, **over):
    """Evento que começa daqui a `faltando_min` minutos."""
    inicio = timezone.now() + timedelta(minutes=faltando_min)
    dados = {
        "empresa": empresa,
        "criado_por": criado_por,
        "titulo": "Reunião com o fornecedor",
        "data_inicio": inicio,
        "data_fim": inicio + timedelta(hours=1),
        "lembrete_antecedencia": antecedencia,
    }
    dados.update(over)
    return Evento.objects.create(**dados)


def _notificacoes(usuario):
    return Notificacao.objects.filter(usuario=usuario, tipo="agenda")


# ── O aviso sai na hora certa ───────────────────────────────────────────────

@pytest.mark.django_db
def test_lembrete_dispara_quando_o_momento_chega(empresa_a, usuario_a):
    # Começa em 30 min, pediu aviso 30 min antes → o momento é AGORA.
    evento = _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)

    resultado = enviar_lembretes()

    assert resultado["lembretes_enviados"] == 1
    notificacao = _notificacoes(usuario_a).get()
    assert evento.titulo in notificacao.titulo
    assert notificacao.acao_url == "/agenda"


@pytest.mark.django_db
def test_nao_dispara_antes_da_hora(empresa_a, usuario_a):
    # Começa em 2h, aviso pedido para 30 min antes → ainda falta 1h30.
    _evento(empresa_a, usuario_a, faltando_min=120, antecedencia=30)

    resultado = enviar_lembretes()

    assert resultado["lembretes_enviados"] == 0
    assert _notificacoes(usuario_a).count() == 0


@pytest.mark.django_db
def test_evento_sem_lembrete_nao_notifica(empresa_a, usuario_a):
    # Um que ainda vai começar e outro que JÁ começou. O segundo é o que
    # importa: com antecedência zero, "data_inicio - 0 <= agora" é verdadeiro
    # para ele, então só o filtro de "tem lembrete" o segura.
    _evento(empresa_a, usuario_a, faltando_min=5, antecedencia=SEM_LEMBRETE)
    _evento(empresa_a, usuario_a, faltando_min=-10, antecedencia=SEM_LEMBRETE,
            titulo="Já começou e ninguém pediu aviso")

    resultado = enviar_lembretes()

    assert resultado["lembretes_enviados"] == 0
    assert _notificacoes(usuario_a).count() == 0


@pytest.mark.django_db
def test_evento_comecado_ha_muito_tempo_nao_vira_spam(empresa_a, usuario_a):
    # Começou há 3h: o aviso perdeu a serventia (tolerância é de 1h).
    _evento(empresa_a, usuario_a, faltando_min=-180, antecedencia=30)

    resultado = enviar_lembretes()

    assert resultado["lembretes_enviados"] == 0
    assert _notificacoes(usuario_a).count() == 0


@pytest.mark.django_db
def test_evento_recem_comecado_ainda_avisa(empresa_a, usuario_a):
    # Começou há 10 min: dentro da tolerância — "você está atrasado" ajuda.
    _evento(empresa_a, usuario_a, faltando_min=-10, antecedencia=30)

    assert enviar_lembretes()["lembretes_enviados"] == 1


# ── Uma vez só (idempotência) ───────────────────────────────────────────────

@pytest.mark.django_db
def test_lembrete_enviado_impede_notificacao_dupla(empresa_a, usuario_a):
    evento = _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)

    enviar_lembretes()
    # Segunda rodada 5 minutos depois: o momento do lembrete continua no
    # passado, então sem a guarda a pessoa seria avisada de novo.
    enviar_lembretes()

    assert _notificacoes(usuario_a).count() == 1
    evento.refresh_from_db()
    assert evento.lembrete_enviado is True


@pytest.mark.django_db
def test_remarcar_o_evento_rearma_o_lembrete(empresa_a, usuario_a):
    evento = _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)
    enviar_lembretes()
    assert _notificacoes(usuario_a).count() == 1

    # Adiada para a semana que vem — e de novo faltando 30 min para a hora.
    novo_inicio = timezone.now() + timedelta(days=7, minutes=30)
    AgendaService.atualizar_evento(
        empresa_a.id, evento.id, {"data_inicio": novo_inicio,
                                  "data_fim": novo_inicio + timedelta(hours=1)}
    )
    evento.refresh_from_db()
    assert evento.lembrete_enviado is False, "remarcar precisa rearmar o lembrete"


@pytest.mark.django_db
def test_trocar_a_antecedencia_rearma_o_lembrete(empresa_a, usuario_a):
    evento = _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)
    enviar_lembretes()

    AgendaService.atualizar_evento(
        empresa_a.id, evento.id, {"lembrete_antecedencia": 10}
    )

    evento.refresh_from_db()
    assert evento.lembrete_enviado is False


@pytest.mark.django_db
def test_editar_outro_campo_nao_rearma(empresa_a, usuario_a):
    """Corrigir o título não pode fazer o aviso sair duas vezes."""
    evento = _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)
    enviar_lembretes()

    AgendaService.atualizar_evento(empresa_a.id, evento.id, {"titulo": "Outro nome"})

    evento.refresh_from_db()
    assert evento.lembrete_enviado is True


# ── E-mail ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_lembrete_dispara_email(empresa_a, usuario_a):
    _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)

    with patch("modules.agenda.emails._enviar") as enviar:
        enviar_lembretes()

    assert enviar.call_count == 1
    destinatario, assunto, html = enviar.call_args[0]
    assert destinatario == usuario_a.email
    assert "Reunião com o fornecedor" in assunto
    assert "Abrir a agenda" in html


@pytest.mark.django_db
def test_email_traz_local_e_cliente_quando_existem(empresa_a, usuario_a):
    cliente = Cliente.objects.create(empresa=empresa_a, nome="Padaria do Zé")
    _evento(
        empresa_a, usuario_a, faltando_min=30, antecedencia=30,
        local="Escritório", cliente=cliente,
    )

    with patch("modules.agenda.emails._enviar") as enviar:
        enviar_lembretes()

    html = enviar.call_args[0][2]
    assert "Escritório" in html
    assert "Padaria do Zé" in html


@pytest.mark.django_db
def test_email_que_falha_nao_derruba_o_sino(empresa_a, usuario_a):
    """O e-mail é o canal frágil; a notificação não pode depender dele."""
    _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)

    with patch("modules.agenda.emails._enviar", side_effect=RuntimeError("Resend caiu")):
        resultado = enviar_lembretes()

    assert resultado["lembretes_enviados"] == 1
    assert _notificacoes(usuario_a).count() == 1


# ── Multi-tenant e módulo desligado ─────────────────────────────────────────

@pytest.mark.django_db
def test_multitenant_cada_um_recebe_o_seu(empresa_a, usuario_a, empresa_b, usuario_b):
    _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30,
            titulo="Evento da A")
    _evento(empresa_b, usuario_b, faltando_min=30, antecedencia=30,
            titulo="Evento da B")

    enviar_lembretes()

    assert _notificacoes(usuario_a).count() == 1
    assert _notificacoes(usuario_b).count() == 1
    assert "Evento da A" in _notificacoes(usuario_a).get().titulo
    assert "Evento da B" in _notificacoes(usuario_b).get().titulo


@pytest.mark.django_db
def test_empresa_com_agenda_desligada_nao_recebe(empresa_a, usuario_a):
    empresa_a.modulo_agenda = False
    empresa_a.save(update_fields=["modulo_agenda"])
    evento = _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)

    with patch("modules.agenda.emails._enviar") as enviar:
        resultado = enviar_lembretes()

    assert resultado["lembretes_enviados"] == 0
    assert _notificacoes(usuario_a).count() == 0
    assert enviar.call_count == 0, "módulo desligado não pode nem mandar e-mail"
    evento.refresh_from_db()
    assert evento.lembrete_enviado is False, "religar o módulo devolve o lembrete"


@pytest.mark.django_db
def test_empresa_inativa_nao_recebe(empresa_a, usuario_a):
    empresa_a.ativo = False
    empresa_a.save(update_fields=["ativo"])
    _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)

    assert enviar_lembretes()["lembretes_enviados"] == 0


# ── Sem destinatário ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_sem_criador_marca_a_guarda_e_segue(empresa_a):
    """Criador removido: ninguém a avisar, mas o evento não pode ser varrido
    de novo a cada 5 minutos até a hora passar."""
    evento = _evento(empresa_a, None, faltando_min=30, antecedencia=30)

    resultado = enviar_lembretes()

    assert resultado["lembretes_enviados"] == 0
    assert resultado["sem_destinatario"] == 1
    evento.refresh_from_db()
    assert evento.lembrete_enviado is True


@pytest.mark.django_db
def test_criador_desativado_nao_recebe(empresa_a, usuario_a):
    usuario_a.ativo = False
    usuario_a.save(update_fields=["ativo"])
    _evento(empresa_a, usuario_a, faltando_min=30, antecedencia=30)

    resultado = enviar_lembretes()

    assert resultado["sem_destinatario"] == 1
    assert _notificacoes(usuario_a).count() == 0


# ── O tipo existe ───────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_agenda_e_um_tipo_de_notificacao():
    """Sem isto a notificação nasceria com um tipo que a tela não sabe rotular."""
    tipos = dict(Notificacao.TIPO_CHOICES)
    assert "agenda" in tipos
    assert tipos["agenda"] == "Agenda"


@pytest.mark.django_db
def test_tipo_agenda_esta_ligado_ao_modulo_agenda():
    from modules.notificacoes.services import TIPO_PARA_MODULO

    assert TIPO_PARA_MODULO.get("agenda") == "agenda"


# ── A API aceita e devolve a antecedência ───────────────────────────────────

@pytest.mark.django_db
def test_api_salva_e_devolve_a_antecedencia(empresa_a, usuario_a):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    client.cookies["access_token"] = str(RefreshToken.for_user(usuario_a).access_token)
    inicio = timezone.now() + timedelta(days=1)

    r = client.post("/api/agenda/", {
        "titulo": "Consulta",
        "data_inicio": inicio.isoformat(),
        "data_fim": (inicio + timedelta(hours=1)).isoformat(),
        "lembrete_antecedencia": 60,
    }, format="json")

    assert r.status_code == 201, r.data
    assert r.data["data"]["lembrete_antecedencia"] == 60
