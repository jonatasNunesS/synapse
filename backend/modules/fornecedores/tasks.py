"""
M5 — Fornecedores: Tasks Celery
- Relatório semanal de fornecedores
- Alerta de fornecedores sem avaliação
- Limpeza de cache
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="fornecedores.relatorio_semanal")
def relatorio_semanal_fornecedores():
    """
    Toda segunda-feira: gera relatório semanal de compras por empresa.
    """
    from modules.auth.models import Empresa
    from modules.fornecedores.models import CompraFornecedor
    from django.db.models import Sum, Count

    empresas = Empresa.objects.filter(ativo=True)
    for empresa in empresas:
        try:
            inicio_semana = timezone.now().date() - timezone.timedelta(days=7)
            agg = CompraFornecedor.objects.filter(
                empresa=empresa,
                data_compra__gte=inicio_semana,
                status="pago",
            ).aggregate(
                total=Sum("valor"),
                quantidade=Count("id"),
            )
            logger.info(
                "[Fornecedores] Empresa %s — Semana: %s compras, R$%s",
                empresa.id,
                agg["quantidade"] or 0,
                agg["total"] or 0,
            )
        except Exception as exc:
            logger.error("[Fornecedores] Erro no relatório da empresa %s: %s", empresa.id, exc)

    return f"Relatório semanal gerado para {empresas.count()} empresas."


@shared_task(name="fornecedores.alertar_sem_avaliacao")
def alertar_fornecedores_sem_avaliacao():
    """
    Diariamente: identifica fornecedores ativos sem avaliação.
    Futuramente: envia notificação ao usuário admin da empresa.
    """
    from modules.fornecedores.models import Fornecedor

    sem_avaliacao = Fornecedor.objects.filter(
        ativo=True,
        status="ativo",
        score_synapse=0,
    ).values("empresa_id").annotate(
        from django.db.models import Count
    )

    # Simplificado: apenas log
    total = Fornecedor.objects.filter(ativo=True, status="ativo", score_synapse=0).count()
    logger.info("[Fornecedores] %d fornecedores ativos sem avaliação.", total)
    return f"{total} fornecedores sem avaliação."


@shared_task(name="fornecedores.limpar_cache")
def limpar_cache_fornecedores():
    """
    Diariamente: invalida cache de fornecedores para todas as empresas.
    Garante que dados não ficam desatualizados por mais de 24h.
    """
    from modules.auth.models import Empresa
    from shared.cache import invalidate_cache

    empresas = Empresa.objects.filter(ativo=True).values_list("id", flat=True)
    for empresa_id in empresas:
        try:
            invalidate_cache(empresa_id, "fornecedores")
        except Exception as exc:
            logger.warning("[Fornecedores] Erro ao limpar cache empresa %s: %s", empresa_id, exc)

    return f"Cache de fornecedores limpo para {len(empresas)} empresas."
