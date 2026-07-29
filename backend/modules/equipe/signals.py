"""
Synapse — Equipe: signals.

Ao criar uma Empresa, semeia as 3 colunas padrão do Kanban da equipe
("A Fazer", "Em Andamento", "Concluído"). Cobre todos os caminhos de criação
(registro público e criação pelo painel admin).
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="synapse_auth.Empresa")
def seed_colunas_kanban_equipe(sender, instance, created, **kwargs):
    if not created:
        return
    from .models import COLUNAS_PADRAO, ColunaKanbanEquipe

    # Idempotente: não duplica se por algum motivo já houver colunas.
    if ColunaKanbanEquipe.objects.filter(empresa_id=instance.id).exists():
        return
    ColunaKanbanEquipe.objects.bulk_create(
        [
            ColunaKanbanEquipe(empresa=instance, nome=nome, ordem=ordem)
            for nome, ordem in COLUNAS_PADRAO
        ]
    )
