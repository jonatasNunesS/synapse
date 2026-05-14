"""
Synapse - Entidade Fornecedor
Placeholder para M5. Define estruturas de dados do módulo de fornecedores.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from .base import TenantEntity


@dataclass
class FornecedorEntity(TenantEntity):
    """Fornecedor cadastrado."""

    nome: str = ""
    categoria: str = ""
    contato: str = ""
    email: str = ""
    telefone: str = ""
    site: str = ""
    cnpj: str = ""
    condicoes_pagamento: str = ""
    prazo_entrega: str = ""
    status: str = "ativo"
    score_synapse: Decimal = Decimal("0.0")
    notas: str = ""
