"""
Synapse — Módulo Agenda: Tasks Celery

Lembrete de evento: o que faz a agenda procurar a pessoa, em vez de só guardar.

CADÊNCIA — a cada 5 minutos (ver `config/celery.py`)
    A menor antecedência oferecida é de 10 minutos, então uma varredura diária
    (o padrão dos outros módulos) não serviria: o aviso chegaria horas depois
    da hora. Cinco minutos deixa o atraso máximo em 5 min — um lembrete de
    "10 minutos antes" chega entre 5 e 10 minutos antes, que é o que a pessoa
    espera — sem o custo de acordar o worker 1.440 vezes por dia.

JANELA — a varredura só olha eventos que começam da próxima 1 hora atrás até
    daqui a 24h (a maior antecedência oferecida). Quem começou há mais de uma
    hora não recebe aviso: o lembrete perdeu a serventia e virou spam.

IDEMPOTÊNCIA — `lembrete_enviado` marca o evento como JÁ PROCESSADO. Uma
    rodada atrasada ou repetida não avisa duas vezes. Remarcar o evento (ou
    trocar a antecedência) zera a guarda no Service — o lembrete novo vale.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger("synapse")

# Depois disto o aviso já não ajuda ninguém — a reunião começou faz tempo.
TOLERANCIA_ATRASO_MIN = 60


@shared_task(name="agenda.enviar_lembretes", bind=True, max_retries=3)
def enviar_lembretes(self):
    """
    Roda a cada 5 minutos. Para cada evento cujo momento de lembrete chegou e
    que ainda não foi avisado: notificação no sino + e-mail, uma única vez.
    Multi-tenant e respeitando empresas que desligaram o módulo Agenda.
    """
    from .models import MAIOR_ANTECEDENCIA_MIN, Evento

    agora = timezone.now()
    enviados = 0
    sem_destinatario = 0

    try:
        for evento in _eventos_a_lembrar(Evento, agora, MAIOR_ANTECEDENCIA_MIN):
            try:
                if _avisar(evento):
                    enviados += 1
                else:
                    sem_destinatario += 1
            except Exception as e:
                # Um evento problemático não pode levar os outros junto.
                logger.warning(f"Falha ao enviar lembrete do evento {evento.id}: {e}")

        logger.info(
            "Task agenda.enviar_lembretes concluída",
            extra={
                "lembretes_enviados": enviados,
                "sem_destinatario": sem_destinatario,
            },
        )
        return {
            "status": "ok",
            "lembretes_enviados": enviados,
            "sem_destinatario": sem_destinatario,
        }
    except Exception as exc:
        logger.error(f"Erro na task agenda.enviar_lembretes: {exc}")
        raise self.retry(exc=exc, countdown=60)


def _eventos_a_lembrar(Evento, agora, maior_antecedencia_min):
    """
    Os eventos cujo momento de lembrete já chegou.

    O banco estreita a busca (pendentes, dentro da janela, de empresa ativa com
    o módulo ligado) e a conta final — `data_inicio - antecedência <= agora` —
    é feita aqui: multiplicar um intervalo por uma coluna no ORM sairia bem
    menos legível do que percorrer um punhado de candidatos.
    """
    from shared.modulos import empresas_com_modulo

    candidatos = (
        Evento.objects.filter(
            lembrete_antecedencia__gt=0,
            lembrete_enviado=False,
            data_inicio__gte=agora - timedelta(minutes=TOLERANCIA_ATRASO_MIN),
            data_inicio__lte=agora + timedelta(minutes=maior_antecedencia_min),
            empresa__ativo=True,
            empresa_id__in=empresas_com_modulo("agenda"),
        )
        .select_related("empresa", "cliente", "criado_por")
        .order_by("data_inicio")
    )
    return [
        evento
        for evento in candidatos
        if evento.data_inicio - timedelta(minutes=evento.lembrete_antecedencia) <= agora
    ]


def _avisar(evento) -> bool:
    """
    Sino + e-mail para quem marcou o evento. Marca a guarda em qualquer caso.

    Retorna True se houve a quem avisar. A agenda é COMPARTILHADA (todos da
    empresa veem e editam), mas o lembrete vai para o CRIADOR: é dele o
    compromisso, e avisar a empresa inteira de cada evento viraria ruído.
    """
    from modules.notificacoes.services import NotificacaoService

    from .emails import enviar_email_lembrete

    destinatario = evento.criado_por
    if destinatario is None or not destinatario.ativo:
        # Sem a quem avisar (criador removido ou desativado). Marca como
        # processado mesmo assim: senão o evento seria varrido de novo a cada
        # 5 minutos até a hora passar, sem nunca ter para onde ir.
        evento.lembrete_enviado = True
        evento.save(update_fields=["lembrete_enviado"])
        logger.info(
            "Evento com lembrete sem destinatário — guarda marcada",
            extra={"evento_id": str(evento.id), "empresa_id": str(evento.empresa_id)},
        )
        return False

    NotificacaoService.criar_notificacao(
        usuario_id=str(destinatario.id),
        empresa_id=str(evento.empresa_id),
        tipo="agenda",
        titulo=f"Em breve: {evento.titulo}",
        mensagem=_mensagem(evento),
        acao_url="/agenda",
        prioridade="normal",
    )
    enviar_email_lembrete(evento, destinatario.email)

    evento.lembrete_enviado = True
    evento.save(update_fields=["lembrete_enviado"])
    logger.info(
        "Lembrete de agenda enviado",
        extra={
            "evento_id": str(evento.id),
            "empresa_id": str(evento.empresa_id),
            "usuario_id": str(destinatario.id),
        },
    )
    return True


def _mensagem(evento) -> str:
    """O texto do sino: quando começa, e onde, se a pessoa disse onde."""
    inicio = timezone.localtime(evento.data_inicio)
    quando = (
        f"{inicio:%d/%m}" if evento.dia_inteiro else f"{inicio:%d/%m} às {inicio:%H:%M}"
    )
    texto = f"Seu compromisso começa em {quando}."
    if evento.local:
        texto += f" Local: {evento.local}."
    return texto
