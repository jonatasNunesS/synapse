"""
Synapse — M6: Admin do módulo Projetos e Tarefas.
"""
from django.contrib import admin

from .models import ChecklistItem, Comentario, Projeto, Tarefa


class TarefaInline(admin.TabularInline):
    model = Tarefa
    extra = 0
    fields = ("titulo", "status", "prioridade", "responsavel", "data_prazo", "ordem")
    readonly_fields = ("id",)
    show_change_link = True


class ChecklistItemInline(admin.TabularInline):
    model = ChecklistItem
    extra = 0
    fields = ("texto", "concluido", "ordem")


class ComentarioInline(admin.TabularInline):
    model = Comentario
    extra = 0
    fields = ("autor", "texto", "editado", "criado_em")
    readonly_fields = ("criado_em",)


@admin.register(Projeto)
class ProjetoAdmin(admin.ModelAdmin):
    list_display = (
        "nome", "empresa", "status", "prioridade",
        "responsavel", "data_prazo", "progresso", "esta_atrasado", "ativo",
    )
    list_filter = ("status", "prioridade", "ativo", "empresa")
    search_fields = ("nome", "descricao", "empresa__nome")
    readonly_fields = ("id", "criado_em", "atualizado_em", "progresso", "esta_atrasado")
    inlines = [TarefaInline]
    ordering = ("-criado_em",)

    fieldsets = (
        ("Identificação", {"fields": ("id", "nome", "descricao", "cor")}),
        ("Status", {"fields": ("status", "prioridade", "ativo")}),
        ("Responsabilidade", {"fields": ("empresa", "responsavel", "criado_por")}),
        ("Datas", {"fields": ("data_inicio", "data_prazo", "data_conclusao")}),
        ("Métricas", {"fields": ("progresso", "esta_atrasado")}),
        ("Timestamps", {"fields": ("criado_em", "atualizado_em")}),
    )

    def progresso(self, obj):
        return f"{obj.progresso}%"
    progresso.short_description = "Progresso"

    def esta_atrasado(self, obj):
        return obj.esta_atrasado
    esta_atrasado.boolean = True
    esta_atrasado.short_description = "Atrasado?"


@admin.register(Tarefa)
class TarefaAdmin(admin.ModelAdmin):
    list_display = (
        "titulo", "projeto", "empresa", "status", "prioridade",
        "responsavel", "data_prazo", "esta_atrasada",
    )
    list_filter = ("status", "prioridade", "empresa")
    search_fields = ("titulo", "descricao", "projeto__nome")
    readonly_fields = ("id", "criado_em", "atualizado_em", "esta_atrasada")
    inlines = [ComentarioInline, ChecklistItemInline]
    ordering = ("projeto", "ordem")

    def esta_atrasada(self, obj):
        return obj.esta_atrasada
    esta_atrasada.boolean = True
    esta_atrasada.short_description = "Atrasada?"


@admin.register(Comentario)
class ComentarioAdmin(admin.ModelAdmin):
    list_display = ("autor", "tarefa", "empresa", "editado", "criado_em")
    list_filter = ("editado", "empresa")
    search_fields = ("texto", "autor__email", "tarefa__titulo")
    readonly_fields = ("id", "criado_em", "atualizado_em")


@admin.register(ChecklistItem)
class ChecklistItemAdmin(admin.ModelAdmin):
    list_display = ("texto", "tarefa", "concluido", "ordem")
    list_filter = ("concluido",)
    search_fields = ("texto", "tarefa__titulo")
