"""
Synapse — M7: Serializers do módulo Documentos.
"""
from rest_framework import serializers
from .models import Documento, VersaoDocumento


class VersaoDocumentoSerializer(serializers.ModelSerializer):
    criado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = VersaoDocumento
        fields = [
            "id", "numero_versao", "arquivo", "notas",
            "criado_por_nome", "criado_em",
        ]
        read_only_fields = ["id", "numero_versao", "criado_em"]

    def get_criado_por_nome(self, obj):
        return obj.criado_por.nome if obj.criado_por else None


class DocumentoListSerializer(serializers.ModelSerializer):
    criado_por_nome = serializers.SerializerMethodField()
    total_versoes = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = [
            "id", "titulo", "tipo", "status", "tags", "total_versoes",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]

    def get_criado_por_nome(self, obj):
        return obj.criado_por.nome if obj.criado_por else None

    def get_total_versoes(self, obj):
        return obj.total_versoes


class DocumentoDetailSerializer(serializers.ModelSerializer):
    criado_por_nome = serializers.SerializerMethodField()
    total_versoes = serializers.SerializerMethodField()
    versoes = VersaoDocumentoSerializer(many=True, read_only=True)

    class Meta:
        model = Documento
        fields = [
            "id", "titulo", "descricao", "tipo", "status", "arquivo",
            "url_externa", "tags", "total_versoes", "versoes",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]

    def get_criado_por_nome(self, obj):
        return obj.criado_por.nome if obj.criado_por else None

    def get_total_versoes(self, obj):
        return obj.total_versoes


class DocumentoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Documento
        fields = ["titulo", "descricao", "tipo", "status", "arquivo", "url_externa", "tags"]

    def validate(self, data):
        if not data.get("arquivo") and not data.get("url_externa"):
            # Permitir documentos sem arquivo (apenas metadados)
            pass
        return data


class DocumentoUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Documento
        fields = ["titulo", "descricao", "tipo", "status", "url_externa", "tags"]


class NovaVersaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VersaoDocumento
        fields = ["arquivo", "notas"]
