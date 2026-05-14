"""
Synapse - Entidade Conteúdo
Placeholder para M9 (AI Hub). Define estruturas de dados do módulo de IA.
"""

from dataclasses import dataclass
from typing import Optional

from .base import TenantEntity


@dataclass
class ConteudoEntity(TenantEntity):
    """Conteúdo gerado por IA."""

    tipo: str = ""  # legenda, hashtag, artigo, etc.
    prompt: str = ""
    resposta: str = ""
    modelo_ia: str = ""
    tokens_usados: int = 0
