from django.contrib import admin
from .models import MembroEquipe, MetaMembro


@admin.register(MembroEquipe)
class MembroEquipeAdmin(admin.ModelAdmin):
    list_display = ["usuario", "empresa", "cargo", "departamento", "ativo", "criado_em"]
    list_filter = ["ativo", "departamento"]
    search_fields = ["usuario__nome", "usuario__email", "cargo"]
    readonly_fields = ["id", "criado_em", "atualizado_em"]


@admin.register(MetaMembro)
class MetaMembroAdmin(admin.ModelAdmin):
    list_display = ["titulo", "membro", "tipo", "periodo", "atingida", "criado_em"]
    list_filter = ["tipo", "periodo", "atingida"]
    search_fields = ["titulo", "membro__usuario__nome"]
    readonly_fields = ["id", "criado_em"]
