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
    """Cria notificação de vencimento para todos os admins da empresa."""
    from modules.notificacoes.services import NotificacaoService

    try:
        dias_restantes = (lancamento.data_vencimento - hoje).days
        if dias_restantes == 0:
            titulo = f"Lançamento vence HOJE"
            mensagem = f"O lançamento '{lancamento.descricao}' de R${lancamento.valor} vence hoje."
            prioridade = "urgente"
        else:
            titulo = f"Lançamento vence amanhã"
            mensagem = f"O lançamento '{lancamento.descricao}' de R${lancamento.valor} vence amanhã."
            prioridade = "alta"

        NotificacaoService.criar_para_empresa(
            empresa_id=str(lancamento.empresa_id),
            tipo="financeiro",
            titulo=titulo,
            mensagem=mensagem,
            acao_url="/financeiro",
            prioridade=prioridade,
        )
        logger.info(
            "Notificação de vencimento criada",
            extra={"empresa_id": str(lancamento.empresa_id), "lancamento_id": str(lancamento.id)},
        )
    except Exception as e:
        logger.warning(f"Erro ao criar notificação de vencimento: {e}")


@shared_task(name="financeiro.verificar_emprestimos", bind=True, max_retries=3)
def verificar_emprestimos(self):
    """
    Roda todo dia às 00:10 (beat_schedule). Para cada empréstimo aberto cujo
    retorno já chegou (data_retorno_esperado <= hoje), cria UMA notificação no
    sino se ainda não houver uma pendente para o dia. Idempotente e multi-tenant.
    """
    from .repository import FinanceiroRepository

    hoje = date.today()
    criadas = 0
    try:
        for emp in FinanceiroRepository.listar_emprestimos_a_notificar():
            try:
                if _criar_notificacao_emprestimo(emp, hoje):
                    criadas += 1
            except Exception as e:
                logger.warning(f"Falha ao notificar empréstimo {emp.id}: {e}")

        logger.info(
            "Task verificar_emprestimos concluída",
            extra={"data": str(hoje), "notificacoes_criadas": criadas},
        )
        return {"status": "ok", "data": str(hoje), "notificacoes_criadas": criadas}
    except Exception as exc:
        logger.error(f"Erro na task verificar_emprestimos: {exc}")
        raise self.retry(exc=exc, countdown=300)


def _criar_notificacao_emprestimo(emp, hoje: date) -> bool:
    """
    Cria notificação de retorno de empréstimo (idempotente por dia via marcador
    na acao_url). Retorna True se criou, False se já existia.
    """
    from modules.notificacoes.models import Notificacao

    # Marcador único por empréstimo — permite navegar e serve de chave de idempotência
    marcador = f"/financeiro/emprestimos?destaque={emp.id}"

    # Idempotência: não duplica notificação pendente (não lida) do mesmo empréstimo
    ja_existe = Notificacao.objects.filter(
        empresa_id=emp.empresa_id,
        acao_url=marcador,
        lida=False,
    ).exists()
    if ja_existe:
        return False

    valor_fmt = f"R$ {emp.valor:.2f}"
    pessoa = emp.pessoa_emprestimo or "alguém"
    if emp.direcao_emprestimo == "emprestei":
        titulo = "Empréstimo a receber"
        mensagem = f"{pessoa} ficou de devolver {valor_fmt} hoje. Recebeu?"
    else:
        titulo = "Empréstimo a devolver"
        mensagem = f"Você ficou de devolver {valor_fmt} pro/pra {pessoa} hoje."

    # Notifica o dono do empréstimo (quem registrou); se não houver, os admins.
    if emp.criado_por_id:
        Notificacao.objects.create(
            usuario_id=emp.criado_por_id,
            empresa_id=emp.empresa_id,
            tipo="financeiro",
            titulo=titulo,
            mensagem=mensagem,
            acao_url=marcador,
            prioridade="alta",
        )
        return True

    from modules.notificacoes.services import NotificacaoService
    NotificacaoService.criar_para_empresa(
        empresa_id=str(emp.empresa_id),
        tipo="financeiro",
        titulo=titulo,
        mensagem=mensagem,
        acao_url=marcador,
        prioridade="alta",
    )
    return True


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
