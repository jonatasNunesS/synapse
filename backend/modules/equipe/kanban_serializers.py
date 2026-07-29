"""
Synapse — Equipe: Serializers do Kanban da equipe.
"""
from rest_framework import serializers

from .models import ColunaKanbanEquipe, TarefaPessoal


class ColunaKanbanSerializer(serializers.ModelSerializer):
    class Meta:
        model = ColunaKanbanEquipe
        fields = ["id", "nome", "ordem", "cor", "criado_em"]
        read_only_fields = ["id", "criado_em"]


class ColunaCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ColunaKanbanEquipe
        fields = ["nome", "ordem", "cor"]
        extra_kwargs = {
            "nome": {"required": True},
            "ordem": {"required": False},
            "cor": {"required": False},
        }


class ReordenarColunasSerializer(serializers.Serializer):
    """Entrada de POST /colunas/reordenar/ — lista de {id, ordem}."""

    class _Item(serializers.Serializer):
        id = serializers.UUIDField()
        ordem = serializers.IntegerField()

    itens = _Item(many=True)

    def to_internal_value(self, data):
        # Aceita tanto uma lista pura [ {...} ] quanto {"itens": [...]}.
        if isinstance(data, list):
            data = {"itens": data}
        return super().to_internal_value(data)


class TarefaPessoalSerializer(serializers.ModelSerializer):
    responsavel_nome = serializers.SerializerMethodField()
    responsavel_avatar = serializers.SerializerMethodField()
    esta_atrasada = serializers.BooleanField(read_only=True)
    origem = serializers.SerializerMethodField()

    class Meta:
        model = TarefaPessoal
        fields = [
            "id", "origem", "coluna", "titulo", "descricao", "responsavel",
            "responsavel_nome", "responsavel_avatar", "prazo", "prioridade",
            "ordem", "esta_atrasada", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]

    def get_origem(self, obj) -> str:
        return "pessoal"

    def get_responsavel_nome(self, obj):
        if obj.responsavel:
            return obj.responsavel.nome or obj.responsavel.email
        return None

    def get_responsavel_avatar(self, obj):
        if obj.responsavel:
            return getattr(obj.responsavel, "avatar_url", "") or ""
        return None


class TarefaPessoalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TarefaPessoal
        fields = [
            "coluna", "titulo", "descricao", "responsavel", "prazo",
            "prioridade", "ordem",
        ]
        extra_kwargs = {
            "descricao": {"required": False},
            "prazo": {"required": False},
            "prioridade": {"required": False},
            "ordem": {"required": False},
        }

    def validate(self, data):
        request = self.context.get("request")
        empresa_id = request.user.empresa_id if request else None
        coluna = data.get("coluna")
        if coluna and empresa_id and str(coluna.empresa_id) != str(empresa_id):
            raise serializers.ValidationError({"coluna": "Coluna de outra empresa."})
        responsavel = data.get("responsavel")
        if responsavel and empresa_id and str(responsavel.empresa_id) != str(empresa_id):
            raise serializers.ValidationError(
                {"responsavel": "Responsável de outra empresa."}
            )
        return data


class MoverTarefaSerializer(serializers.Serializer):
    """Entrada de POST /tarefas/{id}/mover/."""

    coluna_id = serializers.UUIDField()
    ordem_na_coluna = serializers.IntegerField(required=False, default=0)
