"""
Synapse — Módulo Clientes: Tasks Celery
Tasks assíncronas para verificação de follow-ups.
"""
import logging
from celery import shared_task

logger = logging.getLogger("synapse")


@shared_task(name="clientes.verificar_followups", bind=True, max_retries=3)
def verificar_followups(self):
    """
    Roda todo dia às 8h30.
    Busca clientes com proximo_followup == hoje e cria notificação
    para o criado_por de cada cliente.
    """
    try:
        from modules.clientes.repository import ClienteRepository
        from modules.auth.models import Empresa
        from modules.notificacoes.services import NotificacaoService

        empresas = Empresa.objects.filter(ativo=True)
        total_notificacoes = 0

        for empresa in empresas:
            clientes_hoje = ClienteRepository.listar_followups_hoje(empresa.id)

            for cliente in clientes_hoje:
                if cliente.criado_por:
                    try:
                        NotificacaoService.criar_notificacao(
                            usuario_id=str(cliente.criado_por_id),
                            empresa_id=str(empresa.id),
                            tipo="cliente",
                            titulo=f"Follow-up hoje: {cliente.nome}",
                            mensagem=(
                                f"Você tem um follow-up agendado para hoje com o cliente "
                                f"'{cliente.nome}'. Não esqueça de entrar em contato!"
                            ),
                            acao_url=f"/clientes/{cliente.id}",
                            prioridade="normal",
                        )
                        total_notificacoes += 1
                    except Exception as e:
                        logger.warning(f"Falha ao criar notificação de follow-up para {cliente.id}: {e}")

        logger.info(
            "verificar_followups concluído: %d notificações criadas.",
            total_notificacoes,
        )
        return {"total_followups_hoje": total_notificacoes}

    except Exception as exc:
        logger.error("Erro em verificar_followups: %s", exc)
        raise self.retry(exc=exc, countdown=60)


@shared_task(name="clientes.alertar_followups_atrasados", bind=True, max_retries=3)
def alertar_followups_atrasados(self):
    """
    Roda todo dia às 9h.
    Busca clientes com proximo_followup < hoje e cria 1 notificação
    por empresa agrupando todos os clientes atrasados.
    """
    try:
        from modules.clientes.repository import ClienteRepository
        from modules.auth.models import Empresa
        from modules.notificacoes.services import NotificacaoService

        empresas = Empresa.objects.filter(ativo=True)
        total_alertas = 0

        for empresa in empresas:
            clientes_atrasados = list(
                ClienteRepository.listar_followups_atrasados(empresa.id)
            )

            if clientes_atrasados:
                nomes = ", ".join(c.nome for c in clientes_atrasados[:5])
                extras = len(clientes_atrasados) - 5
                mensagem = (
                    f"{len(clientes_atrasados)} follow-up(s) atrasado(s): {nomes}"
                )
                if extras > 0:
                    mensagem += f" e mais {extras}."

                try:
                    NotificacaoService.criar_para_empresa(
                        empresa_id=str(empresa.id),
                        tipo="cliente",
                        titulo=f"{len(clientes_atrasados)} follow-up(s) atrasado(s)",
                        mensagem=mensagem,
                        acao_url="/clientes",
                        prioridade="alta",
                    )
                    total_alertas += 1
                except Exception as e:
                    logger.warning(f"Falha ao criar notificação de follow-ups atrasados para empresa {empresa.id}: {e}")

        logger.info(
            "alertar_followups_atrasados concluído: %d empresas com alertas.",
            total_alertas,
        )
        return {"empresas_com_alertas": total_alertas}

    except Exception as exc:
        logger.error("Erro em alertar_followups_atrasados: %s", exc)
        raise self.retry(exc=exc, countdown=60)
