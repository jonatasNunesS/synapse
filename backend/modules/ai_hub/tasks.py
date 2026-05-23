"""
Synapse - AI Hub Tasks Celery
Tasks assíncronas para geração de conteúdo e insights via Groq.
"""
import logging
from datetime import datetime, timezone

from celery import shared_task
from django.core.cache import cache

logger = logging.getLogger("synapse")

# ─── Prompts por tipo ─────────────────────────────────────────────────────────

SYSTEM_PROMPT_BASE = (
    "Você é um assistente especialista em marketing e gestão empresarial para "
    "pequenos e médios empreendedores brasileiros. Responda sempre em português "
    "do Brasil, de forma direta, prática e sem enrolação. "
    "Contexto do negócio:\n{contexto}"
)

PROMPTS_TIPO = {
    "legenda_instagram": (
        "Crie {quantidade} legenda(s) para Instagram sobre o produto/serviço: '{produto}'. "
        "Tom: {tom}. "
        "Inclua emojis relevantes e call-to-action. "
        "Separe cada legenda com '---'."
    ),
    "titulo_produto": (
        "Crie {quantidade} título(s) otimizado(s) para o produto '{produto}' "
        "na plataforma {plataforma}. "
        "Foque em SEO e conversão. "
        "Separe cada título com '---'."
    ),
    "descricao_produto": (
        "Escreva uma descrição persuasiva para o produto '{produto}'. "
        "Público-alvo: {publico}. "
        "Diferenciais: {diferenciais}. "
        "Use bullets para os benefícios principais."
    ),
    "hashtags": (
        "Gere {quantidade} hashtags relevantes sobre o tema '{tema}'. "
        "Misture hashtags populares e de nicho. "
        "Formato: #hashtag1 #hashtag2 ..."
    ),
    "ideia_pauta": (
        "Sugira {quantidade} ideia(s) de pauta/conteúdo para {plataforma}. "
        "Baseie-se no contexto do negócio fornecido. "
        "Para cada ideia, inclua: título, gancho e formato sugerido."
    ),
    "email_marketing": (
        "Escreva um e-mail de marketing com assunto '{assunto}'. "
        "Objetivo: {objetivo}. "
        "Inclua: linha de assunto, pré-header, corpo e CTA."
    ),
    "relatorio_negocio": (
        "Com base nos dados do negócio fornecidos no contexto, "
        "gere um relatório executivo resumido do mês atual. "
        "Inclua: pontos positivos, alertas e 3 recomendações práticas."
    ),
    "insight": (
        "Analise os dados do negócio no contexto e forneça 3 insights "
        "acionáveis para melhorar o desempenho. "
        "Para cada insight: título, análise e ação recomendada."
    ),
    "outro": (
        "Responda à seguinte solicitação do empreendedor: {descricao}"
    ),
}


def _montar_prompt(tipo: str, parametros: dict) -> str:
    """Monta o prompt do usuário baseado no tipo e parâmetros."""
    template = PROMPTS_TIPO.get(tipo, PROMPTS_TIPO["outro"])
    try:
        return template.format(**parametros)
    except KeyError:
        return template


@shared_task(
    bind=True,
    name="ai_hub.gerar_conteudo_ia",
    max_retries=2,
    default_retry_delay=30,
)
def gerar_conteudo_ia(self, task_ia_id: str):
    """
    Task Celery para geração assíncrona de conteúdo via Groq.
    1. Busca TaskIA pelo ID
    2. Monta contexto do negócio
    3. Chama GroqClient
    4. Salva ConteudoGerado e atualiza TaskIA
    5. Incrementa contador de uso
    """
    from modules.ai_hub.models import TaskIA, ConteudoGerado
    from modules.ai_hub.services import AIHubService
    from infrastructure.ia.groq_client import GroqClient
    from core.interfaces.i_ia import IARequest

    try:
        task_ia = TaskIA.objects.get(pk=task_ia_id)
    except TaskIA.DoesNotExist:
        logger.error(f"TaskIA {task_ia_id} não encontrada.")
        return

    # Atualizar status para processando
    task_ia.status = "processando"
    task_ia.save(update_fields=["status"])

    try:
        empresa_id = task_ia.empresa_id
        parametros = task_ia.parametros
        tipo_conteudo = parametros.get("tipo_conteudo", "outro")

        # Montar contexto e prompt
        contexto = AIHubService.montar_contexto_negocio(empresa_id)
        prompt_usuario = _montar_prompt(tipo_conteudo, parametros)

        # Determinar modelo: avançado para relatório/insight, simples para o resto
        modelo_key = "avancado" if tipo_conteudo in ("relatorio_negocio", "insight") else "simples"

        system_prompt = SYSTEM_PROMPT_BASE.format(contexto=contexto)
        prompt_completo = f"{system_prompt}\n\n{prompt_usuario}"

        # Chamar GroqClient
        groq = GroqClient()
        response = groq.gerar(
            prompt=prompt_usuario,
            sistema=system_prompt,
            modelo=modelo_key,
            empresa_id=str(empresa_id),
        )

        modelo_nome = groq.MODELOS.get(modelo_key, modelo_key)
        tokens = getattr(response, "tokens_saida", 0) if hasattr(response, "tokens_saida") else 0
        resultado = response if isinstance(response, str) else str(response)

        # Salvar ConteudoGerado
        ConteudoGerado.objects.create(
            empresa_id=empresa_id,
            tipo=tipo_conteudo,
            prompt_usuario=prompt_usuario,
            prompt_completo=prompt_completo,
            resultado=resultado,
            modelo_usado=modelo_nome,
            tokens_usados=tokens,
        )

        # Incrementar uso mensal
        AIHubService.incrementar_uso(empresa_id)

        # Atualizar TaskIA como concluída
        task_ia.status = "concluido"
        task_ia.resultado = resultado
        task_ia.concluido_em = datetime.now(tz=timezone.utc)
        task_ia.save(update_fields=["status", "resultado", "concluido_em"])

        logger.info(
            f"AI Hub: conteúdo '{tipo_conteudo}' gerado para empresa {empresa_id} "
            f"(task {task_ia_id})"
        )

    except Exception as exc:
        logger.error(f"AI Hub: erro na task {task_ia_id} — {exc}", exc_info=True)
        task_ia.status = "erro"
        task_ia.erro = str(exc)
        task_ia.concluido_em = datetime.now(tz=timezone.utc)
        task_ia.save(update_fields=["status", "erro", "concluido_em"])
        raise self.retry(exc=exc)


@shared_task(
    name="ai_hub.gerar_insights_semanais",
    bind=True,
    max_retries=1,
)
def gerar_insights_semanais(self):
    """
    Task semanal (domingo 08h) que gera insights automáticos
    para todas as empresas ativas com plano pro/business/enterprise.
    """
    from modules.auth.models import Empresa
    from modules.ai_hub.services import AIHubService
    from infrastructure.ia.groq_client import GroqClient
    from modules.ai_hub.models import ConteudoGerado

    empresas = Empresa.objects.filter(
        plano_ativo=True,
        plano__in=["pro", "business", "enterprise"],
    )

    logger.info(f"AI Hub: gerando insights semanais para {empresas.count()} empresas.")

    for empresa in empresas:
        try:
            contexto = AIHubService.montar_contexto_negocio(empresa.id)
            prompt = (
                "Analise os dados do negócio e forneça 3 insights acionáveis "
                "para melhorar o desempenho desta semana. "
                "Para cada insight: título, análise e ação recomendada."
            )
            system_prompt = SYSTEM_PROMPT_BASE.format(contexto=contexto)

            groq = GroqClient()
            resultado = groq.gerar(
                prompt=prompt,
                sistema=system_prompt,
                modelo="avancado",
                empresa_id=str(empresa.id),
            )

            resultado_str = resultado if isinstance(resultado, str) else str(resultado)

            ConteudoGerado.objects.create(
                empresa=empresa,
                tipo="insight",
                prompt_usuario=prompt,
                prompt_completo=f"{system_prompt}\n\n{prompt}",
                resultado=resultado_str,
                modelo_usado=groq.MODELOS["avancado"],
                tokens_usados=0,
            )

            # Invalidar cache do insight
            cache.delete(f"synapse:ai:insight:{empresa.id}")

            logger.info(f"AI Hub: insight semanal gerado para empresa {empresa.nome}")

        except Exception as e:
            logger.error(
                f"AI Hub: erro ao gerar insight para empresa {empresa.nome} — {e}",
                exc_info=True,
            )
