from django.contrib import admin
from .models import Documento, VersaoDocumento


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ["titulo", "tipo", "status", "criado_por", "criado_em"]
    list_filter = ["tipo", "status"]
    search_fields = ["titulo", "descricao"]
    readonly_fields = ["id", "criado_em", "atualizado_em"]


@admin.register(VersaoDocumento)
class VersaoDocumentoAdmin(admin.ModelAdmin):
    list_display = ["documento", "numero_versao", "criado_por", "criado_em"]
    search_fields = ["documento__titulo"]
    readonly_fields = ["id", "criado_em"]
