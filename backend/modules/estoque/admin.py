from django.contrib import admin
from django.utils.html import format_html
from .models import CategoriaEstoque, Produto, Variacao, Movimentacao


@admin.register(CategoriaEstoque)
class CategoriaEstoqueAdmin(admin.ModelAdmin):
    list_display = ["nome", "empresa", "cor_preview", "ativo", "criado_em"]
    list_filter = ["ativo"]
    search_fields = ["nome"]

    def cor_preview(self, obj):
        return format_html(
            '<span style="background-color: {}; padding: 2px 10px; '
            'border-radius: 4px; color: white;">{}</span>',
            obj.cor,
            obj.cor,
        )
    cor_preview.short_description = "Cor"


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = [
        "nome", "sku", "categoria", "estoque_atual",
        "estoque_minimo", "preco_venda", "status_estoque_colored", "ativo",
    ]
    list_filter = ["categoria", "ativo", "unidade"]
    search_fields = ["nome", "sku", "codigo_barras"]
    readonly_fields = ["criado_em", "atualizado_em", "criado_por"]
    actions = ["ativar_produtos", "desativar_produtos"]

    def status_estoque_colored(self, obj):
        status = obj.status_estoque
        cores = {
            "ok": ("#16a34a", "✓ OK"),
            "baixo": ("#d97706", "⚠ Baixo"),
            "zerado": ("#dc2626", "✗ Zerado"),
        }
        cor, label = cores.get(status, ("#6b7280", status))
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>', cor, label
        )
    status_estoque_colored.short_description = "Status"

    def ativar_produtos(self, request, queryset):
        queryset.update(ativo=True)
        self.message_user(request, f"{queryset.count()} produto(s) ativado(s).")
    ativar_produtos.short_description = "Ativar produtos selecionados"

    def desativar_produtos(self, request, queryset):
        queryset.update(ativo=False)
        self.message_user(request, f"{queryset.count()} produto(s) desativado(s).")
    desativar_produtos.short_description = "Desativar produtos selecionados"


@admin.register(Variacao)
class VariacaoAdmin(admin.ModelAdmin):
    list_display = ["produto", "nome", "sku_variacao", "estoque_atual", "preco_venda", "ativo"]
    list_filter = ["ativo"]
    search_fields = ["produto__nome", "nome", "sku_variacao"]


@admin.register(Movimentacao)
class MovimentacaoAdmin(admin.ModelAdmin):
    list_display = [
        "produto", "tipo", "quantidade", "motivo",
        "estoque_antes", "estoque_depois", "criado_por", "criado_em",
    ]
    list_filter = ["tipo", "motivo"]
    search_fields = ["produto__nome", "referencia"]
    date_hierarchy = "criado_em"

    # Movimentações são imutáveis — todos os campos readonly
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Editando
            return [f.name for f in obj._meta.fields]
        return []

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
