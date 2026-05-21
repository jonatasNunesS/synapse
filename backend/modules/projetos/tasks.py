"""
Synapse — M6: Tasks Celery do módulo Projetos e Tarefas.
Todas as operações assíncronas e agendadas do módulo.
"""
import logging
from datetime import date

from celery import shared_task

logger = logging.getLogger("synapse")


@shared_task(name="projetos.verificar_prazos_tarefas", bind=True, max_retries=3)
def verificar_prazos_tarefas(self):
    """
    Roda todo dia às 8h (crontab).
    - Notifica responsáveis de tarefas que vencem hoje
    - Notifica responsáveis de tarefas atrasadas
    """
    from .repository import ProjetoRepository

    hoje = date.today()
    notificacoes_criadas = 0

    try:
        # Tarefas que vencem hoje
        vencendo_hoje = ProjetoRepository.listar_tarefas_vencendo_hoje()
        for tarefa in vencendo_hoje:
            try:
                _criar_notificacao_tarefa(
                    tarefa=tarefa,
                    mensagem=f"Tarefa '{tarefa.titulo}' vence hoje no projeto '{tarefa.projeto.nome}'",
                )
                notificacoes_criadas += 1
            except Exception as e:
                logger.warning(f"Falha ao notificar tarefa {tarefa.id}: {e}")

        # Tarefas atrasadas
        atrasadas = ProjetoRepository.listar_tarefas_atrasadas()
        for tarefa in atrasadas:
            try:
                dias_atraso = (hoje - tarefa.data_prazo).days
                _criar_notificacao_tarefa(
                    tarefa=tarefa,
                    mensagem=(
                        f"Tarefa '{tarefa.titulo}' está atrasada "
                        f"({dias_atraso} dia(s)) no projeto '{tarefa.projeto.nome}'"
                    ),
                )
                notificacoes_criadas += 1
            except Exception as e:
                logger.warning(f"Falha ao notificar tarefa atrasada {tarefa.id}: {e}")

        logger.info(
            "Task verificar_prazos_tarefas concluída",
            extra={
                "data": str(hoje),
                "notificacoes_criadas": notificacoes_criadas,
            },
        )
        return {
            "status": "ok",
            "data": str(hoje),
            "notificacoes_criadas": notificacoes_criadas,
        }

    except Exception as exc:
        logger.error(f"Erro na task verificar_prazos_tarefas: {exc}")
        raise self.retry(exc=exc, countdown=300)


@shared_task(name="projetos.notificar_responsavel_tarefa", bind=True, max_retries=3)
def notificar_responsavel_tarefa(self, tarefa_id: str, usuario_id: str):
    """
    Disparada ao criar/atualizar tarefa com responsável.
    Cria notificação: "Você foi atribuído à tarefa '{titulo}' no projeto '{projeto}'"
    """
    from .models import Tarefa

    try:
        tarefa = (
            Tarefa.objects.select_related("projeto", "responsavel")
            .filter(id=tarefa_id)
            .first()
        )
        if not tarefa:
            logger.warning(f"Tarefa {tarefa_id} não encontrada para notificação.")
            return

        mensagem = (
            f"Você foi atribuído à tarefa '{tarefa.titulo}' "
            f"no projeto '{tarefa.projeto.nome}'"
        )

        _criar_notificacao_usuario(
            empresa_id=str(tarefa.empresa_id),
            usuario_id=usuario_id,
            mensagem=mensagem,
            tipo="tarefa_atribuida",
            referencia_id=tarefa_id,
        )

        logger.info(
            "Notificação de atribuição de tarefa criada",
            extra={
                "tarefa_id": tarefa_id,
                "usuario_id": usuario_id,
                "mensagem": mensagem,
            },
        )
        return {"status": "ok", "tarefa_id": tarefa_id, "usuario_id": usuario_id}

    except Exception as exc:
        logger.error(f"Erro na task notificar_responsavel_tarefa: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(name="projetos.verificar_projetos_atrasados", bind=True, max_retries=3)
def verificar_projetos_atrasados(self):
    """
    Roda todo dia às 9h.
    Notifica criado_por e responsavel de projetos com prazo vencido.
    """
    from .repository import ProjetoRepository

    hoje = date.today()
    notificacoes_criadas = 0

    try:
        projetos_atrasados = ProjetoRepository.listar_projetos_atrasados()

        for projeto in projetos_atrasados:
            try:
                dias_atraso = (hoje - projeto.data_prazo).days
                mensagem = (
                    f"Projeto '{projeto.nome}' está atrasado "
                    f"({dias_atraso} dia(s)). Prazo era {projeto.data_prazo}."
                )

                # Notificar criado_por
                if projeto.criado_por_id:
                    _criar_notificacao_usuario(
                        empresa_id=str(projeto.empresa_id),
                        usuario_id=str(projeto.criado_por_id),
                        mensagem=mensagem,
                        tipo="projeto_atrasado",
                        referencia_id=str(projeto.id),
                    )
                    notificacoes_criadas += 1

                # Notificar responsavel (se diferente do criado_por)
                if (
                    projeto.responsavel_id
                    and str(projeto.responsavel_id) != str(projeto.criado_por_id)
                ):
                    _criar_notificacao_usuario(
                        empresa_id=str(projeto.empresa_id),
                        usuario_id=str(projeto.responsavel_id),
                        mensagem=mensagem,
                        tipo="projeto_atrasado",
                        referencia_id=str(projeto.id),
                    )
                    notificacoes_criadas += 1

            except Exception as e:
                logger.warning(f"Falha ao notificar projeto atrasado {projeto.id}: {e}")

        logger.info(
            "Task verificar_projetos_atrasados concluída",
            extra={
                "data": str(hoje),
                "notificacoes_criadas": notificacoes_criadas,
            },
        )
        return {
            "status": "ok",
            "data": str(hoje),
            "notificacoes_criadas": notificacoes_criadas,
        }

    except Exception as exc:
        logger.error(f"Erro na task verificar_projetos_atrasados: {exc}")
        raise self.retry(exc=exc, countdown=300)


# ── Helpers internos ──────────────────────────────────────────

def _criar_notificacao_tarefa(tarefa, mensagem: str) -> None:
    """Cria notificação para o responsável da tarefa."""
    if not tarefa.responsavel_id:
        return
    _criar_notificacao_usuario(
        empresa_id=str(tarefa.empresa_id),
        usuario_id=str(tarefa.responsavel_id),
        mensagem=mensagem,
        tipo="prazo_tarefa",
        referencia_id=str(tarefa.id),
    )


def _criar_notificacao_usuario(
    empresa_id: str,
    usuario_id: str,
    mensagem: str,
    tipo: str,
    referencia_id: str = None,
) -> None:
    """
    Cria notificação para um usuário.
    Módulo de notificações será implementado no M7.
    Por ora, apenas loga a notificação.
    """
    logger.info(
        "Notificação gerada",
        extra={
            "empresa_id": empresa_id,
            "usuario_id": usuario_id,
            "mensagem": mensagem,
            "tipo": tipo,
            "referencia_id": referencia_id,
        },
    )
