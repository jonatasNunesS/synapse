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
    """
    if instance.status != "pago":
        return

    # Evitar recursão: usar update() direto no banco
    from django.db.models import F
    from modules.fornecedores.models import Fornecedor

    def _atualizar():
        fornecedor = Fornecedor.objects.select_for_update().get(pk=instance.fornecedor_id)

        # Recalcular totais a partir de todas as compras pagas
        from django.db.models import Sum, Max, Count
        from modules.fornecedores.models import CompraFornecedor

        agregado = CompraFornecedor.objects.filter(
            fornecedor_id=instance.fornecedor_id,
            status="pago",
        ).aggregate(
            total=Sum("valor"),
            quantidade=Count("id"),
            ultima=Max("data_compra"),
        )

        fornecedor.valor_total_compras = agregado["total"] or 0
        fornecedor.quantidade_pedidos = agregado["quantidade"] or 0
        fornecedor.ultima_compra = agregado["ultima"]
        fornecedor.save(update_fields=["valor_total_compras", "quantidade_pedidos", "ultima_compra"])

    try:
        transaction.on_commit(_atualizar)
    except Exception:
        # Se não estiver em transação, executar diretamente
        _atualizar()
