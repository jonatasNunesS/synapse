"""
M5 — Fornecedores: Admin Django
"""
from django.contrib import admin
from django.utils.html import format_html

from .models import CategoriaFornecedor, Fornecedor, CompraFornecedor


@admin.register(CategoriaFornecedor)
class CategoriaFornecedorAdmin(admin.ModelAdmin):
    list_display = ["nome", "empresa", "cor_preview", "ativo", "criado_em"]
    list_filter = ["ativo", "empresa"]
    search_fields = ["nome"]

    def cor_preview(self, obj):
        return format_html(
            '<span style="background-color: {}; padding: 2px 12px; border-radius: 4px; color: white;">{}</span>',
            obj.cor,
            obj.cor,
        )
    cor_preview.short_description = "Cor"


@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = [
        "nome", "empresa", "categoria", "status_badge",
        "score_badge", "valor_total_compras", "quantidade_pedidos", "ativo",
    ]
    list_filter = ["status", "ativo", "empresa", "categoria"]
    search_fields = ["nome", "email", "cnpj", "nome_contato"]
    readonly_fields = [
        "score_synapse", "valor_total_compras", "quantidade_pedidos",
        "ultima_compra", "criado_em", "atualizado_em",
    ]
    fieldsets = (
        ("Identificação", {
            "fields": ("empresa", "nome", "nome_contato", "cnpj", "categoria", "status"),
        }),
        ("Contato", {
            "fields": ("email", "telefone", "whatsapp", "site"),
        }),
        ("Localização", {
            "fields": ("endereco_cidade", "endereco_estado"),
        }),
        ("Comercial", {
            "fields": ("condicoes_pagamento", "prazo_entrega_dias", "notas"),
        }),
        ("Avaliação", {
            "fields": (
                "avaliacao_qualidade", "avaliacao_prazo", "avaliacao_preco",
                "score_synapse",
            ),
        }),
        ("Histórico", {
            "fields": ("valor_total_compras", "quantidade_pedidos", "ultima_compra"),
        }),
        ("Sistema", {
            "fields": ("ativo", "criado_por", "criado_em", "atualizado_em"),
        }),
    )

    def status_badge(self, obj):
        cores = {
            "ativo": "#10B981",
            "negociando": "#F59E0B",
            "suspenso": "#EF4444",
            "encerrado": "#6B7280",
        }
        cor = cores.get(obj.status, "#6B7280")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px;">{}</span>',
            cor,
            obj.get_status_display(),
        )
    status_badge.short_description = "Status"

    def score_badge(self, obj):
        score = float(obj.score_synapse)
        if score >= 80:
            cor = "#10B981"
        elif score >= 60:
            cor = "#F59E0B"
        elif score > 0:
            cor = "#EF4444"
        else:
            cor = "#6B7280"
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            cor,
            f"{score:.1f}",
        )
    score_badge.short_description = "Score Synapse"


@admin.register(CompraFornecedor)
class CompraFornecedorAdmin(admin.ModelAdmin):
    list_display = [
        "fornecedor", "descricao", "valor", "data_compra",
        "numero_nf", "status_badge", "data_pagamento",
    ]
    list_filter = ["status", "empresa"]
    search_fields = ["descricao", "numero_nf", "fornecedor__nome"]
    readonly_fields = ["criado_em"]
    date_hierarchy = "data_compra"

    def status_badge(self, obj):
        cores = {
            "pendente": "#F59E0B",
            "pago": "#10B981",
            "cancelado": "#EF4444",
        }
        cor = cores.get(obj.status, "#6B7280")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px;">{}</span>',
            cor,
            obj.get_status_display(),
        )
    status_badge.short_description = "Status"
