from django.contrib import admin
from django.utils.html import format_html
from .models import Cliente, InteracaoCliente


STATUS_COLORS = {
    "lead": "#6366f1",
    "contato": "#3b82f6",
    "proposta": "#f59e0b",
    "negociacao": "#8b5cf6",
    "fechado": "#10b981",
    "perdido": "#6b7280",
}


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = [
        "nome",
        "tipo",
        "status_funil_badge",
        "origem",
        "valor_total_compras",
        "ultima_compra",
        "proximo_followup",
        "followup_atrasado_badge",
        "ativo",
    ]
    list_filter = ["status_funil", "tipo", "origem", "ativo"]
    search_fields = ["nome", "email", "telefone", "documento", "nome_empresa"]
    date_hierarchy = "criado_em"
    readonly_fields = ["criado_em", "atualizado_em", "ticket_medio", "dias_sem_compra"]
    list_per_page = 25
    actions = ["ativar_clientes", "desativar_clientes", "mover_para_lead"]

    fieldsets = (
        ("Dados Pessoais", {
            "fields": ("nome", "tipo", "email", "telefone", "whatsapp", "documento", "nome_empresa")
        }),
        ("Localização e Segmento", {
            "fields": ("endereco_cidade", "endereco_estado", "segmento")
        }),
        ("CRM", {
            "fields": ("status_funil", "origem", "proximo_followup", "tags", "notas")
        }),
        ("Histórico de Compras", {
            "fields": ("valor_total_compras", "quantidade_compras", "ultima_compra", "ticket_medio", "dias_sem_compra"),
            "classes": ("collapse",),
        }),
        ("Metadados", {
            "fields": ("empresa", "criado_por", "ativo", "criado_em", "atualizado_em"),
            "classes": ("collapse",),
        }),
    )

    def status_funil_badge(self, obj):
        cor = STATUS_COLORS.get(obj.status_funil, "#6b7280")
        return format_html(
            '<span style="background:{};color:white;padding:2px 8px;border-radius:4px;font-size:11px">{}</span>',
            cor,
            obj.get_status_funil_display(),
        )
    status_funil_badge.short_description = "Funil"

    def followup_atrasado_badge(self, obj):
        if obj.followup_atrasado:
            return format_html(
                '<span style="color:#ef4444;font-weight:bold">⚠ Atrasado</span>'
            )
        return format_html('<span style="color:#10b981">✓ OK</span>')
    followup_atrasado_badge.short_description = "Follow-up"

    def ticket_medio(self, obj):
        return f"R$ {obj.ticket_medio:.2f}"
    ticket_medio.short_description = "Ticket Médio"

    def dias_sem_compra(self, obj):
        dias = obj.dias_sem_compra
        return f"{dias} dias" if dias is not None else "—"
    dias_sem_compra.short_description = "Dias sem Compra"

    @admin.action(description="Ativar clientes selecionados")
    def ativar_clientes(self, request, queryset):
        count = queryset.update(ativo=True)
        self.message_user(request, f"{count} cliente(s) ativado(s).")

    @admin.action(description="Desativar clientes selecionados")
    def desativar_clientes(self, request, queryset):
        count = queryset.update(ativo=False)
        self.message_user(request, f"{count} cliente(s) desativado(s).")

    @admin.action(description="Mover para Lead")
    def mover_para_lead(self, request, queryset):
        count = queryset.update(status_funil="lead")
        self.message_user(request, f"{count} cliente(s) movido(s) para Lead.")


@admin.register(InteracaoCliente)
class InteracaoClienteAdmin(admin.ModelAdmin):
    list_display = ["cliente", "tipo_badge", "titulo", "valor", "data_interacao", "criado_por"]
    list_filter = ["tipo"]
    search_fields = ["cliente__nome", "titulo"]
    readonly_fields = ["criado_em"]
    list_per_page = 25

    TIPO_COLORS = {
        "ligacao": "#3b82f6",
        "reuniao": "#8b5cf6",
        "email": "#6366f1",
        "whatsapp": "#10b981",
        "visita": "#f59e0b",
        "venda": "#ef4444",
        "proposta": "#f97316",
        "outro": "#6b7280",
    }

    def tipo_badge(self, obj):
        cor = self.TIPO_COLORS.get(obj.tipo, "#6b7280")
        return format_html(
            '<span style="background:{};color:white;padding:2px 8px;border-radius:4px;font-size:11px">{}</span>',
            cor,
            obj.get_tipo_display(),
        )
    tipo_badge.short_description = "Tipo"
