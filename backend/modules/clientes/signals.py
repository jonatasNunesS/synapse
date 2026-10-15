from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="synapse_clientes.InteracaoCliente")
def atualizar_cliente_apos_interacao(sender, instance, created, **kwargs):
    """
    Ao criar uma interação com follow-up, o cliente passa a ter esse follow-up.

    O QUE SAIU DAQUI, E POR QUÊ. Este signal também recalculava os agregados
    de compra do cliente quando a interação era do tipo "venda". Era a única
    coisa que os alimentava — e foi por isso que uma `Venda`, criada noutro
    módulo, deixava o cliente marcando R$ 0,00 (o B10): o gatilho estava preso
    a uma entidade, a outra nasceu longe dele, e nada reclamou.

    Os agregados agora saem de `ClienteRepository.recalcular_agregados_cliente`,
    que lê `Venda` e é chamada explicitamente pelo service de venda, dentro da
    mesma transação da escrita. O docstring de lá explica a escolha.

    O follow-up fica, porque aqui ele é o que de fato é: um efeito de ter
    registrado a conversa, no mesmo módulo em que a conversa é registrada.
    """
    if created and instance.proximo_followup:
        from .models import Cliente

        Cliente.objects.filter(pk=instance.cliente_id).update(
            proximo_followup=instance.proximo_followup
        )
