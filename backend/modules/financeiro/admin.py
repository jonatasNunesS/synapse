"""
Synapse — Módulo Financeiro: Admin Django
"""
from django.contrib import admin
from django.utils.html import format_html

from .models import Categoria, Lancamento


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nome", "tipo", "cor_preview", "empresa", "ativo", "criado_em"]
    list_filter = ["tipo", "ativo", "empresa"]
    search_fields = ["nome", "empresa__nome"]
    ordering = ["tipo", "nome"]
    readonly_fields = ["id", "criado_em"]

    def cor_preview(self, obj):
        return format_html(
            '<span style="background-color: {}; padding: 2px 12px; '
            'border-radius: 4px; color: white;">{}</span>',
            obj.cor,
            obj.cor,
        )
    cor_preview.short_description = "Cor"


@admin.register(Lancamento)
class LancamentoAdmin(admin.ModelAdmin):
    list_display = [
        "descricao",
        "tipo",
        "valor_formatado",
        "status",
        "data_vencimento",
        "data_pagamento",
        "empresa",
        "categoria",
    ]
    list_filter = ["tipo", "status", "empresa", "categoria", "recorrente"]
    search_fields = ["descricao", "empresa__nome", "categoria__nome"]
    ordering = ["-data_vencimento"]
    readonly_fields = ["id", "criado_em", "atualizado_em", "criado_por"]
    date_hierarchy = "data_vencimento"

    fieldsets = [
        (
            "Dados Principais",
            {
                "fields": [
                    "id",
                    "empresa",
                    "tipo",
                    "descricao",
                    "valor",
                    "categoria",
                ]
            },
        ),
        (
            "Datas e Status",
            {
                "fields": [
                    "data_vencimento",
                    "data_pagamento",
                    "status",
                ]
            },
        ),
        (
            "Recorrência",
            {
                "fields": ["recorrente", "recorrencia"],
                "classes": ["collapse"],
            },
        ),
        (
            "Metadados",
            {
                "fields": ["observacoes", "criado_por", "criado_em", "atualizado_em"],
                "classes": ["collapse"],
            },
        ),
    ]

    def valor_formatado(self, obj):
        cor = "#16a34a" if obj.tipo == "receita" else "#dc2626"
        sinal = "+" if obj.tipo == "receita" else "-"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} R$ {:,.2f}</span>',
            cor,
            sinal,
            obj.valor,
        )
    valor_formatado.short_description = "Valor"
