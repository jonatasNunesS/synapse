"""
Synapse — Módulo Estoque: Tasks Celery
Tasks assíncronas para verificação de estoque mínimo e alertas críticos.
"""
import logging

from celery import shared_task
from django.db.models import F

logger = logging.getLogger("synapse")


@shared_task(name="estoque.verificar_estoque_minimo", bind=True, max_retries=3)
def verificar_estoque_minimo(self):
    """
    Roda todo dia às 7h.
    Busca todos os produtos abaixo do mínimo e cria notificações para o admin.
    """
    try:
        from modules.estoque.models import Produto
        from modules.notificacoes.services import NotificacaoService

        produtos_criticos = Produto.objects.filter(
            ativo=True,
            estoque_atual__lte=F("estoque_minimo"),
        ).select_related("empresa")

        total_alertas = 0
        processados = set()

        for produto in produtos_criticos:
            empresa_id = str(produto.empresa_id)
            chave = f"{empresa_id}:{produto.id}"
            if chave in processados:
                continue
            processados.add(chave)

            status_txt = "zerado" if produto.esta_sem_estoque else "abaixo do mínimo"
            titulo = f"Estoque {status_txt}: {produto.nome}"
            mensagem = (
                f"O produto '{produto.nome}' está com estoque {status_txt}. "
                f"Atual: {produto.estoque_atual} | Mínimo: {produto.estoque_minimo}."
            )
            try:
                NotificacaoService.criar_para_empresa(
                    empresa_id=empresa_id,
                    tipo="estoque",
                    titulo=titulo,
                    mensagem=mensagem,
                    acao_url="/estoque",
                    prioridade="alta",
                )
                total_alertas += 1
            except Exception as e:
                logger.warning(f"Falha ao criar notificação de estoque para {produto.id}: {e}")

        logger.info(f"verificar_estoque_minimo: {total_alertas} alertas gerados.")
        return {"alertas_gerados": total_alertas}

    except Exception as exc:
        logger.error(f"Erro em verificar_estoque_minimo: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(name="estoque.alertar_estoque_critico", bind=True, max_retries=3)
def alertar_estoque_critico(self, produto_id: str):
    """
    Disparada imediatamente após movimentação que deixa estoque crítico.
    Cria notificação urgente para o admin da empresa.
    """
    try:
        from modules.estoque.models import Produto
        from modules.notificacoes.services import NotificacaoService

        produto = Produto.objects.select_related("empresa").get(id=produto_id)
        status_txt = "zerado" if produto.esta_sem_estoque else "abaixo do mínimo"

        NotificacaoService.criar_para_empresa(
            empresa_id=str(produto.empresa_id),
            tipo="estoque",
            titulo=f"URGENTE: Estoque {status_txt} — {produto.nome}",
            mensagem=(
                f"O produto '{produto.nome}' está com estoque {status_txt}. "
                f"Atual: {produto.estoque_atual} | Mínimo: {produto.estoque_minimo}. "
                f"Reposição imediata necessária."
            ),
            acao_url="/estoque",
            prioridade="urgente",
        )

        logger.warning(
            f"ALERTA CRÍTICO: Produto '{produto.nome}' está {status_txt}. "
            f"Estoque atual: {produto.estoque_atual} | Mínimo: {produto.estoque_minimo}"
        )

        return {
            "produto_id": produto_id,
            "produto_nome": produto.nome,
            "estoque_atual": float(produto.estoque_atual),
            "estoque_minimo": float(produto.estoque_minimo),
            "status": status_txt,
        }

    except Exception as exc:
        logger.error(f"Erro em alertar_estoque_critico: {exc}")
        raise self.retry(exc=exc, countdown=30)
