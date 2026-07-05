"""
Synapse — Módulo Agenda: Repository
Toda query ao banco passa por aqui. Nunca diretamente nas views.
Cache Redis nas listagens no padrão synapse:{empresa_id}:agenda:*
"""
import logging

from shared.cache import build_cache_key, get_cached, set_cached

from .models import Evento

logger = logging.getLogger("synapse")

CACHE_TTL = 120  # 2 minutos (calendário muda com frequência)


class AgendaRepository:
    """Repositório de queries do módulo Agenda."""

    @staticmethod
    def _base_qs(empresa_id):
        return Evento.objects.filter(empresa_id=empresa_id).select_related(
            "cliente", "criado_por"
        )

    @staticmethod
    def listar(empresa_id, inicio=None, fim=None):
        """
        Lista eventos da empresa. Se inicio/fim informados, retorna apenas os
        que SOBREPÕEM o intervalo [inicio, fim] (evento cujo período cruza a
        janela visível do calendário): data_inicio <= fim AND data_fim >= inicio.
        """
        qs = AgendaRepository._base_qs(empresa_id)
        if inicio is not None:
            qs = qs.filter(data_fim__gte=inicio)
        if fim is not None:
            qs = qs.filter(data_inicio__lte=fim)
        return qs.order_by("data_inicio")

    @staticmethod
    def obter(empresa_id, evento_id):
        """Retorna um evento da empresa ou None."""
        return AgendaRepository._base_qs(empresa_id).filter(id=evento_id).first()

    @staticmethod
    def criar(empresa_id, criado_por_id, dados: dict) -> Evento:
        return Evento.objects.create(
            empresa_id=empresa_id,
            criado_por_id=criado_por_id,
            **dados,
        )

    @staticmethod
    def atualizar(evento: Evento, dados: dict) -> Evento:
        for campo, valor in dados.items():
            setattr(evento, campo, valor)
        evento.save()
        return evento

    @staticmethod
    def deletar(evento: Evento) -> None:
        evento.delete()

    # ── Cache helpers (usados pelo Service) ──────────────────────────────
    @staticmethod
    def cache_get_lista(empresa_id, params: dict):
        key = build_cache_key(empresa_id, "agenda", "lista", params)
        return key, get_cached(key)

    @staticmethod
    def cache_set_lista(key: str, data) -> None:
        set_cached(key, data, CACHE_TTL)
