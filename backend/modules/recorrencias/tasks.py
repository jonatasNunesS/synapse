"""
Synapse — Recorrências: tasks Celery.
"""
import logging

from celery import shared_task

logger = logging.getLogger("synapse")


@shared_task(name="recorrencias.gerar_ocorrencias", bind=True, max_retries=1)
def gerar_ocorrencias(self):
    """
    Task diária (00:05 BRT): cria as ocorrências pendentes que já chegaram a
    hora de aparecer e reativa as adiadas. Idempotente.
    """
    from modules.recorrencias.services import RecorrenciaService

    total = RecorrenciaService.gerar_ocorrencias()
    logger.info("Recorrências: task gerou/reativou %d ocorrência(s).", total)
    return total
