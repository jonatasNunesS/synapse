"""
Synapse — Módulo Agenda: Serializers DRF
"""
from rest_framework import serializers

from modules.clientes.models import Cliente

from .models import Evento


class EventoSerializer(serializers.ModelSerializer):
    """Saída de leitura — inclui dados do cliente vinculado (se houver)."""

    cliente_nome = serializers.SerializerMethodField()
    criado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = Evento
        fields = [
            "id",
            "titulo",
            "descricao",
            "data_inicio",
            "data_fim",
            "dia_inteiro",
            "local",
            "cor",
            "cliente",
            "cliente_nome",
            "criado_por",
            "criado_por_nome",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "id",
            "cliente_nome",
            "criado_por",
            "criado_por_nome",
            "criado_em",
            "atualizado_em",
        ]

    def get_cliente_nome(self, obj):
        return obj.cliente.nome if obj.cliente_id else None

    def get_criado_por_nome(self, obj):
        if obj.criado_por_id:
            return obj.criado_por.nome or obj.criado_por.email
        return None


class EventoCreateSerializer(serializers.ModelSerializer):
    """Entrada de criação/edição. Valida intervalo e vínculo multi-tenant."""

    class Meta:
        model = Evento
        fields = [
            "titulo",
            "descricao",
            "data_inicio",
            "data_fim",
            "dia_inteiro",
            "local",
            "cor",
            "cliente",
        ]

    def validate_cliente(self, value):
        """Cliente vinculado deve pertencer à mesma empresa do usuário."""
        if value is None:
            return value
        request = self.context.get("request")
        empresa_id = getattr(request.user, "empresa_id", None) if request else None
        if empresa_id and str(value.empresa_id) != str(empresa_id):
            raise serializers.ValidationError(
                "Cliente não pertence à sua empresa."
            )
        return value

    def validate(self, attrs):
        # Em PATCH, cair para o valor atual da instância quando o campo não vem
        inicio = attrs.get("data_inicio") or getattr(self.instance, "data_inicio", None)
        fim = attrs.get("data_fim") or getattr(self.instance, "data_fim", None)
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError(
                {"data_fim": "A data de término não pode ser anterior à de início."}
            )
        return attrs
