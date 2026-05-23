"""
Synapse - AI Hub Serializers
"""
from rest_framework import serializers
from .models import ConteudoGerado, TaskIA, TIPO_CONTEUDO_CHOICES

# Campos obrigatórios por tipo de conteúdo
CAMPOS_OBRIGATORIOS = {
    "legenda_instagram": ["produto", "tom", "quantidade"],
    "titulo_produto": ["produto", "plataforma", "quantidade"],
    "descricao_produto": ["produto", "publico", "diferenciais"],
    "hashtags": ["tema", "quantidade"],
    "ideia_pauta": ["plataforma", "quantidade"],
    "email_marketing": ["assunto", "objetivo"],
    "relatorio_negocio": [],
    "insight": [],
    "outro": [],
}

TIPOS_VALIDOS = [t[0] for t in TIPO_CONTEUDO_CHOICES]


class ConteudoGeradoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    criado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = ConteudoGerado
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "prompt_usuario",
            "resultado",
            "modelo_usado",
            "tokens_usados",
            "favorito",
            "copiado",
            "criado_por",
            "criado_por_nome",
            "criado_em",
        ]
        read_only_fields = [
            "id",
            "tipo_display",
            "prompt_completo",
            "resultado",
            "modelo_usado",
            "tokens_usados",
            "criado_por",
            "criado_por_nome",
            "criado_em",
        ]

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome or obj.criado_por.email
        return None


class TaskIASerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = TaskIA
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "status",
            "status_display",
            "resultado",
            "erro",
            "criado_em",
            "concluido_em",
        ]
        read_only_fields = fields


class SolicitacaoConteudoSerializer(serializers.Serializer):
    """
    Serializer de entrada para POST /api/ai/gerar/
    Valida tipo e campos obrigatórios por tipo.
    """
    tipo = serializers.ChoiceField(choices=TIPOS_VALIDOS)
    parametros = serializers.JSONField(default=dict)

    def validate(self, data):
        tipo = data.get("tipo")
        parametros = data.get("parametros", {})
        campos = CAMPOS_OBRIGATORIOS.get(tipo, [])
        faltando = [c for c in campos if not parametros.get(c)]
        if faltando:
            raise serializers.ValidationError(
                {
                    "parametros": (
                        f"Campos obrigatórios para '{tipo}': "
                        f"{', '.join(faltando)}"
                    )
                }
            )
        return data


class UsoIASerializer(serializers.Serializer):
    """Retorno de GET /api/ai/uso/"""
    usado = serializers.IntegerField()
    limite = serializers.IntegerField()
    percentual = serializers.FloatField()
    plano = serializers.CharField()
    resetar_em = serializers.CharField()
    ilimitado = serializers.BooleanField()
