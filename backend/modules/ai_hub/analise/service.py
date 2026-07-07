"""
Synapse — AI Hub / Análise Financeira: orquestração.

Reaproveita a infra de IA (TaskIA + polling + GroqClient) e o controle de uso
do AIHubService. Os números-chave são computados por nós (dados reais); a IA só
produz diagnóstico + recomendações.
"""
import json
import logging
from datetime import date, datetime, timezone

from django.core.cache import cache

from modules.ai_hub.models import TaskIA

from .context import montar_contexto_financeiro
from .prompts import (
    SYSTEM_PROMPT_FINANCEIRO,
    _fmt,
    montar_prompt_usuario,
    parse_resposta,
)

logger = logging.getLogger("synapse")

CACHE_TTL = 3 * 60 * 60  # 3 horas — os números do mês não mudam a cada minuto


class AnaliseFinanceiraService:
    """Orquestra a Análise Financeira via IA."""

    # ── Cache ────────────────────────────────────────────────────────────────
    @staticmethod
    def _cache_key(empresa_id, mes: int, ano: int) -> str:
        return f"synapse:{empresa_id}:ai:analise_financeira:{ano}-{mes:02d}"

    # ── Números-chave (computados dos dados reais, não da IA) ────────────────
    @staticmethod
    def _numeros_chave(ctx: dict) -> list[dict]:
        a, d = ctx["atual"], ctx["deltas"]

        def var(pct):
            return f"{pct:+.1f}%" if pct is not None else None

        return [
            {"label": "Receita", "valor": _fmt(a["receita"]), "variacao": var(d["receita_pct"])},
            {"label": "Despesa", "valor": _fmt(a["despesa"]), "variacao": var(d["despesa_pct"])},
            {"label": "Saldo do mês", "valor": _fmt(a["saldo"]), "variacao": None},
            {"label": "Lucro bruto", "valor": _fmt(a["lucro"]), "variacao": f"{a['margem']:.1f}% margem"},
            {"label": "Atrasados", "valor": _fmt(a["atrasado_valor"]), "variacao": f"{a['atrasado_qtd']} conta(s)"},
            {"label": "A receber", "valor": _fmt(a["a_receber"]), "variacao": None},
            {"label": "Ticket médio", "valor": _fmt(a["ticket_medio"]), "variacao": f"{a['qtd_recebimentos']} recebimento(s)"},
        ]

    # ── Solicitação ──────────────────────────────────────────────────────────
    @staticmethod
    def solicitar(empresa_id, usuario_id, mes: int = None, ano: int = None) -> dict:
        """
        Retorna um dos estados:
        - {"status": "sem_dados", "message": ...}          (sem movimento no mês)
        - {"status": "concluido", "analise": {...}}        (cache quente)
        - {"status": "processando", "task_id": "...", ...} (disparou a IA)
        Levanta AILimitExceededError se o limite do plano foi atingido.
        """
        hoje = date.today()
        mes = mes or hoje.month
        ano = ano or hoje.year

        ctx = montar_contexto_financeiro(empresa_id, mes, ano)
        if not ctx["tem_dados"]:
            return {
                "status": "sem_dados",
                "message": (
                    "Ainda não há lançamentos financeiros suficientes neste mês "
                    "para gerar uma análise. Cadastre receitas e despesas no "
                    "Financeiro e volte aqui."
                ),
            }

        cached = cache.get(AnaliseFinanceiraService._cache_key(empresa_id, mes, ano))
        if cached:
            # Cache quente não gasta crédito (não chama a IA)
            return {"status": "concluido", "analise": cached}

        # Reserva os créditos ANTES de chamar a IA (rejeição na porta → 402)
        from modules.ai_hub.creditos import CreditosService

        operacao = "analise_financeira"
        CreditosService.reservar(empresa_id, operacao)

        task_ia = TaskIA.objects.create(
            empresa_id=empresa_id,
            tipo="analise",
            status="pendente",
            parametros={
                "analise": "financeira",
                "mes": mes,
                "ano": ano,
                "_credito_operacao": operacao,
            },
        )

        from modules.ai_hub.tasks import analisar_financeiro

        celery_task = analisar_financeiro.delay(str(task_ia.id))
        task_ia.task_id = celery_task.id
        task_ia.save(update_fields=["task_id"])

        return {"status": "processando", "task_id": str(task_ia.id)}

    # ── Execução (chamada pela task Celery) ──────────────────────────────────
    @staticmethod
    def executar(task_ia_id: str) -> None:
        """Monta contexto → chama Groq → salva análise estruturada na TaskIA."""
        from infrastructure.ia.groq_client import GroqClient

        try:
            task_ia = TaskIA.objects.get(pk=task_ia_id)
        except TaskIA.DoesNotExist:
            logger.error("Análise: TaskIA %s não encontrada.", task_ia_id)
            return

        task_ia.status = "processando"
        task_ia.save(update_fields=["status"])

        try:
            empresa_id = task_ia.empresa_id
            mes = task_ia.parametros.get("mes")
            ano = task_ia.parametros.get("ano")

            ctx = montar_contexto_financeiro(empresa_id, mes, ano)
            prompt = montar_prompt_usuario(ctx)

            groq = GroqClient()
            # Modelo avançado (70B): é análise, precisa de qualidade
            bruto = groq.gerar(
                prompt=prompt,
                sistema=SYSTEM_PROMPT_FINANCEIRO,
                modelo="avancado",
                max_tokens=1200,
                empresa_id=str(empresa_id),
            )
            parsed = parse_resposta(bruto if isinstance(bruto, str) else str(bruto))

            analise = {
                "periodo": ctx["periodo"],
                "numeros_chave": AnaliseFinanceiraService._numeros_chave(ctx),
                "diagnostico": parsed["diagnostico"],
                "recomendacoes": parsed["recomendacoes"],
                "modelo": groq.MODELOS["avancado"],
                "gerado_em": datetime.now(tz=timezone.utc).isoformat(),
            }

            task_ia.status = "concluido"
            task_ia.resultado = json.dumps(analise, ensure_ascii=False)
            task_ia.concluido_em = datetime.now(tz=timezone.utc)
            task_ia.save(update_fields=["status", "resultado", "concluido_em"])

            cache.set(
                AnaliseFinanceiraService._cache_key(empresa_id, mes, ano),
                analise,
                CACHE_TTL,
            )
            # Sucesso: confirma o crédito já reservado
            from modules.ai_hub.creditos import CreditosService
            CreditosService.confirmar(
                empresa_id, task_ia.parametros.get("_credito_operacao", "analise_financeira")
            )
            logger.info("Análise financeira concluída (task %s)", task_ia_id)

        except Exception as exc:
            logger.error("Análise: erro na task %s — %s", task_ia_id, exc, exc_info=True)
            task_ia.status = "erro"
            task_ia.erro = str(exc)
            task_ia.concluido_em = datetime.now(tz=timezone.utc)
            task_ia.save(update_fields=["status", "erro", "concluido_em"])
            raise
