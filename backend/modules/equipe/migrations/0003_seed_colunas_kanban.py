"""
Semeia as 3 colunas padrão do Kanban da equipe para empresas já existentes.
Empresas novas recebem as colunas via signal (post_save em Empresa).
"""
from django.db import migrations

COLUNAS_PADRAO = [
    ("A Fazer", 1),
    ("Em Andamento", 2),
    ("Concluído", 3),
]


def seed(apps, schema_editor):
    Empresa = apps.get_model("synapse_auth", "Empresa")
    ColunaKanbanEquipe = apps.get_model("equipe", "ColunaKanbanEquipe")

    novas = []
    for empresa in Empresa.objects.all():
        if ColunaKanbanEquipe.objects.filter(empresa_id=empresa.id).exists():
            continue
        for nome, ordem in COLUNAS_PADRAO:
            novas.append(
                ColunaKanbanEquipe(empresa_id=empresa.id, nome=nome, ordem=ordem)
            )
    if novas:
        ColunaKanbanEquipe.objects.bulk_create(novas)


def unseed(apps, schema_editor):
    # Reversão: não apaga nada (colunas podem ter tarefas e edições do usuário).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("equipe", "0002_colunakanbanequipe_tarefapessoal_and_more"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
