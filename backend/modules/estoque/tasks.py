import logging

from celery import shared_task
from django.db.models import F

logger = logging.getLogger(__name__)


@shared_task(name="estoque.verificar_estoque_minimo", bind=True, max_retries=3)
def verificar_estoque_minimo(self):
    """
    Roda todo dia às 7h.
    Busca todos os produtos abaixo do mínimo e cria notificações para o admin.
    """
    try:
        from modules.estoque.models import Produto

        produtos_criticos = Produto.objects.filter(
            ativo=True,
            estoque_atual__lte=F("estoque_minimo"),
        ).select_related("empresa")

        total_alertas = 0
        empresas_notificadas = set()

        for produto in produtos_criticos:
            empresa_id = str(produto.empresa_id)

            # Evitar múltiplas notificações para a mesma empresa no mesmo lote
            chave = f"{empresa_id}:{produto.id}"
            if chave in empresas_notificadas:
                continue
            empresas_notificadas.add(chave)

            status = "zerado" if produto.esta_sem_estoque else "baixo"
            logger.info(
                f"Alerta estoque {status}: {produto.nome} | "
                f"Atual: {produto.estoque_atual} | Mínimo: {produto.estoque_minimo} | "
                f"Empresa: {empresa_id}"
            )
            total_alertas += 1

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

        produto = Produto.objects.select_related("empresa").get(id=produto_id)

        status = "zerado" if produto.esta_sem_estoque else "abaixo do mínimo"

        logger.warning(
            f"ALERTA CRÍTICO: Produto '{produto.nome}' está {status}. "
            f"Estoque atual: {produto.estoque_atual} | "
            f"Mínimo: {produto.estoque_minimo} | "
            f"Empresa: {produto.empresa.nome}"
        )

        # Aqui seria criada uma Notificacao (M7)
        # Por ora, apenas log estruturado
        return {
            "produto_id": produto_id,
            "produto_nome": produto.nome,
            "estoque_atual": float(produto.estoque_atual),
            "estoque_minimo": float(produto.estoque_minimo),
            "status": status,
        }

    except Exception as exc:
        logger.error(f"Erro em alertar_estoque_critico: {exc}")
        raise self.retry(exc=exc, countdown=30)
