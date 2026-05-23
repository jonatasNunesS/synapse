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
    from modules.notificacoes.services import NotificacaoService

    hoje = date.today()
    notificacoes_criadas = 0

    try:
        # Tarefas que vencem hoje
        vencendo_hoje = ProjetoRepository.listar_tarefas_vencendo_hoje()
        for tarefa in vencendo_hoje:
            if not tarefa.responsavel_id:
                continue
            try:
                NotificacaoService.criar_notificacao(
                    usuario_id=str(tarefa.responsavel_id),
                    empresa_id=str(tarefa.empresa_id),
                    tipo="projeto",
                    titulo=f"Tarefa vence hoje: {tarefa.titulo}",
                    mensagem=(
                        f"A tarefa '{tarefa.titulo}' vence hoje no projeto "
                        f"'{tarefa.projeto.nome}'."
                    ),
                    acao_url=f"/projetos/{tarefa.projeto_id}",
                    prioridade="alta",
                )
                notificacoes_criadas += 1
            except Exception as e:
                logger.warning(f"Falha ao notificar tarefa {tarefa.id}: {e}")

        # Tarefas atrasadas
        atrasadas = ProjetoRepository.listar_tarefas_atrasadas()
        for tarefa in atrasadas:
            if not tarefa.responsavel_id:
                continue
            try:
                dias_atraso = (hoje - tarefa.data_prazo).days
                NotificacaoService.criar_notificacao(
                    usuario_id=str(tarefa.responsavel_id),
                    empresa_id=str(tarefa.empresa_id),
                    tipo="projeto",
                    titulo=f"Tarefa atrasada: {tarefa.titulo}",
                    mensagem=(
                        f"A tarefa '{tarefa.titulo}' está atrasada ({dias_atraso} dia(s)) "
                        f"no projeto '{tarefa.projeto.nome}'."
                    ),
                    acao_url=f"/projetos/{tarefa.projeto_id}",
                    prioridade="urgente",
                )
                notificacoes_criadas += 1
            except Exception as e:
                logger.warning(f"Falha ao notificar tarefa atrasada {tarefa.id}: {e}")

        logger.info(
            "Task verificar_prazos_tarefas concluída",
            extra={"data": str(hoje), "notificacoes_criadas": notificacoes_criadas},
        )
        return {"status": "ok", "data": str(hoje), "notificacoes_criadas": notificacoes_criadas}

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
    from modules.notificacoes.services import NotificacaoService

    try:
        tarefa = (
            Tarefa.objects.select_related("projeto", "responsavel")
            .filter(id=tarefa_id)
            .first()
        )
        if not tarefa:
            logger.warning(f"Tarefa {tarefa_id} não encontrada para notificação.")
            return

        NotificacaoService.criar_notificacao(
            usuario_id=usuario_id,
            empresa_id=str(tarefa.empresa_id),
            tipo="projeto",
            titulo=f"Nova tarefa atribuída: {tarefa.titulo}",
            mensagem=(
                f"Você foi atribuído à tarefa '{tarefa.titulo}' "
                f"no projeto '{tarefa.projeto.nome}'."
            ),
            acao_url=f"/projetos/{tarefa.projeto_id}",
            prioridade="normal",
        )

        logger.info(
            "Notificação de atribuição de tarefa criada",
            extra={"tarefa_id": tarefa_id, "usuario_id": usuario_id},
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
    from modules.notificacoes.services import NotificacaoService

    hoje = date.today()
    notificacoes_criadas = 0

    try:
        projetos_atrasados = ProjetoRepository.listar_projetos_atrasados()

        for projeto in projetos_atrasados:
            try:
                dias_atraso = (hoje - projeto.data_prazo).days
                titulo = f"Projeto atrasado: {projeto.nome}"
                mensagem = (
                    f"O projeto '{projeto.nome}' está atrasado "
                    f"({dias_atraso} dia(s)). Prazo era {projeto.data_prazo}."
                )
                acao_url = f"/projetos/{projeto.id}"

                # Notificar criado_por
                if projeto.criado_por_id:
                    NotificacaoService.criar_notificacao(
                        usuario_id=str(projeto.criado_por_id),
                        empresa_id=str(projeto.empresa_id),
                        tipo="projeto",
                        titulo=titulo,
                        mensagem=mensagem,
                        acao_url=acao_url,
                        prioridade="alta",
                    )
                    notificacoes_criadas += 1

                # Notificar responsavel (se diferente do criado_por)
                if (
                    projeto.responsavel_id
                    and str(projeto.responsavel_id) != str(projeto.criado_por_id)
                ):
                    NotificacaoService.criar_notificacao(
                        usuario_id=str(projeto.responsavel_id),
                        empresa_id=str(projeto.empresa_id),
                        tipo="projeto",
                        titulo=titulo,
                        mensagem=mensagem,
                        acao_url=acao_url,
                        prioridade="alta",
                    )
                    notificacoes_criadas += 1

            except Exception as e:
                logger.warning(f"Falha ao notificar projeto atrasado {projeto.id}: {e}")

        logger.info(
            "Task verificar_projetos_atrasados concluída",
            extra={"data": str(hoje), "notificacoes_criadas": notificacoes_criadas},
        )
        return {"status": "ok", "data": str(hoje), "notificacoes_criadas": notificacoes_criadas}

    except Exception as exc:
        logger.error(f"Erro na task verificar_projetos_atrasados: {exc}")
        raise self.retry(exc=exc, countdown=300)
