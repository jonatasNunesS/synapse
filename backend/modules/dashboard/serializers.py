"""
Synapse — M8 Dashboard: Serializers
Serializers para validação dos query params e estruturação das respostas.
"""
from rest_framework import serializers


class DashboardQuerySerializer(serializers.Serializer):
    """Parâmetros opcionais para o endpoint de resumo principal."""
    pass  # Sem parâmetros obrigatórios; usa dados do usuário autenticado


class FluxoCaixaQuerySerializer(serializers.Serializer):
    """Parâmetros para o endpoint de fluxo de caixa."""
    dias = serializers.IntegerField(
        min_value=7,
        max_value=365,
        default=30,
        required=False,
        help_text="Número de dias para o fluxo de caixa (padrão: 30).",
    )


class VencimentosQuerySerializer(serializers.Serializer):
    """Parâmetros para o endpoint de vencimentos próximos."""
    dias = serializers.IntegerField(
        min_value=1,
        max_value=30,
        default=7,
        required=False,
        help_text="Número de dias para vencimentos (padrão: 7).",
    )


class FollowUpsQuerySerializer(serializers.Serializer):
    """Parâmetros para o endpoint de follow-ups próximos."""
    dias = serializers.IntegerField(
        min_value=1,
        max_value=14,
        default=3,
        required=False,
        help_text="Número de dias para follow-ups (padrão: 3).",
    )


class AtividadeQuerySerializer(serializers.Serializer):
    """Parâmetros para o endpoint de atividade recente."""
    limit = serializers.IntegerField(
        min_value=5,
        max_value=25,
        default=10,
        required=False,
        help_text="Número de eventos de atividade (padrão: 10).",
    )
