from django.contrib import admin

from .models import OcorrenciaRecorrencia, Recorrencia


@admin.register(Recorrencia)
class RecorrenciaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "empresa", "tipo", "valor_padrao", "frequencia_tipo", "ativa")
    list_filter = ("tipo", "frequencia_tipo", "ativa")
    search_fields = ("titulo",)


@admin.register(OcorrenciaRecorrencia)
class OcorrenciaRecorrenciaAdmin(admin.ModelAdmin):
    list_display = ("recorrencia", "data_esperada", "status", "data_confirmacao")
    list_filter = ("status",)
