"""
Tasks Celery para o módulo de Clientes.

Agendamento (beat schedule):
  - verificar_followups: todo dia às 8h30
  - alertar_followups_atrasados: todo dia às 9h
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="clientes.verificar_followups", bind=True, max_retries=3)
def verificar_followups(self):
    """
    Roda todo dia às 8h30.
    Busca clientes com proximo_followup == hoje e cria notificação
    para o criado_por de cada cliente.
    """
    try:
        from modules.clientes.repository import ClienteRepository
        from modules.auth.models import Empresa

        empresas = Empresa.objects.filter(ativo=True)
        total_notificacoes = 0

        for empresa in empresas:
            clientes_hoje = ClienteRepository.listar_followups_hoje(empresa.id)

            for cliente in clientes_hoje:
                if cliente.criado_por:
                    logger.info(
                        "Follow-up hoje: empresa=%s, cliente=%s, responsavel=%s",
                        empresa.id,
                        cliente.nome,
                        cliente.criado_por.email,
                    )
                    # M7 implementará o model Notificacao
                    # Por ora, apenas loga
                    total_notificacoes += 1

        logger.info(
            "verificar_followups concluído: %d follow-ups para hoje.",
            total_notificacoes,
        )
        return {"total_followups_hoje": total_notificacoes}

    except Exception as exc:
        logger.error("Erro em verificar_followups: %s", exc)
        raise self.retry(exc=exc, countdown=60)


@shared_task(name="clientes.alertar_followups_atrasados", bind=True, max_retries=3)
def alertar_followups_atrasados(self):
    """
    Roda todo dia às 9h.
    Busca clientes com proximo_followup < hoje e cria 1 notificação
    por empresa agrupando todos os clientes atrasados.
    """
    try:
        from modules.clientes.repository import ClienteRepository
        from modules.auth.models import Empresa

        empresas = Empresa.objects.filter(ativo=True)
        total_alertas = 0

        for empresa in empresas:
            clientes_atrasados = list(
                ClienteRepository.listar_followups_atrasados(empresa.id)
            )

            if clientes_atrasados:
                nomes = ", ".join(c.nome for c in clientes_atrasados[:5])
                extras = len(clientes_atrasados) - 5
                mensagem = (
                    f"{len(clientes_atrasados)} follow-up(s) atrasado(s): {nomes}"
                )
                if extras > 0:
                    mensagem += f" e mais {extras}."

                logger.warning(
                    "Follow-ups atrasados: empresa=%s, count=%d, clientes=%s",
                    empresa.id,
                    len(clientes_atrasados),
                    nomes,
                )
                # M7 implementará o model Notificacao
                total_alertas += 1

        logger.info(
            "alertar_followups_atrasados concluído: %d empresas com alertas.",
            total_alertas,
        )
        return {"empresas_com_alertas": total_alertas}

    except Exception as exc:
        logger.error("Erro em alertar_followups_atrasados: %s", exc)
        raise self.retry(exc=exc, countdown=60)
