"""
Synapse — AI Hub / Chat Financeiro: prompts.

Assistente conversacional RESTRITO ao financeiro do usuário. As regras do
system prompt são rígidas de propósito: é dinheiro, e o escopo é fechado —
recusa educadamente qualquer coisa fora do financeiro do próprio negócio.

Reaproveita o MESMO contexto financeiro da Análise (montar_bloco_numeros) —
não duplica a montagem dos números.
"""
from modules.ai_hub.analise.prompts import montar_bloco_numeros

# Papéis aceitos no histórico da conversa (memória curta).
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"

SYSTEM_PROMPT_CHAT = (
    "Você é um consultor financeiro conversacional para pequenos negócios "
    "brasileiros. "
    "Responda APENAS perguntas sobre o financeiro do usuário, usando os "
    "números fornecidos no contexto. "
    "NUNCA invente valores: se faltar dado para responder, diga claramente "
    "que o dado não está disponível. "
    "Se a pergunta NÃO for sobre o financeiro do negócio do usuário (ex.: "
    "conhecimentos gerais, outros assuntos, pedidos fora do escopo), recuse "
    "de forma educada com a frase: 'Só posso te ajudar com o financeiro do "
    "seu negócio.' — e não responda ao mérito da pergunta. "
    "Projeções e estimativas devem ser marcadas explicitamente como estimativa, "
    "nunca como garantia; não prometa resultados. "
    "Respostas curtas e diretas — no máximo 3 parágrafos. "
    "Escreva em português claro, tom de consultor."
)


def montar_prompt_pergunta(ctx: dict, pergunta: str, historico: list[dict]) -> str:
    """
    Monta o prompt do usuário: números reais do mês + memória curta da conversa
    + a pergunta atual. O `historico` já vem truncado às últimas mensagens.
    """
    bloco = montar_bloco_numeros(ctx)

    partes = [
        "CONTEXTO FINANCEIRO REAL DO USUÁRIO (use apenas estes números):",
        bloco,
    ]

    if historico:
        linhas = []
        for msg in historico:
            role = msg.get("role")
            content = (msg.get("content") or "").strip()
            if not content:
                continue
            quem = "Usuário" if role == ROLE_USER else "Você (consultor)"
            linhas.append(f"{quem}: {content}")
        if linhas:
            partes.append(
                "CONVERSA ATÉ AQUI (para dar continuidade):\n" + "\n".join(linhas)
            )

    partes.append(f"PERGUNTA ATUAL DO USUÁRIO:\n{pergunta.strip()}")
    partes.append(
        "Responda à pergunta atual seguindo estritamente as regras do sistema."
    )
    return "\n\n".join(partes)
