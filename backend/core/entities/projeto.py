"""
Synapse - Entidade Projeto
Placeholder para M6. Define estruturas de dados do módulo de projetos.
"""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from .base import TenantEntity


STATUS_PROJETO = ("planejamento", "em_andamento", "pausado", "concluido", "cancelado")
PRIORIDADES = ("baixa", "media", "alta", "urgente")
STATUS_TAREFA = ("a_fazer", "em_andamento", "revisao", "concluido")


@dataclass
class ProjetoEntity(TenantEntity):
    """Projeto de trabalho."""

    nome: str = ""
    descricao: str = ""
    prazo: Optional[date] = None
    status: str = "planejamento"
    responsavel_id: Optional[int] = None


@dataclass
class TarefaEntity(TenantEntity):
    """Tarefa dentro de um projeto."""

    projeto_id: Optional[int] = None
    titulo: str = ""
    descricao: str = ""
    responsavel_id: Optional[int] = None
    prazo: Optional[date] = None
    prioridade: str = "media"
    status: str = "a_fazer"
    ordem: int = 0
