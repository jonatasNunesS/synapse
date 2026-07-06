from django.contrib import admin

from .models import Evento


@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "empresa", "data_inicio", "data_fim", "cliente", "dia_inteiro")
    list_filter = ("dia_inteiro", "empresa")
    search_fields = ("titulo", "descricao", "local")
    date_hierarchy = "data_inicio"
    autocomplete_fields = ()
