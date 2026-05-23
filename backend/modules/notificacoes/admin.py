from django.contrib import admin
from .models import Notificacao


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ["titulo", "tipo", "prioridade", "lida", "usuario", "criado_em"]
    list_filter = ["tipo", "prioridade", "lida"]
    search_fields = ["titulo", "mensagem", "usuario__email"]
    readonly_fields = ["id", "criado_em", "data_leitura"]
    ordering = ["-criado_em"]
