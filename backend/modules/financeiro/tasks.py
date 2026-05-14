"""
Synapse — Módulo Financeiro: Tasks Celery
Tasks assíncronas para verificação de vencimentos e recorrências.
"""
import logging
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

from celery import shared_task

logger = logging.getLogger("synapse")


@shared_task(name="financeiro.verificar_vencimentos", bind=True, max_retries=3)
def verificar_vencimentos(self):
    """
    Roda todo dia às 8h (configurado no beat_schedule).
    1. Atualiza lançamentos pendentes vencidos → atrasado
    2. Cria notificações para lançamentos vencendo hoje ou amanhã
    """
    from .models import Lancamento
    from .repository import FinanceiroRepository

    hoje = date.today()
    processados = 0
    notificacoes_criadas = 0

    try:
        # ── 1. Atualizar vencidos para "atrasado" ────────────
        vencidos = FinanceiroRepository.listar_lancamentos_vencidos()
        ids_vencidos = list(vencidos.values_list("id", flat=True))

        if ids_vencidos:
            count = FinanceiroRepository.atualizar_status_em_lote(ids_vencidos, "atrasado")
            processados = count
            logger.info(
                f"Vencimentos: {count} lançamentos atualizados para 'atrasado'",
                extra={"data": str(hoje), "count": count},
            )

        # ── 2. Notificações para vencendo hoje/amanhã ────────
        vencendo = FinanceiroRepository.listar_vencendo_hoje_amanha()

        for lancamento in vencendo:
            try:
                _criar_notificacao_vencimento(lancamento, hoje)
                notificacoes_criadas += 1
            except Exception as e:
                logger.warning(
                    f"Falha ao criar notificação para lançamento {lancamento.id}: {e}"
                )

        logger.info(
            "Task verificar_vencimentos concluída",
            extra={
                "data": str(hoje),
                "vencidos_atualizados": processados,
                "notificacoes_criadas": notificacoes_criadas,
            },
        )

        return {
            "status": "ok",
            "data": str(hoje),
            "vencidos_atualizados": processados,
            "notificacoes_criadas": notificacoes_criadas,
        }

    except Exception as exc:
        logger.error(f"Erro na task verificar_vencimentos: {exc}")
        raise self.retry(exc=exc, countdown=300)  # retry em 5 min


def _criar_notificacao_vencimento(lancamento, hoje: date) -> None:
    """Cria notificação de vencimento para o responsável da empresa."""
    try:
        # Módulo de notificações será implementado no M7
        # Por ora, apenas loga
        dias_restantes = (lancamento.data_vencimento - hoje).days
        if dias_restantes == 0:
            msg = f"Lançamento '{lancamento.descricao}' vence HOJE (R${lancamento.valor})"
        else:
            msg = f"Lançamento '{lancamento.descricao}' vence amanhã (R${lancamento.valor})"

        logger.info(
            "Notificação de vencimento",
            extra={
                "empresa_id": str(lancamento.empresa_id),
                "lancamento_id": str(lancamento.id),
                "mensagem": msg,
                "dias_restantes": dias_restantes,
            },
        )
    except Exception as e:
        logger.warning(f"Erro ao criar notificação: {e}")


@shared_task(name="financeiro.criar_recorrencias", bind=True, max_retries=3)
def criar_recorrencias(self, lancamento_id: str):
    """
    Cria cópias do lançamento recorrente para os próximos 11 meses.
    Chamado após a criação de um lançamento recorrente.
    """
    from .models import Lancamento

    try:
        lancamento = Lancamento.objects.get(id=lancamento_id)
    except Lancamento.DoesNotExist:
        logger.error(f"Lançamento {lancamento_id} não encontrado para criar recorrências.")
        return

    if not lancamento.recorrente or not lancamento.recorrencia:
        logger.warning(f"Lançamento {lancamento_id} não é recorrente. Ignorando.")
        return

    criados = 0
    data_base = lancamento.data_vencimento

    for i in range(1, 12):  # próximos 11 períodos
        if lancamento.recorrencia == "mensal":
            nova_data = data_base + relativedelta(months=i)
        elif lancamento.recorrencia == "semanal":
            nova_data = data_base + timedelta(weeks=i)
        elif lancamento.recorrencia == "anual":
            nova_data = data_base + relativedelta(years=i)
        else:
            break

        Lancamento.objects.create(
            empresa_id=lancamento.empresa_id,
            tipo=lancamento.tipo,
            descricao=lancamento.descricao,
            valor=lancamento.valor,
            categoria=lancamento.categoria,
            data_vencimento=nova_data,
            status="pendente",
            recorrente=False,  # cópias não são recorrentes
            recorrencia="",
            observacoes=f"[Recorrência de {lancamento.id}] {lancamento.observacoes}".strip(),
            criado_por=lancamento.criado_por,
        )
        criados += 1

    logger.info(
        f"Recorrências criadas: {criados} cópias do lançamento {lancamento_id}",
        extra={
            "lancamento_id": lancamento_id,
            "recorrencia": lancamento.recorrencia,
            "criados": criados,
        },
    )

    return {"status": "ok", "lancamento_id": lancamento_id, "criados": criados}
