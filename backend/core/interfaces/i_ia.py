"""
Synapse - Interface de IA
Contrato que qualquer implementação de IA deve seguir.
Implementação concreta: infrastructure/ia/groq_client.py
Nota: Sem implementação real até M9.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class IARequest:
    """Requisição para o serviço de IA."""

    prompt: str
    system_prompt: str = ""
    empresa_id: Optional[int] = None
    modelo: str = "llama-3.1-8b-instant"  # Padrão: modelo leve
    max_tokens: int = 1024
    temperature: float = 0.7


@dataclass
class IAResponse:
    """Resposta do serviço de IA."""

    conteudo: str
    modelo_usado: str
    tokens_entrada: int = 0
    tokens_saida: int = 0
    cached: bool = False


class IIAService(ABC):
    """Interface abstrata para serviço de IA."""

    @abstractmethod
    def gerar_conteudo(self, request: IARequest) -> IAResponse:
        """Gera conteúdo via LLM."""
        pass

    @abstractmethod
    def gerar_variacoes(self, request: IARequest, quantidade: int = 3) -> List[IAResponse]:
        """Gera múltiplas variações em uma única chamada."""
        pass

    @abstractmethod
    def verificar_limite(self, empresa_id: int) -> bool:
        """Verifica se a empresa atingiu o limite de chamadas IA do mês."""
        pass

    @abstractmethod
    def incrementar_uso(self, empresa_id: int, tokens: int) -> None:
        """Incrementa o contador de uso de IA da empresa."""
        pass
