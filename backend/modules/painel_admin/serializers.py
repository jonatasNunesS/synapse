"""
Synapse — Painel Administrativo: Serializers.
"""
from decimal import Decimal

from rest_framework import serializers

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from modules.auth.models import (
    PERFIL_CHOICES,
    PLANO_CHOICES,
    SEGMENTO_CHOICES,
    CustomUser,
    Empresa,
)

from .models import AuditLog, ConfiguracaoPlano, LogAlteracaoPlano
from .services import PainelAdminService


class UsuarioAdminSerializer(serializers.ModelSerializer):
    """Usuário visto pelo painel (sem dados sensíveis além do necessário)."""

    ultimo_acesso = serializers.DateTimeField(source="last_login", read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "id", "nome", "email", "perfil", "ativo", "is_active",
            "is_staff_synapse", "ultimo_acesso", "criado_em",
        ]
        read_only_fields = fields


class EmpresaAdminListSerializer(serializers.ModelSerializer):
    """Item da lista de empresas, com contadores e métricas da plataforma."""

    num_usuarios = serializers.IntegerField(read_only=True)
    total_usuarios = serializers.IntegerField(source="num_usuarios", read_only=True)
    ultimo_acesso = serializers.DateTimeField(read_only=True)
    creditos_usados_hoje = serializers.SerializerMethodField()
    creditos_usados_mes = serializers.SerializerMethodField()
    total_lancamentos = serializers.SerializerMethodField()
    total_clientes = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = [
            "id",
            "nome",
            "segmento",
            "plano",
            "plano_ativo",
            "ativo",
            "status",
            "data_suspensao",
            "num_usuarios",
            "total_usuarios",
            "ultimo_acesso",
            "creditos_usados_hoje",
            "creditos_usados_mes",
            "total_lancamentos",
            "total_clientes",
            "criado_em",
        ]
        read_only_fields = fields

    def get_creditos_usados_hoje(self, obj) -> int:
        return PainelAdminService.creditos_usados_hoje(obj.id)

    def get_creditos_usados_mes(self, obj) -> int:
        return PainelAdminService.creditos_usados_mes(obj.id)

    def get_total_lancamentos(self, obj) -> int:
        return PainelAdminService.total_lancamentos(obj.id)

    def get_total_clientes(self, obj) -> int:
        return PainelAdminService.total_clientes(obj.id)


class EmpresaAdminDetailSerializer(serializers.ModelSerializer):
    """Detalhe da empresa + usuários + contadores + métricas."""

    usuarios = serializers.SerializerMethodField()
    num_usuarios = serializers.SerializerMethodField()
    total_usuarios = serializers.SerializerMethodField()
    ultimo_acesso = serializers.SerializerMethodField()
    creditos_usados_hoje = serializers.SerializerMethodField()
    creditos_usados_mes = serializers.SerializerMethodField()
    total_lancamentos = serializers.SerializerMethodField()
    total_clientes = serializers.SerializerMethodField()
    suspensa_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = [
            "id",
            "nome",
            "cnpj",
            "segmento",
            "plano",
            "plano_ativo",
            "plano_validade",
            "ativo",
            "status",
            "data_suspensao",
            "motivo_suspensao",
            "suspensa_por_nome",
            "num_usuarios",
            "total_usuarios",
            "ultimo_acesso",
            "creditos_usados_hoje",
            "creditos_usados_mes",
            "total_lancamentos",
            "total_clientes",
            "usuarios",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = fields

    def get_usuarios(self, obj):
        qs = PainelAdminService.usuarios_da_empresa(obj.id)
        return UsuarioAdminSerializer(qs, many=True).data

    def get_num_usuarios(self, obj) -> int:
        return PainelAdminService.usuarios_da_empresa(obj.id).count()

    def get_total_usuarios(self, obj) -> int:
        return PainelAdminService.usuarios_da_empresa(obj.id).count()

    def get_ultimo_acesso(self, obj):
        return PainelAdminService.ultimo_acesso(obj.id)

    def get_creditos_usados_hoje(self, obj) -> int:
        return PainelAdminService.creditos_usados_hoje(obj.id)

    def get_creditos_usados_mes(self, obj) -> int:
        return PainelAdminService.creditos_usados_mes(obj.id)

    def get_total_lancamentos(self, obj) -> int:
        return PainelAdminService.total_lancamentos(obj.id)

    def get_total_clientes(self, obj) -> int:
        return PainelAdminService.total_clientes(obj.id)

    def get_suspensa_por_nome(self, obj):
        if obj.suspensa_por:
            return obj.suspensa_por.nome or obj.suspensa_por.email
        return None


class LogAlteracaoPlanoSerializer(serializers.ModelSerializer):
    alterado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = LogAlteracaoPlano
        fields = [
            "id",
            "acao",
            "plano_anterior",
            "plano_novo",
            "observacao",
            "status",
            "erro",
            "alterado_por_nome",
            "alterado_em",
        ]
        read_only_fields = fields

    def get_alterado_por_nome(self, obj):
        if obj.alterado_por:
            return obj.alterado_por.nome or obj.alterado_por.email
        return None


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id", "empresa_id", "empresa_nome", "acao",
            "realizado_por_email", "detalhes", "criado_em",
        ]
        read_only_fields = fields


# ── Entradas (write) ────────────────────────────────────────────────────────

class TrocarPlanoSerializer(serializers.Serializer):
    """Entrada de POST .../trocar-plano/."""

    plano_novo = serializers.ChoiceField(choices=[p[0] for p in PLANO_CHOICES])
    observacao = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=1000
    )


class CriarEmpresaSerializer(serializers.Serializer):
    """Entrada de POST /empresas/ — cria empresa + admin."""

    nome_empresa = serializers.CharField(max_length=255)
    segmento = serializers.ChoiceField(choices=[s[0] for s in SEGMENTO_CHOICES])
    plano = serializers.ChoiceField(choices=[p[0] for p in PLANO_CHOICES])
    admin_nome = serializers.CharField(max_length=255)
    admin_email = serializers.EmailField()
    admin_senha = serializers.CharField(write_only=True)

    def validate_admin_email(self, value: str) -> str:
        value = value.lower()
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("Este e-mail já está cadastrado.")
        return value

    def validate_admin_senha(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class EditarEmpresaSerializer(serializers.Serializer):
    """Entrada de PATCH /empresas/{id}/ — nome e/ou segmento."""

    nome = serializers.CharField(max_length=255, required=False)
    segmento = serializers.ChoiceField(
        choices=[s[0] for s in SEGMENTO_CHOICES], required=False
    )


class SuspenderSerializer(serializers.Serializer):
    """Entrada de POST .../suspender/ — motivo obrigatório (min 10 chars)."""

    motivo = serializers.CharField(min_length=10, max_length=2000)


class ReativarSerializer(serializers.Serializer):
    """Entrada de POST .../reativar/ — motivo opcional."""

    motivo = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=2000
    )


class EditarUsuarioSerializer(serializers.Serializer):
    """Entrada de PATCH .../usuarios/{uid}/ — perfil e/ou is_active."""

    perfil = serializers.ChoiceField(
        choices=[p[0] for p in PERFIL_CHOICES], required=False
    )
    is_active = serializers.BooleanField(required=False)


class ConfiguracaoPlanoSerializer(serializers.ModelSerializer):
    """
    Plano como a landing pública o vê. Preço/limites podem vir null — o
    frontend mostra "a definir" nesse caso.
    """

    class Meta:
        model = ConfiguracaoPlano
        fields = [
            "plano",
            "preco_mensal",
            "preco_anual",
            "limite_usuarios",
            "limite_armazenamento_gb",
            "descricao_suporte",
            "ativo",
            "atualizado_em",
        ]
        read_only_fields = fields


class EditarConfiguracaoPlanoSerializer(serializers.ModelSerializer):
    """PATCH do staff: preços, limites e descrição do suporte."""

    class Meta:
        model = ConfiguracaoPlano
        fields = [
            "preco_mensal",
            "preco_anual",
            "limite_usuarios",
            "limite_armazenamento_gb",
            "descricao_suporte",
            "ativo",
        ]
        extra_kwargs = {
            "preco_mensal": {"allow_null": True, "min_value": Decimal("0")},
            "preco_anual": {"allow_null": True, "min_value": Decimal("0")},
            "limite_usuarios": {"allow_null": True, "min_value": 1},
            "limite_armazenamento_gb": {"allow_null": True, "min_value": 1},
        }
