"""
Data migration: converte os Lancamento.recorrente=True existentes no novo
modelo Recorrencia.

Cada lançamento recorrente antigo vira uma Recorrencia equivalente e o
lançamento é marcado como NÃO-recorrente (mantido como registro histórico,
nunca deletado). As recorrências criadas ganham avisar_com_antecedencia=0,
usa_dia_util=False e ativa=True (comportamento igual ao antigo).
"""
from django.db import migrations

# Mapeia a frequência antiga (semanal/mensal/anual) para a nova. O modelo v1
# não tem "anual" — mapeia para mensal (best-effort; documentado no PR).
FREQ_MAP = {"semanal": "semanal", "mensal": "mensal", "anual": "mensal"}


def migrar(apps, schema_editor):
    Lancamento = apps.get_model("synapse_financeiro", "Lancamento")
    Recorrencia = apps.get_model("synapse_recorrencias", "Recorrencia")

    antigos = Lancamento.objects.filter(recorrente=True)
    for lanc in antigos.iterator():
        freq = FREQ_MAP.get(lanc.recorrencia or "mensal", "mensal")
        venc = lanc.data_vencimento
        dia_ref = venc.weekday() if freq == "semanal" else venc.day

        Recorrencia.objects.create(
            empresa_id=lanc.empresa_id,
            criado_por_id=lanc.criado_por_id,
            titulo=lanc.descricao or "Recorrência",
            tipo=lanc.tipo,
            valor_padrao=lanc.valor,
            categoria_id=lanc.categoria_id,
            descricao=lanc.observacoes or "",
            ativa=True,
            frequencia_tipo=freq,
            dia_referencia=dia_ref,
            usa_dia_util=False,
            avisar_com_antecedencia=0,
        )
        # Mantém o lançamento como histórico, mas fora do fluxo de recorrência.
        lanc.recorrente = False
        lanc.save(update_fields=["recorrente"])


def reverter(apps, schema_editor):
    # Não é reversível de forma segura (não rastreamos quais lançamentos foram
    # convertidos). No-op — as Recorrencias podem ser removidas manualmente.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("synapse_recorrencias", "0001_initial"),
        ("synapse_financeiro", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(migrar, reverter),
    ]
