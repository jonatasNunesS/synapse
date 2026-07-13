"""
Synapse — Recorrências: Serializers.
"""
from rest_framework import serializers

from .models import OcorrenciaRecorrencia, Recorrencia


class OcorrenciaResumoSerializer(serializers.ModelSerializer):
    """Ocorrência enxuta para listas (últimas 3, pendências do sino)."""

    class Meta:
        model = OcorrenciaRecorrencia
        fields = [
            "id",
            "data_esperada",
            "status",
            "valor_confirmado",
            "data_confirmacao",
            "data_adiada_para",
            "lancamento_gerado",
            "criada_em",
        ]
        read_only_fields = fields


class RecorrenciaSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True, default=None)
    ultimas_ocorrencias = serializers.SerializerMethodField()
    proxima_prevista = serializers.SerializerMethodField()

    class Meta:
        model = Recorrencia
        fields = [
            "id",
            "titulo",
            "tipo",
            "valor_padrao",
            "categoria",
            "categoria_nome",
            "descricao",
            "ativa",
            "frequencia_tipo",
            "dia_referencia",
            "usa_dia_util",
            "avisar_com_antecedencia",
            "ultimas_ocorrencias",
            "proxima_prevista",
            "criado_em",
        ]
        read_only_fields = ["id", "categoria_nome", "ultimas_ocorrencias", "proxima_prevista", "criado_em"]

    def get_ultimas_ocorrencias(self, obj):
        from .repository import RecorrenciaRepository
        return OcorrenciaResumoSerializer(
            RecorrenciaRepository.ultimas_ocorrencias(obj, 3), many=True
        ).data

    def get_proxima_prevista(self, obj):
        from datetime import date
        from .calculo import proxima_data_esperada
        from .repository import RecorrenciaRepository
        if not obj.ativa:
            return None
        ultima = RecorrenciaRepository.ultima_ocorrencia(obj)
        ultima_data = ultima.data_esperada if ultima else None
        return proxima_data_esperada(obj, ultima_data, date.today()).isoformat()


class RecorrenciaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recorrencia
        fields = [
            "titulo",
            "tipo",
            "valor_padrao",
            "categoria",
            "descricao",
            "frequencia_tipo",
            "dia_referencia",
            "usa_dia_util",
            "avisar_com_antecedencia",
            "ativa",
        ]

    def validate_valor_padrao(self, v):
        if v is None or v <= 0:
            raise serializers.ValidationError("O valor deve ser positivo.")
        return v


class OcorrenciaDetailSerializer(serializers.ModelSerializer):
    recorrencia_titulo = serializers.CharField(source="recorrencia.titulo", read_only=True)
    recorrencia_tipo = serializers.CharField(source="recorrencia.tipo", read_only=True)
    valor_esperado = serializers.DecimalField(
        source="recorrencia.valor_padrao", max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = OcorrenciaRecorrencia
        fields = [
            "id",
            "recorrencia",
            "recorrencia_titulo",
            "recorrencia_tipo",
            "valor_esperado",
            "data_esperada",
            "status",
            "valor_confirmado",
            "data_confirmacao",
            "data_adiada_para",
            "lancamento_gerado",
        ]
        read_only_fields = fields


class ConfirmarSerializer(serializers.Serializer):
    valor = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    atualizar_recorrencia = serializers.BooleanField(required=False, default=False)


class AdiarSerializer(serializers.Serializer):
    dias = serializers.IntegerField(min_value=1, max_value=365)
