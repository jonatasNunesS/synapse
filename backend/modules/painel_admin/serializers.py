"""
Synapse — Painel Administrativo: Serializers.
"""
from rest_framework import serializers

from modules.auth.models import PLANO_CHOICES, CustomUser, Empresa

from .models import LogAlteracaoPlano
from .services import PainelAdminService


class UsuarioAdminSerializer(serializers.ModelSerializer):
    """Usuário visto pelo painel (sem dados sensíveis além do necessário)."""

    class Meta:
        model = CustomUser
        fields = ["id", "nome", "email", "perfil", "ativo", "is_staff_synapse", "criado_em"]
        read_only_fields = fields


class EmpresaAdminListSerializer(serializers.ModelSerializer):
    """Item da lista de empresas, com contadores da plataforma."""

    num_usuarios = serializers.IntegerField(read_only=True)
    creditos_usados_hoje = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = [
            "id",
            "nome",
            "segmento",
            "plano",
            "plano_ativo",
            "ativo",
            "num_usuarios",
            "creditos_usados_hoje",
            "criado_em",
        ]
        read_only_fields = fields

    def get_creditos_usados_hoje(self, obj) -> int:
        return PainelAdminService.creditos_usados_hoje(obj.id)


class EmpresaAdminDetailSerializer(serializers.ModelSerializer):
    """Detalhe da empresa + usuários + contadores."""

    usuarios = serializers.SerializerMethodField()
    num_usuarios = serializers.SerializerMethodField()
    creditos_usados_hoje = serializers.SerializerMethodField()

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
            "num_usuarios",
            "creditos_usados_hoje",
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

    def get_creditos_usados_hoje(self, obj) -> int:
        return PainelAdminService.creditos_usados_hoje(obj.id)


class LogAlteracaoPlanoSerializer(serializers.ModelSerializer):
    alterado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = LogAlteracaoPlano
        fields = [
            "id",
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


class TrocarPlanoSerializer(serializers.Serializer):
    """Entrada de POST .../trocar-plano/."""

    plano_novo = serializers.ChoiceField(choices=[p[0] for p in PLANO_CHOICES])
    observacao = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=1000
    )
