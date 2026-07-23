"""
M5 — Fornecedores: Signals
Signal pós-save em CompraFornecedor:
- Se status == pago: atualiza totais do fornecedor
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction


@receiver(post_save, sender="synapse_fornecedores.CompraFornecedor")
def atualizar_totais_fornecedor(sender, instance, created, **kwargs):
    """
    Ao salvar uma compra com status=pago, atualiza:
    - fornecedor.valor_total_compras
    - fornecedor.quantidade_pedidos
    - fornecedor.ultima_compra

    O recálculo roda em transaction.on_commit — ou seja, DEPOIS do commit, já
    fora de qualquer transação. Por isso o próprio _atualizar abre a sua atomic:
    sem ela, o select_for_update levantava TransactionManagementError no
    PostgreSQL (autocommit) e devolvia 500 ao salvar a compra já como "pago"
    — embora a compra tivesse sido gravada. No SQLite o bug não aparecia porque
    lá o select_for_update é no-op.
    """
    if instance.status != "pago":
        return

    fornecedor_id = instance.fornecedor_id

    def _atualizar():
        from django.db.models import Sum, Max, Count
        from modules.fornecedores.models import Fornecedor, CompraFornecedor

        # Abre a própria transação: o callback roda pós-commit, em autocommit,
        # e o select_for_update precisa de uma transação ativa.
        with transaction.atomic():
            fornecedor = Fornecedor.objects.select_for_update().get(pk=fornecedor_id)

            agregado = CompraFornecedor.objects.filter(
                fornecedor_id=fornecedor_id,
                status="pago",
            ).aggregate(
                total=Sum("valor"),
                quantidade=Count("id"),
                ultima=Max("data_compra"),
            )

            fornecedor.valor_total_compras = agregado["total"] or 0
            fornecedor.quantidade_pedidos = agregado["quantidade"] or 0
            fornecedor.ultima_compra = agregado["ultima"]
            fornecedor.save(
                update_fields=[
                    "valor_total_compras",
                    "quantidade_pedidos",
                    "ultima_compra",
                ]
            )

    # on_commit registra para rodar após o commit; se não houver transação
    # ativa, o Django executa na hora. Em ambos os casos _atualizar cuida da
    # sua própria atomicidade.
    transaction.on_commit(_atualizar)
