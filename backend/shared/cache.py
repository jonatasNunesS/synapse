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


def _e_cache_local() -> bool:
    """
    O cache em uso é o de memória do processo (testes), e não o Redis?

    Importa porque o fallback final (`cache.clear()`) é aceitável num cache
    local de teste e inaceitável em produção, onde apagaria o cache de TODAS
    as empresas por causa da escrita de uma.

    Olha o BACKEND configurado, e não `cache.__class__`: `django.core.cache.cache`
    é um `ConnectionProxy`, então a classe dele não diz nada sobre qual backend
    está atrás.
    """
    from django.conf import settings

    backend = settings.CACHES.get("default", {}).get("BACKEND", "")
    return "locmem" in backend.lower() or "dummy" in backend.lower()


def invalidate_cache(empresa_id, modulo: str) -> None:
    """
    Invalida todo o cache de um módulo para uma empresa.

    Padrão lógico: `synapse:{empresa_id}:{modulo}:*`. A chave REAL no Redis
    não é essa — o django-redis prefixa com `KEY_PREFIX` e a versão, então o
    que está guardado é `synapse:1:synapse:{empresa_id}:{modulo}:*`. Por isso
    todo padrão usado contra a conexão crua passa por `cache.make_key()`.

    Era exatamente aqui que morava o defeito (CODE_HEALTH_AUDIT, ERR-02): o
    fallback montava o padrão à mão, sem prefixo, não casava com nada,
    invalidava ZERO chaves — e retornava como se tivesse funcionado, sem nem
    logar, porque o log estava dentro de um `if keys:`. O sistema seguia
    servindo dado velho acreditando ter invalidado.

    Estratégia, em cascata:
    1. `cache.delete_pattern()` do django-redis (preferido; usa SCAN por dentro)
    2. Conexão crua com `scan_iter()` sobre o padrão JÁ PREFIXADO
    3. `cache.clear()` — SÓ em cache local de teste; em produção, levanta
    """
    pattern = f"synapse:{empresa_id}:{modulo}:*"
    contexto = {"empresa_id": str(empresa_id), "modulo": modulo}

    # ── Tentativa 1: delete_pattern (django-redis aplica o prefixo sozinho)
    try:
        cache.delete_pattern(pattern)
        logger.info(f"Cache invalidado via delete_pattern: {pattern}", extra=contexto)
        return
    except AttributeError:
        # LocMemCache não tem delete_pattern — segue para o fallback.
        pass
    except Exception as e:
        logger.warning(f"delete_pattern falhou: {pattern} — {e}", extra=contexto)

    # ── Tentativa 2: conexão crua, com o padrão prefixado e sem bloquear
    try:
        from django_redis import get_redis_connection

        conn = get_redis_connection("default")

        # `make_key` devolve a chave como ela REALMENTE existe (KEY_PREFIX +
        # versão + chave lógica). Montar o padrão à mão é o que não casava.
        pattern_real = cache.make_key(pattern)

        # `scan_iter`, não `keys`: o comando KEYS é O(N) sobre o keyspace
        # INTEIRO e bloqueia o Redis, que é single-threaded. Com muitas
        # empresas, toda escrita pagaria essa varredura — e justamente neste
        # caminho, que roda quando as coisas já vão mal (CODE_HEALTH_AUDIT,
        # ESC-04).
        apagadas = 0
        for chave in conn.scan_iter(match=pattern_real, count=500):
            conn.delete(chave)
            apagadas += 1

        if apagadas:
            logger.info(
                f"Cache invalidado via scan_iter: {pattern_real} "
                f"({apagadas} chaves)",
                extra={**contexto, "keys_deleted": apagadas},
            )
        else:
            # Zero chaves é informação, não silêncio. Pode ser legítimo (nada
            # cacheado ainda) ou o sintoma de um padrão que não casa — e antes
            # os dois casos eram indistinguíveis.
            logger.info(
                f"Cache invalidado via scan_iter: {pattern_real} "
                f"(nenhuma chave encontrada)",
                extra={**contexto, "keys_deleted": 0},
            )
        return
    except Exception as e:
        logger.warning(
            f"Invalidação direta no Redis falhou: {pattern} — {e}", extra=contexto
        )

    # ── Tentativa 3: só para cache local de teste
    #
    # `cache.clear()` apaga o cache de TODAS as empresas. Num LocMemCache de
    # teste isso não custa nada; em produção seria uma empresa derrubando o
    # cache das outras — raio de alcance cross-tenant a partir de um fallback.
    # Então em produção o erro SOBE, em vez de ser "resolvido" assim.
    if not _e_cache_local():
        logger.error(
            f"Não foi possível invalidar o cache de {pattern}: todas as "
            f"tentativas falharam. Recusando o cache.clear() global para não "
            f"apagar o cache de outras empresas.",
            extra=contexto,
        )
        raise RuntimeError(
            f"Falha ao invalidar o cache do módulo {modulo} "
            f"da empresa {empresa_id}."
        )

    try:
        cache.clear()
        logger.debug(f"Cache local limpo (fallback de teste): {pattern}")
    except Exception as e:
        logger.warning(f"Fallback de cache.clear() falhou: {e}", extra=contexto)


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
