"""
Synapse - Cliente Groq (Placeholder)
Implementa core/interfaces/i_ia.py
Nota: Implementação real será feita no M9 (AI Hub).
"""

import logging
from typing import List

from core.interfaces.i_ia import IARequest, IAResponse, IIAService

logger = logging.getLogger("synapse")


class GroqIAService(IIAService):
    """
    Implementação do serviço de IA usando Groq API.
    PLACEHOLDER: métodos retornam respostas mock até o M9.
    """

    def gerar_conteudo(self, request: IARequest) -> IAResponse:
        """Placeholder: será implementado no M9."""
        logger.warning("GroqIAService.gerar_conteudo chamado - placeholder ativo")
        raise NotImplementedError(
            "Serviço de IA ainda não implementado. Disponível a partir do M9."
        )

    def gerar_variacoes(self, request: IARequest, quantidade: int = 3) -> List[IAResponse]:
        """Placeholder: será implementado no M9."""
        logger.warning("GroqIAService.gerar_variacoes chamado - placeholder ativo")
        raise NotImplementedError(
            "Serviço de IA ainda não implementado. Disponível a partir do M9."
        )

    def verificar_limite(self, empresa_id: int) -> bool:
        """Placeholder: sempre retorna False (não atingiu limite)."""
        return False

    def incrementar_uso(self, empresa_id: int, tokens: int) -> None:
        """Placeholder: não faz nada."""
        pass
