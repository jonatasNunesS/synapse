"""
Synapse - Entidade Financeiro
Placeholder para M2. Define estruturas de dados do módulo financeiro.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from .base import TenantEntity


TIPOS_LANCAMENTO = ("receita", "despesa")
STATUS_LANCAMENTO = ("pendente", "pago", "atrasado", "cancelado")


@dataclass
class CategoriaEntity(TenantEntity):
    """Categoria de lançamento financeiro."""

    nome: str = ""
    tipo: str = "despesa"  # receita ou despesa
    cor: str = "#6D28D9"


@dataclass
class LancamentoEntity(TenantEntity):
    """Lançamento financeiro (receita ou despesa)."""

    tipo: str = "despesa"
    valor: Decimal = Decimal("0.00")
    descricao: str = ""
    categoria_id: Optional[int] = None
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    status: str = "pendente"
    recorrente: bool = False
    notas: str = ""
