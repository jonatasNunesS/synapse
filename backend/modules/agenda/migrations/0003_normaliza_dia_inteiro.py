"""
Conserta os eventos "dia inteiro" que ficaram com hora torta.

Até a correção do AG-03, marcar "dia inteiro" não mexia nos campos de hora: um
evento "dia inteiro das 14h às 15h" era gravado assim mesmo. A tela sempre
ignorou essa hora — o calendário desenhava na faixa de dia inteiro e o detalhe
imprimia "Dia inteiro" —, então o que esta migração apaga é informação que
nunca foi mostrada a ninguém e que o próprio campo declara sem sentido.

Só toca em eventos com `dia_inteiro=True`. Os demais não são assunto aqui.

Sem reversão real: os horários originais não são guardados em lugar nenhum. O
reverso é no-op de propósito, porque desnormalizar significaria inventar uma
hora que ninguém escolheu.
"""
from django.db import migrations


def normalizar(apps, schema_editor):
    from django.utils import timezone

    Evento = apps.get_model("synapse_agenda", "Evento")

    # `.iterator()` para não carregar a tabela inteira na memória; a correção é
    # por linha porque cada evento tem o seu próprio dia.
    corrigidos = 0
    for evento in Evento.objects.filter(dia_inteiro=True).iterator():
        inicio = timezone.localtime(evento.data_inicio).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        fim = timezone.localtime(evento.data_fim).replace(
            hour=23, minute=59, second=59, microsecond=0
        )
        if inicio == evento.data_inicio and fim == evento.data_fim:
            continue
        evento.data_inicio = inicio
        evento.data_fim = fim
        # `update` direto: o `save()` do modelo histórico não tem a
        # normalização (migrations usam o modelo congelado), e de qualquer
        # forma já estamos escrevendo o valor final.
        Evento.objects.filter(pk=evento.pk).update(
            data_inicio=inicio, data_fim=fim
        )
        corrigidos += 1

    if corrigidos:
        print(f"  Eventos de dia inteiro normalizados: {corrigidos}")


def nao_desfaz(apps, schema_editor):
    """Os horários originais não existem mais; inventar outros seria pior."""


class Migration(migrations.Migration):

    dependencies = [
        ("synapse_agenda", "0002_evento_lembrete"),
    ]

    operations = [
        migrations.RunPython(normalizar, nao_desfaz),
    ]
