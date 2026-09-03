"""
A guarda de rollout do fiado: nenhuma venda que já existia é cobrada.

`notificacao_enviada` nasce False, e a tarefa diária notifica toda venda
pendente cuja previsão já chegou. Sem esta migração, ligar o fiado faria a
primeira execução varrer o passado e despejar de uma vez a cobrança de toda
venda antiga — entre elas as 22 que a fase 2 migrou, uma delas com o status
convertido de "cancelado" para "pendente" justamente porque não havia
equivalente. Cobrar por causa dessa conversão seria cobrar por um detalhe de
migração, não por uma dívida.

Marcar o que já existe como avisado é o corte: daqui para a frente, notifica;
para trás, não. Quem quiser cobrar uma venda antiga tem a tela — adiar rearma
a notificação, e é uma decisão de quem cobra, não um efeito de deploy.
"""
from django.db import migrations


def marcar_existentes_como_avisadas(apps, schema_editor):
    Venda = apps.get_model("synapse_vendas", "Venda")
    Venda.objects.update(notificacao_enviada=True)


def desmarcar(apps, schema_editor):
    # A volta devolve todas ao estado de "ainda não avisada". É o que o campo
    # significa por padrão; nada além disso é recuperável.
    Venda = apps.get_model("synapse_vendas", "Venda")
    Venda.objects.update(notificacao_enviada=False)


class Migration(migrations.Migration):

    dependencies = [
        ("synapse_vendas", "0004_fiado"),
    ]

    operations = [
        migrations.RunPython(marcar_existentes_como_avisadas, desmarcar),
    ]
