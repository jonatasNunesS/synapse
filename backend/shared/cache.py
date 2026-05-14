"""
Synapse - Utilitários de Cache Redis
Padrão de chave: synapse:{empresa_id}:{modulo}:{tipo}:{parametros_hash}
"""

import hashlib
import json
import logging
from functools import wraps
from typing import Any, Optional

from django.core.cache import cache

logger = logging.getLogger("synapse")


def build_cache_key(empresa_id: int, modulo: str, tipo: str, params: dict = None) -> str:
    """
    Constrói chave de cache no padrão Synapse.
    Exemplo: synapse:123:financeiro:resumo:a1b2c3d4
    """
    key = f"synapse:{empresa_id}:{modulo}:{tipo}"
    if params:
        params_str = json.dumps(params, sort_keys=True)
        params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
        key = f"{key}:{params_hash}"
    return key


def get_cached(key: str) -> Optional[Any]:
    """Busca valor no cache Redis."""
    value = cache.get(key)
    if value is not None:
        logger.debug(f"Cache HIT: {key}")
    else:
        logger.debug(f"Cache MISS: {key}")
    return value


def set_cached(key: str, value: Any, ttl: int = 300) -> None:
    """Salva valor no cache Redis com TTL em segundos."""
    cache.set(key, value, ttl)
    logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")


def invalidate_cache(empresa_id: int, modulo: str) -> None:
    """
    Invalida todo o cache de um módulo para uma empresa.
    Usa padrão de prefixo: synapse:{empresa_id}:{modulo}:*
    """
    pattern = f"synapse:{empresa_id}:{modulo}:*"
    try:
        from django_redis import get_redis_connection

        conn = get_redis_connection("default")
        keys = conn.keys(f"synapse:{pattern}")
        if keys:
            conn.delete(*keys)
            logger.info(
                f"Cache invalidated: {pattern}",
                extra={"empresa_id": empresa_id, "modulo": modulo, "keys_deleted": len(keys)},
            )
    except Exception as e:
        logger.warning(f"Cache invalidation failed: {pattern} - {e}")


def cached_view(modulo: str, tipo: str, ttl: int = 300):
    """
    Decorator para views GET com cache automático.
    Uso:
        @cached_view(modulo="financeiro", tipo="resumo", ttl=300)
        def get(self, request):
            ...
    """

    def decorator(func):
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            empresa_id = getattr(request.user, "empresa_id", None)
            if not empresa_id:
                return func(self, request, *args, **kwargs)

            # Constrói chave com query params
            params = dict(request.query_params)
            cache_key = build_cache_key(empresa_id, modulo, tipo, params)

            # Verifica cache
            cached_data = get_cached(cache_key)
            if cached_data is not None:
                from rest_framework.response import Response

                return Response(cached_data)

            # Executa a view
            response = func(self, request, *args, **kwargs)

            # Salva no cache se sucesso
            if response.status_code == 200:
                set_cached(cache_key, response.data, ttl)

            return response

        return wrapper

    return decorator
