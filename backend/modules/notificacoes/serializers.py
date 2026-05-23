"""
Synapse — M7: Serializers do módulo Notificações.
"""
from rest_framework import serializers
from .models import Notificacao


class NotificacaoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.SerializerMethodField()
    prioridade_display = serializers.SerializerMethodField()

    class Meta:
        model = Notificacao
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "titulo",
            "mensagem",
            "lida",
            "data_leitura",
            "acao_url",
            "prioridade",
            "prioridade_display",
            "criado_em",
        ]
        read_only_fields = ["id", "criado_em", "data_leitura"]

    def get_tipo_display(self, obj):
        return obj.tipo_display

    def get_prioridade_display(self, obj):
        return obj.prioridade_display


class ContagemNotificacoesSerializer(serializers.Serializer):
    count = serializers.IntegerField()
