"""
Synapse — AI Hub / Chat Financeiro: orquestração.

Cada pergunta:
  1. Reserva créditos (operacao="chat_financeiro", 2 créditos) — rejeição na
     porta (402) ANTES de chamar a Groq.
  2. Monta o MESMO contexto financeiro real da Análise + memória curta da
     conversa (últimas mensagens) + system prompt rígido.
  3. Dispara a IA via TaskIA (Celery + polling), reaproveitando a infra de
     status (/api/ai/status/{id}/).
  4. Sucesso confirma o crédito; falha devolve (sem sucesso, sem cobrança).

NÃO cacheia resposta (cada pergunta é única). NÃO persiste a conversa no banco
— o histórico vive na sessão do frontend.
"""
import logging
from datetime import date, datetime, timezone

from modules.ai_hub.models import TaskIA
from modules.ai_hub.analise.context import montar_contexto_financeiro

from .prompts import (
    ROLE_ASSISTANT,
    ROLE_USER,
    SYSTEM_PROMPT_CHAT,
    montar_prompt_pergunta,
)

logger = logging.getLogger("synapse")

# Memória curta: só as últimas N mensagens vão no prompt (continuidade sem
# estourar o contexto). Histórico maior que isso é truncado.
MAX_HISTORICO = 5

OPERACAO = "chat_financeiro"


class ChatFinanceiroService:
    """Orquestra o Chat Financeiro via IA (uma pergunta por vez)."""

    # ── Histórico (memória curta) ────────────────────────────────────────────
    @staticmethod
    def _sanear_historico(historico) -> list[dict]:
        """
        Normaliza e trunca o histórico às últimas MAX_HISTORICO mensagens
        válidas ({role in (user, assistant), content não vazio}).
        """
        if not isinstance(historico, list):
            return []
        limpo = []
        for msg in historico:
            if not isinstance(msg, dict):
                continue
            role = msg.get("role")
            content = msg.get("content")
            if role not in (ROLE_USER, ROLE_ASSISTANT):
                continue
            if not isinstance(content, str) or not content.strip():
                continue
            limpo.append({"role": role, "content": content.strip()})
        return limpo[-MAX_HISTORICO:]

    # ── Solicitação ──────────────────────────────────────────────────────────
    @staticmethod
    def solicitar(empresa_id, usuario_id, pergunta: str, historico=None) -> dict:
        """
        Valida créditos → reserva → cria TaskIA → dispara a IA.
        Retorna {"status": "processando", "task_id": "..."}.
        Levanta SemCreditosError (402) se não houver saldo — antes da IA.
        """
        from modules.ai_hub.creditos import CreditosService

        historico = ChatFinanceiroService._sanear_historico(historico)

        # Rejeição na porta: reserva ANTES de tocar na Groq.
        CreditosService.reservar(empresa_id, OPERACAO)

        hoje = date.today()
        task_ia = TaskIA.objects.create(
            empresa_id=empresa_id,
            tipo="chat",
            status="pendente",
            parametros={
                "chat": "financeiro",
                "pergunta": pergunta.strip(),
                "historico": historico,
                "mes": hoje.month,
                "ano": hoje.year,
                "_credito_operacao": OPERACAO,
            },
        )

        from modules.ai_hub.tasks import responder_chat_financeiro

        celery_task = responder_chat_financeiro.delay(str(task_ia.id))
        task_ia.task_id = celery_task.id
        task_ia.save(update_fields=["task_id"])

        return {"status": "processando", "task_id": str(task_ia.id)}

    # ── Execução (chamada pela task Celery) ──────────────────────────────────
    @staticmethod
    def executar(task_ia_id: str) -> None:
        """Monta contexto + histórico → chama Groq (70B) → salva resposta."""
        from infrastructure.ia.groq_client import GroqClient

        try:
            task_ia = TaskIA.objects.get(pk=task_ia_id)
        except TaskIA.DoesNotExist:
            logger.error("Chat: TaskIA %s não encontrada.", task_ia_id)
            return

        task_ia.status = "processando"
        task_ia.save(update_fields=["status"])

        try:
            empresa_id = task_ia.empresa_id
            params = task_ia.parametros
            pergunta = params.get("pergunta", "")
            historico = params.get("historico", [])
            mes = params.get("mes")
            ano = params.get("ano")

            ctx = montar_contexto_financeiro(empresa_id, mes, ano)
            prompt = montar_prompt_pergunta(ctx, pergunta, historico)

            groq = GroqClient()
            # Modelo avançado (70B): consultoria financeira precisa de qualidade.
            # cache_ttl=0 → NÃO cacheia (cada pergunta é única).
            resposta = groq.gerar(
                prompt=prompt,
                sistema=SYSTEM_PROMPT_CHAT,
                modelo="avancado",
                max_tokens=700,
                cache_ttl=0,
                empresa_id=str(empresa_id),
            )
            resposta = (resposta if isinstance(resposta, str) else str(resposta)).strip()
            if not resposta:
                raise ValueError("Resposta vazia da IA.")

            task_ia.status = "concluido"
            task_ia.resultado = resposta
            task_ia.concluido_em = datetime.now(tz=timezone.utc)
            task_ia.save(update_fields=["status", "resultado", "concluido_em"])

            # Sucesso: confirma o crédito já reservado.
            from modules.ai_hub.creditos import CreditosService
            CreditosService.confirmar(
                empresa_id, params.get("_credito_operacao", OPERACAO)
            )
            logger.info("Chat financeiro respondido (task %s)", task_ia_id)

        except Exception as exc:
            logger.error("Chat: erro na task %s — %s", task_ia_id, exc, exc_info=True)
            task_ia.status = "erro"
            task_ia.erro = str(exc)
            task_ia.concluido_em = datetime.now(tz=timezone.utc)
            task_ia.save(update_fields=["status", "erro", "concluido_em"])
            raise
