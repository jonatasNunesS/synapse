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


def invalidate_cache(empresa_id, modulo: str) -> None:
    """
    Invalida todo o cache de um módulo para uma empresa.
    Usa padrão de prefixo: synapse:{empresa_id}:{modulo}:*

    Estratégia:
    1. Tenta usar cache.delete_pattern() (django-redis)
    2. Fallback: tenta via get_redis_connection diretamente
    3. Fallback final: usa cache.clear() (apenas em testes/LocMemCache)
    """
    pattern = f"synapse:{empresa_id}:{modulo}:*"

    # Tentativa 1: delete_pattern do django-redis (método preferido)
    try:
        cache.delete_pattern(pattern)
        logger.info(
            f"Cache invalidated via delete_pattern: {pattern}",
            extra={"empresa_id": empresa_id, "modulo": modulo},
        )
        return
    except AttributeError:
        # LocMemCache não tem delete_pattern — fallback
        pass
    except Exception as e:
        logger.warning(f"delete_pattern failed: {pattern} - {e}")

    # Tentativa 2: via get_redis_connection diretamente
    try:
        from django_redis import get_redis_connection
        conn = get_redis_connection("default")
        # Padrão correto sem prefixo duplicado
        keys = conn.keys(pattern)
        if keys:
            conn.delete(*keys)
            logger.info(
                f"Cache invalidated via redis keys: {pattern}",
                extra={"empresa_id": empresa_id, "modulo": modulo, "keys_deleted": len(keys)},
            )
        return
    except Exception as e:
        logger.debug(f"Redis direct invalidation failed: {pattern} - {e}")

    # Fallback final: limpa todo o cache (aceitável em testes com LocMemCache)
    try:
        cache.clear()
        logger.debug(f"Cache cleared (fallback): {pattern}")
    except Exception as e:
        logger.warning(f"Cache clear fallback failed: {e}")


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
