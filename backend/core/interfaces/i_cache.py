"""
Synapse - Interface de Cache
Contrato que qualquer implementação de cache deve seguir.
Implementação concreta: infrastructure/cache/redis_cache.py
"""

from abc import ABC, abstractmethod
from typing import Any, Optional


class ICacheService(ABC):
    """Interface abstrata para serviço de cache."""

    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """Busca valor no cache pela chave."""
        pass

    @abstractmethod
    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Salva valor no cache com TTL em segundos."""
        pass

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove uma chave do cache."""
        pass

    @abstractmethod
    def delete_pattern(self, pattern: str) -> int:
        """Remove todas as chaves que correspondem ao padrão. Retorna quantidade removida."""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Verifica se uma chave existe no cache."""
        pass
