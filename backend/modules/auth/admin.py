"""
Synapse — M1: Django Admin para Empresa e CustomUser
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html

from .models import CustomUser, Empresa, PasswordResetToken


# ════════════════════════════════════════════════════════════
# ADMIN: EMPRESA
# ════════════════════════════════════════════════════════════


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ["nome", "segmento", "plano_badge", "plano_ativo", "ativo", "criado_em"]
    list_filter = ["plano", "plano_ativo", "ativo", "segmento", "criado_em"]
    search_fields = ["nome", "cnpj"]
    readonly_fields = ["id", "criado_em", "atualizado_em"]
    ordering = ["-criado_em"]

    fieldsets = [
        ("Identificação", {"fields": ["id", "nome", "cnpj", "segmento"]}),
        ("Plano", {"fields": ["plano", "plano_ativo", "plano_validade"]}),
        ("Status", {"fields": ["ativo"]}),
        ("Datas", {"fields": ["criado_em", "atualizado_em"]}),
    ]

    @admin.display(description="Plano")
    def plano_badge(self, obj: Empresa) -> str:
        cores = {
            "starter": "#64748b",
            "pro": "#7c3aed",
            "business": "#0ea5e9",
            "enterprise": "#f59e0b",
        }
        cor = cores.get(obj.plano, "#64748b")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">{}</span>',
            cor,
            obj.plano.upper(),
        )


# ════════════════════════════════════════════════════════════
# ADMIN: CUSTOM USER
# ════════════════════════════════════════════════════════════


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ["nome", "email", "empresa", "perfil", "ativo", "criado_em"]
    list_filter = ["perfil", "ativo", "criado_em", "empresa__plano"]
    search_fields = ["nome", "email", "empresa__nome"]
    readonly_fields = ["id", "criado_em", "atualizado_em"]
    ordering = ["-criado_em"]

    # Substituir fieldsets do UserAdmin padrão
    fieldsets = [
        ("Identificação", {"fields": ["id", "email", "nome", "avatar_url"]}),
        ("Empresa e Perfil", {"fields": ["empresa", "perfil"]}),
        ("Permissões", {"fields": ["ativo", "is_active", "is_staff", "is_superuser", "groups", "user_permissions"]}),
        ("Datas", {"fields": ["last_login", "criado_em", "atualizado_em"]}),
    ]

    add_fieldsets = [
        (None, {
            "classes": ["wide"],
            "fields": ["email", "nome", "empresa", "perfil", "password1", "password2"],
        }),
    ]

    actions = ["ativar_usuarios", "desativar_usuarios"]

    @admin.action(description="Ativar usuários selecionados")
    def ativar_usuarios(self, request, queryset):
        count = queryset.update(ativo=True, is_active=True)
        self.message_user(request, f"{count} usuário(s) ativado(s).")

    @admin.action(description="Desativar usuários selecionados")
    def desativar_usuarios(self, request, queryset):
        count = queryset.update(ativo=False, is_active=False)
        self.message_user(request, f"{count} usuário(s) desativado(s).")


# ════════════════════════════════════════════════════════════
# ADMIN: PASSWORD RESET TOKEN
# ════════════════════════════════════════════════════════════


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ["usuario", "usado", "expirado_display", "expira_em", "criado_em"]
    list_filter = ["usado", "criado_em"]
    search_fields = ["usuario__email"]
    readonly_fields = ["id", "token", "criado_em"]
    ordering = ["-criado_em"]

    @admin.display(description="Expirado?", boolean=True)
    def expirado_display(self, obj: PasswordResetToken) -> bool:
        return obj.expirado
