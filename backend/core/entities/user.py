"""
Synapse - Entidade Usuário
Define a estrutura de dados de um usuário no domínio.
"""

from dataclasses import dataclass
from typing import Optional

from .base import BaseEntity


PERFIS = ("admin", "gerente", "colaborador")


@dataclass
class UserEntity(BaseEntity):
    """Representa um usuário no sistema Synapse."""

    email: str = ""
    nome: str = ""
    empresa_id: Optional[int] = None
    perfil: str = "colaborador"
    ativo: bool = True
