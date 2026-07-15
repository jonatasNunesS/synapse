from django.contrib import admin

from .models import Caixinha, MovimentoCaixinha


@admin.register(Caixinha)
class CaixinhaAdmin(admin.ModelAdmin):
    list_display = ["nome", "empresa", "saldo", "meta", "criado_em"]
    list_filter = ["empresa"]
    search_fields = ["nome"]
    readonly_fields = ["saldo", "criado_em", "atualizado_em"]


@admin.register(MovimentoCaixinha)
class MovimentoCaixinhaAdmin(admin.ModelAdmin):
    list_display = ["caixinha", "tipo", "valor", "criado_por", "criado_em"]
    list_filter = ["tipo", "empresa"]
    readonly_fields = ["criado_em"]
