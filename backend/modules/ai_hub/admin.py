"""
Synapse - AI Hub Admin
"""
from django.contrib import admin
from .models import ConteudoGerado, TaskIA


@admin.register(ConteudoGerado)
class ConteudoGeradoAdmin(admin.ModelAdmin):
    list_display = ["tipo", "empresa", "criado_por", "tokens_usados", "favorito", "criado_em"]
    list_filter = ["tipo", "favorito", "empresa"]
    search_fields = ["empresa__nome", "prompt_usuario", "resultado"]
    readonly_fields = [
        "id", "empresa", "tipo", "prompt_usuario", "prompt_completo",
        "resultado", "modelo_usado", "tokens_usados", "criado_por", "criado_em",
    ]
    ordering = ["-criado_em"]
    date_hierarchy = "criado_em"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(TaskIA)
class TaskIAAdmin(admin.ModelAdmin):
    list_display = ["tipo", "status", "empresa", "task_id", "criado_em", "concluido_em"]
    list_filter = ["status", "tipo", "empresa"]
    search_fields = ["empresa__nome", "task_id"]
    readonly_fields = [
        "id", "empresa", "tipo", "status", "task_id",
        "parametros", "resultado", "erro", "criado_em", "concluido_em",
    ]
    ordering = ["-criado_em"]

    def has_add_permission(self, request):
        return False
