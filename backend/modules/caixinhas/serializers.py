"""
Synapse — Caixinhas: Serializers.
"""
from decimal import Decimal

from rest_framework import serializers

from .models import Caixinha, MovimentoCaixinha


class CaixinhaSerializer(serializers.ModelSerializer):
    """Leitura: inclui meta_atingida e progresso (%) calculados."""

    meta_atingida = serializers.SerializerMethodField()
    progresso = serializers.SerializerMethodField()

    class Meta:
        model = Caixinha
        fields = [
            "id",
            "nome",
            "cor",
            "icone",
            "saldo",
            "meta",
            "meta_atingida",
            "progresso",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "saldo", "criado_em", "atualizado_em"]

    def get_meta_atingida(self, obj) -> bool:
        return obj.meta_atingida

    def get_progresso(self, obj):
        """saldo/meta em % (0-100, capado). None se não há meta."""
        if obj.meta is None or obj.meta <= 0:
            return None
        pct = (obj.saldo / obj.meta) * 100
        return round(min(float(pct), 100.0), 1)


class CaixinhaCreateSerializer(serializers.ModelSerializer):
    """Criação/edição: nome, cor, ícone e meta. Saldo nunca entra por aqui."""

    class Meta:
        model = Caixinha
        fields = ["nome", "cor", "icone", "meta"]

    def validate_meta(self, value):
        if value is not None and value <= Decimal("0"):
            raise serializers.ValidationError("A meta deve ser maior que zero.")
        return value


class OperacaoCaixinhaSerializer(serializers.Serializer):
    """Body de depósito/retirada: {valor, descricao?}."""

    valor = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        error_messages={
            "required": "Informe o valor.",
            "invalid": "Valor inválido.",
            "min_value": "O valor deve ser maior que zero.",
        },
    )
    descricao = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )


class MovimentoCaixinhaSerializer(serializers.ModelSerializer):
    """Leitura do histórico de movimentos."""

    tipo_display = serializers.SerializerMethodField()
    criado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = MovimentoCaixinha
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "valor",
            "descricao",
            "criado_por_nome",
            "criado_em",
        ]

    def get_tipo_display(self, obj):
        return obj.get_tipo_display()

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome or obj.criado_por.email
        return None
