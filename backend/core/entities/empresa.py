"""
Synapse - Entidade Empresa
Define a estrutura de dados de uma empresa no domínio.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

from .base import BaseEntity


PLANOS = ("starter", "pro", "business", "enterprise")
SEGMENTOS = (
    "varejo",
    "servicos",
    "industria",
    "tecnologia",
    "saude",
    "educacao",
    "alimentacao",
    "moda",
    "construcao",
    "outro",
)


@dataclass
class EmpresaEntity(BaseEntity):
    """Representa uma empresa no sistema Synapse."""

    nome: str = ""
    cnpj: Optional[str] = None
    segmento: str = "outro"
    plano: str = "starter"
    plano_ativo: bool = True
    plano_validade: Optional[date] = None
    ativo: bool = True
