from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="synapse_clientes.InteracaoCliente")
def atualizar_cliente_apos_interacao(sender, instance, created, **kwargs):
    """
    Após salvar uma interação:
    - Se tipo == venda: recalcula os agregados de venda do cliente
      (valor_total_compras, valor_recebido, valor_a_receber, quantidade,
      última compra) a partir da verdade. Rodar em qualquer save (não só na
      criação) garante que mudanças de status_pagamento — confirmar (pago),
      cancelar (cancelado) — reflitam no split recebido/a-receber na hora.
    - Se proximo_followup definido (na criação): atualiza o do cliente.
    """
    from .models import Cliente
    from .repository import ClienteRepository

    # Vendas: recalcula sempre (criação, edição de valor, mudança de status).
    if instance.tipo == "venda":
        ClienteRepository._recalcular_agregados_venda(instance.cliente_id)

    # Follow-up: só faz sentido "puxar" para o cliente ao criar a interação.
    if created and instance.proximo_followup:
        Cliente.objects.filter(pk=instance.cliente_id).update(
            proximo_followup=instance.proximo_followup
        )
