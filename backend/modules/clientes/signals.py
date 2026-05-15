from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="synapse_clientes.InteracaoCliente")
def atualizar_cliente_apos_interacao(sender, instance, created, **kwargs):
    """
    Após salvar uma interação:
    - Se tipo == venda e valor: atualiza valor_total_compras, quantidade_compras e ultima_compra
    - Se proximo_followup definido: atualiza proximo_followup do cliente
    """
    if not created:
        return  # Só processa na criação

    # Força o carregamento do cliente do banco (evita cache de instância desatualizada)
    from .models import Cliente
    try:
        cliente = Cliente.objects.get(pk=instance.cliente_id)
    except Cliente.DoesNotExist:
        return

    atualizado = False

    if instance.tipo == "venda" and instance.valor:
        cliente.valor_total_compras = (
            (cliente.valor_total_compras or 0) + instance.valor
        )
        cliente.quantidade_compras = (cliente.quantidade_compras or 0) + 1
        cliente.ultima_compra = instance.data_interacao.date()
        atualizado = True

    if instance.proximo_followup:
        cliente.proximo_followup = instance.proximo_followup
        atualizado = True

    if atualizado:
        # Usar update_fields para evitar recursão de signals
        update_fields = []
        if instance.tipo == "venda" and instance.valor:
            update_fields.extend(
                ["valor_total_compras", "quantidade_compras", "ultima_compra"]
            )
        if instance.proximo_followup:
            update_fields.append("proximo_followup")

        if update_fields:
            type(cliente).objects.filter(pk=cliente.pk).update(
                **{field: getattr(cliente, field) for field in update_fields}
            )
