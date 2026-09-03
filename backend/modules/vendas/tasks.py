"""
Synapse — Vendas: Tasks Celery.

A cobrança do fiado da entidade Venda. Mesma mecânica da do fluxo antigo de
interação (`clientes.notificar_vendas_fiado`): uma passada por dia, notificação
no sino, idempotente por `notificacao_enviada`.
"""
import logging

from celery import shared_task

logger = logging.getLogger("synapse")


@shared_task(name="vendas.notificar_vendas_fiado", bind=True, max_retries=3)
def notificar_vendas_fiado(self):
    """
    Roda todo dia (00:20 BRT). Notifica as vendas fiadas cuja previsão de
    pagamento chegou e que ainda não foram avisadas.

    Vinte minutos depois da tarefa das interações, e não junto: as duas criam
    notificação para a mesma pessoa, e separá-las mantém legível quem avisou o
    quê se uma delas falhar.
    """
    try:
        from modules.vendas.services import VendaService

        total = VendaService.notificar_vendas_fiado()
        logger.info("vendas.notificar_vendas_fiado: %d notificação(ões).", total)
        return {"notificacoes": total}
    except Exception as exc:
        logger.error("Erro em vendas.notificar_vendas_fiado: %s", exc)
        raise self.retry(exc=exc, countdown=60)
