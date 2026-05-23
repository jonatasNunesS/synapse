"""
Synapse — M7: Repository do módulo Notificações.
Todas as queries ao banco passam por aqui.
"""
import logging
from django.utils import timezone
from django.core.cache import cache
from .models import Notificacao

logger = logging.getLogger("synapse")

CACHE_CONTAGEM_KEY = "synapse:{usuario_id}:notificacoes:count"
CACHE_CONTAGEM_TTL = 30  # 30 segundos


class NotificacaoRepository:

    @staticmethod
    def criar(usuario_id: str, empresa_id: str, dados: dict) -> Notificacao:
        """Cria uma nova notificação."""
        return Notificacao.objects.create(
            usuario_id=usuario_id,
            empresa_id=empresa_id,
            **dados,
        )

    @staticmethod
    def listar_nao_lidas(usuario_id: str):
        """Retorna QuerySet de notificações não lidas do usuário, mais recentes primeiro."""
        return (
            Notificacao.objects.filter(usuario_id=usuario_id, lida=False)
            .order_by("-criado_em")[:50]
        )

    @staticmethod
    def listar_todas(usuario_id: str, filtros: dict = None):
        """Retorna QuerySet de todas as notificações do usuário com filtros opcionais."""
        qs = Notificacao.objects.filter(usuario_id=usuario_id).order_by("-criado_em")
        if filtros:
            if filtros.get("tipo"):
                qs = qs.filter(tipo=filtros["tipo"])
            if filtros.get("lida") is not None:
                qs = qs.filter(lida=filtros["lida"])
            if filtros.get("prioridade"):
                qs = qs.filter(prioridade=filtros["prioridade"])
        return qs

    @staticmethod
    def marcar_lida(notificacao_id: str, usuario_id: str) -> Notificacao:
        """Marca uma notificação como lida, verificando que pertence ao usuário."""
        notificacao = Notificacao.objects.get(id=notificacao_id, usuario_id=usuario_id)
        if not notificacao.lida:
            notificacao.lida = True
            notificacao.data_leitura = timezone.now()
            notificacao.save(update_fields=["lida", "data_leitura"])
        return notificacao

    @staticmethod
    def marcar_todas_lidas(usuario_id: str, empresa_id: str) -> int:
        """Marca todas as notificações não lidas do usuário como lidas."""
        count = Notificacao.objects.filter(
            usuario_id=usuario_id,
            empresa_id=empresa_id,
            lida=False,
        ).update(lida=True, data_leitura=timezone.now())
        return count

    @staticmethod
    def contar_nao_lidas(usuario_id: str) -> int:
        """Conta notificações não lidas com cache Redis de 30 segundos."""
        cache_key = CACHE_CONTAGEM_KEY.format(usuario_id=usuario_id)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        count = Notificacao.objects.filter(usuario_id=usuario_id, lida=False).count()
        cache.set(cache_key, count, CACHE_CONTAGEM_TTL)
        return count

    @staticmethod
    def invalidar_cache_contagem(usuario_id: str):
        """Invalida o cache de contagem de notificações não lidas."""
        cache_key = CACHE_CONTAGEM_KEY.format(usuario_id=usuario_id)
        cache.delete(cache_key)

    @staticmethod
    def deletar(notificacao_id: str, usuario_id: str) -> bool:
        """Deleta uma notificação verificando que pertence ao usuário."""
        deleted, _ = Notificacao.objects.filter(
            id=notificacao_id, usuario_id=usuario_id
        ).delete()
        return deleted > 0
