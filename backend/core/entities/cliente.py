"""
Synapse - Entidade Cliente
Placeholder para M4. Define estruturas de dados do módulo CRM.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional

from .base import TenantEntity


TIPOS_PESSOA = ("pessoa_fisica", "pessoa_juridica")
STATUS_FUNIL = ("lead", "qualificado", "proposta", "negociacao", "fechado_ganho", "fechado_perdido")
TIPOS_INTERACAO = ("ligacao", "reuniao", "email", "venda", "outro")


@dataclass
class ClienteEntity(TenantEntity):
    """Cliente no CRM."""

    nome: str = ""
    email: str = ""
    telefone: str = ""
    documento: str = ""
    tipo: str = "pessoa_fisica"
    endereco: str = ""
    segmento: str = ""
    status_funil: str = "lead"
    valor_total_compras: Decimal = Decimal("0.00")
    ultima_compra: Optional[date] = None
    notas: str = ""


@dataclass
class InteracaoClienteEntity(TenantEntity):
    """Interação com cliente (histórico)."""

    cliente_id: Optional[int] = None
    tipo: str = "outro"
    descricao: str = ""
    autor_id: Optional[int] = None
