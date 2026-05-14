"""
Synapse - Entidade Base
Classe abstrata com campos comuns a todos os models de negócio.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class BaseEntity:
    """
    Entidade base do domínio.
    Todos os models de negócio herdam desta classe.
    """

    id: Optional[int] = None
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None


@dataclass
class TenantEntity(BaseEntity):
    """
    Entidade com multi-tenant obrigatório.
    Todo model com dados de negócio DEVE herdar desta classe.
    """

    empresa_id: Optional[int] = None
