"""
Synapse — Módulo Agenda: Service
Regras de negócio da agenda. Views chamam o service, nunca o ORM direto.
"""
import logging

from shared.cache import invalidate_cache

from .models import Evento
from .repository import AgendaRepository

logger = logging.getLogger("synapse")


class AgendaService:
    """Serviço da Agenda."""

    @staticmethod
    def listar_eventos(empresa_id, inicio=None, fim=None):
        """Lista eventos (opcionalmente por intervalo). Retorna queryset."""
        return AgendaRepository.listar(empresa_id, inicio, fim)

    @staticmethod
    def obter_evento(empresa_id, evento_id) -> Evento:
        evento = AgendaRepository.obter(empresa_id, evento_id)
        if not evento:
            raise ValueError("Evento não encontrado.")
        return evento

    @staticmethod
    def criar_evento(empresa_id, usuario_id, dados: dict) -> Evento:
        evento = AgendaRepository.criar(empresa_id, usuario_id, dados)
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Evento criado",
            extra={"empresa_id": str(empresa_id), "evento_id": str(evento.id)},
        )
        return evento

    @staticmethod
    def atualizar_evento(empresa_id, evento_id, dados: dict) -> Evento:
        evento = AgendaService.obter_evento(empresa_id, evento_id)
        evento = AgendaRepository.atualizar(evento, dados)
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Evento atualizado",
            extra={"empresa_id": str(empresa_id), "evento_id": str(evento_id)},
        )
        return evento

    @staticmethod
    def deletar_evento(empresa_id, evento_id) -> None:
        evento = AgendaService.obter_evento(empresa_id, evento_id)
        AgendaRepository.deletar(evento)
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Evento excluído",
            extra={"empresa_id": str(empresa_id), "evento_id": str(evento_id)},
        )
