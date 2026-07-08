from django.contrib import admin

from .models import LogAlteracaoPlano


@admin.register(LogAlteracaoPlano)
class LogAlteracaoPlanoAdmin(admin.ModelAdmin):
    list_display = ("empresa", "plano_anterior", "plano_novo", "status", "alterado_por", "alterado_em")
    list_filter = ("status", "plano_novo")
    search_fields = ("empresa__nome",)
    readonly_fields = [f.name for f in LogAlteracaoPlano._meta.fields]
