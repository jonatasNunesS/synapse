"""
Synapse - Entidade Estoque
Placeholder para M3. Define estruturas de dados do módulo de estoque.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from .base import TenantEntity


TIPOS_MOVIMENTACAO = ("entrada", "saida", "ajuste")


@dataclass
class ProdutoEntity(TenantEntity):
    """Produto no estoque."""

    nome: str = ""
    sku: str = ""
    categoria_id: Optional[int] = None
    preco_custo: Decimal = Decimal("0.00")
    preco_venda: Decimal = Decimal("0.00")
    estoque_atual: int = 0
    estoque_minimo: int = 0
    unidade: str = "un"
    ativo: bool = True
    imagem_url: str = ""


@dataclass
class MovimentacaoEntity(TenantEntity):
    """Movimentação de estoque."""

    produto_id: Optional[int] = None
    tipo: str = "entrada"
    quantidade: int = 0
    motivo: str = ""
    referencia: str = ""
    criado_por_id: Optional[int] = None
