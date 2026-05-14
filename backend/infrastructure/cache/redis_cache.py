"""
Synapse - Implementação de Cache com Redis
Implementa core/interfaces/i_cache.py
"""

import logging
from typing import Any, Optional

from django.core.cache import cache

from core.interfaces.i_cache import ICacheService

logger = logging.getLogger("synapse")


class RedisCacheService(ICacheService):
    """Implementação concreta de cache usando Redis via django-redis."""

    def get(self, key: str) -> Optional[Any]:
        """Busca valor no Redis."""
        try:
            value = cache.get(key)
            if value is not None:
                logger.debug(f"Cache HIT: {key}")
            else:
                logger.debug(f"Cache MISS: {key}")
            return value
        except Exception as e:
            logger.warning(f"Cache GET error: {key} - {e}")
            return None

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Salva valor no Redis com TTL."""
        try:
            cache.set(key, value, ttl)
            logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
        except Exception as e:
            logger.warning(f"Cache SET error: {key} - {e}")

    def delete(self, key: str) -> None:
        """Remove uma chave do Redis."""
        try:
            cache.delete(key)
            logger.debug(f"Cache DELETE: {key}")
        except Exception as e:
            logger.warning(f"Cache DELETE error: {key} - {e}")

    def delete_pattern(self, pattern: str) -> int:
        """Remove chaves por padrão usando SCAN."""
        try:
            from django_redis import get_redis_connection

            conn = get_redis_connection("default")
            keys = list(conn.scan_iter(match=pattern))
            if keys:
                count = conn.delete(*keys)
                logger.info(f"Cache DELETE PATTERN: {pattern} ({count} keys)")
                return count
            return 0
        except Exception as e:
            logger.warning(f"Cache DELETE PATTERN error: {pattern} - {e}")
            return 0

    def exists(self, key: str) -> bool:
        """Verifica se chave existe no Redis."""
        try:
            return cache.has_key(key)
        except Exception as e:
            logger.warning(f"Cache EXISTS error: {key} - {e}")
            return False
