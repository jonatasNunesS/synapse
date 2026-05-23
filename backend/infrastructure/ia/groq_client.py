"""
Synapse - Cliente Groq (Implementação Real — M9)
Implementa a interface IIAService para geração de conteúdo via Groq API.
Modelos:
  - simples:   llama-3.1-8b-instant   (rápido, baixo custo)
  - avancado:  llama-3.3-70b-versatile (alta qualidade)
Cache: synapse:ai:{empresa_id}:{md5(prompt+modelo)} — TTL 24h
"""
import hashlib
import logging

from groq import Groq
from decouple import config
from django.core.cache import cache

from core.interfaces.i_ia import IIAService, IARequest, IAResponse

logger = logging.getLogger("synapse")


class GroqClient(IIAService):
    """
    Implementação real do serviço de IA usando Groq API.
    Suporta dois modelos: simples (8B) e avancado (70B).
    Todas as respostas são cacheadas por 24h por padrão.
    """

    MODELOS = {
        "simples": "llama-3.1-8b-instant",
        "avancado": "llama-3.3-70b-versatile",
    }

    def __init__(self):
        self.client = Groq(api_key=config("GROQ_API_KEY", default=""))

    # --- Interface IIAService ---

    def gerar_conteudo(self, request: IARequest) -> IAResponse:
        """Gera conteúdo via Groq com cache automático."""
        modelo_key = "simples" if request.modelo == "llama-3.1-8b-instant" else "avancado"
        resultado = self.gerar(
            prompt=request.prompt,
            sistema=request.system_prompt,
            modelo=modelo_key,
            max_tokens=request.max_tokens,
            empresa_id=str(request.empresa_id) if request.empresa_id else None,
        )
        return IAResponse(
            conteudo=resultado,
            modelo_usado=self.MODELOS.get(modelo_key, request.modelo),
        )

    def gerar_variacoes(self, request: IARequest, quantidade: int = 3) -> list:
        """Gera múltiplas variações em chamadas independentes."""
        variacoes = []
        for i in range(quantidade):
            prompt_variacao = f"{request.prompt}\n\nVariacao {i + 1} de {quantidade}:"
            resposta = self.gerar_conteudo(
                IARequest(
                    prompt=prompt_variacao,
                    system_prompt=request.system_prompt,
                    empresa_id=request.empresa_id,
                    modelo=request.modelo,
                    max_tokens=request.max_tokens,
                )
            )
            variacoes.append(resposta)
        return variacoes

    def verificar_limite(self, empresa_id: int) -> bool:
        """Delega para AIHubService."""
        return True

    def incrementar_uso(self, empresa_id: int, tokens: int) -> None:
        """Delega para AIHubService."""
        pass

    # --- Método principal ---

    def gerar(
        self,
        prompt: str,
        sistema: str = "",
        modelo: str = "simples",
        max_tokens: int = 1000,
        cache_ttl: int = 86400,
        empresa_id: str = None,
    ) -> str:
        """
        Gera texto via Groq API com cache Redis.
        """
        # 1. Verificar cache
        cache_key = self._cache_key(empresa_id, prompt, modelo)
        cached = cache.get(cache_key)
        if cached:
            logger.debug("GroqClient cache hit: %s", cache_key)
            return cached

        # 2. Montar mensagens
        messages = []
        if sistema:
            messages.append({"role": "system", "content": sistema})
        messages.append({"role": "user", "content": prompt})

        # 3. Chamar Groq
        modelo_id = self.MODELOS.get(modelo, self.MODELOS["simples"])
        logger.info("GroqClient chamando modelo=%s empresa=%s", modelo_id, empresa_id)

        response = self.client.chat.completions.create(
            model=modelo_id,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7,
        )

        resultado = response.choices[0].message.content

        # 4. Salvar no cache
        if cache_ttl > 0 and resultado:
            cache.set(cache_key, resultado, cache_ttl)

        return resultado

    def _cache_key(self, empresa_id: str, prompt: str, modelo: str) -> str:
        """Gera chave de cache determinística."""
        hash_prompt = hashlib.md5(
            f"{prompt}{modelo}".encode()
        ).hexdigest()
        return f"synapse:ai:{empresa_id}:{hash_prompt}"
