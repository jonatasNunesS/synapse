"""
Synapse — M6: Serializers do módulo Projetos e Tarefas.
"""
from rest_framework import serializers

from .models import ChecklistItem, Comentario, Projeto, Tarefa


# ════════════════════════════════════════════════════════════
# CHECKLIST
# ════════════════════════════════════════════════════════════

class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ["id", "texto", "concluido", "ordem"]
        read_only_fields = ["id"]


# ════════════════════════════════════════════════════════════
# COMENTÁRIOS
# ════════════════════════════════════════════════════════════

class ComentarioSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()
    autor_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Comentario
        fields = [
            "id", "texto", "autor_nome", "autor_avatar",
            "editado", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]

    def get_autor_nome(self, obj):
        return obj.autor.nome or obj.autor.email

    def get_autor_avatar(self, obj):
        return getattr(obj.autor, "avatar_url", None)


class ComentarioCreateSerializer(serializers.Serializer):
    texto = serializers.CharField(min_length=1)


# ════════════════════════════════════════════════════════════
# TAREFAS
# ════════════════════════════════════════════════════════════

class TarefaListSerializer(serializers.ModelSerializer):
    projeto_nome = serializers.CharField(source="projeto.nome", read_only=True)
    responsavel_nome = serializers.SerializerMethodField()
    responsavel_avatar = serializers.SerializerMethodField()
    esta_atrasada = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tarefa
        fields = [
            "id", "projeto_id", "projeto_nome", "titulo", "status",
            "prioridade", "responsavel_nome", "responsavel_avatar",
            "data_prazo", "esta_atrasada", "dias_restantes",
            "ordem", "estimativa_horas", "horas_gastas",
        ]

    def get_responsavel_nome(self, obj):
        if obj.responsavel:
            return obj.responsavel.nome or obj.responsavel.email
        return None

    def get_responsavel_avatar(self, obj):
        if obj.responsavel:
            return getattr(obj.responsavel, "avatar_url", None)
        return None


class TarefaDetailSerializer(serializers.ModelSerializer):
    projeto_nome = serializers.CharField(source="projeto.nome", read_only=True)
    responsavel_nome = serializers.SerializerMethodField()
    responsavel_avatar = serializers.SerializerMethodField()
    criado_por_nome = serializers.SerializerMethodField()
    esta_atrasada = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.IntegerField(read_only=True)
    comentarios = ComentarioSerializer(many=True, read_only=True)
    checklist = ChecklistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Tarefa
        fields = [
            "id", "projeto_id", "projeto_nome", "titulo", "descricao",
            "status", "prioridade", "responsavel_nome", "responsavel_avatar",
            "data_prazo", "data_conclusao", "esta_atrasada", "dias_restantes",
            "ordem", "estimativa_horas", "horas_gastas",
            "criado_por_nome", "criado_em", "atualizado_em",
            "comentarios", "checklist",
        ]

    def get_responsavel_nome(self, obj):
        if obj.responsavel:
            return obj.responsavel.nome or obj.responsavel.email
        return None

    def get_responsavel_avatar(self, obj):
        if obj.responsavel:
            return getattr(obj.responsavel, "avatar_url", None)
        return None

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome or obj.criado_por.email
        return None


class TarefaCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tarefa
        fields = [
            "projeto", "titulo", "descricao", "status", "prioridade",
            "responsavel", "data_prazo", "ordem", "estimativa_horas",
        ]

    def validate(self, data):
        request = self.context.get("request")
        if request and data.get("projeto"):
            empresa_id = request.user.empresa_id
            if str(data["projeto"].empresa_id) != str(empresa_id):
                raise serializers.ValidationError(
                    {"projeto": "Projeto não pertence à sua empresa."}
                )
        return data


class TarefaMoverSerializer(serializers.Serializer):
    STATUS_CHOICES = ["a_fazer", "em_andamento", "revisao", "concluido"]

    status = serializers.ChoiceField(choices=STATUS_CHOICES)
    ordem = serializers.IntegerField(min_value=0, default=0)


# ════════════════════════════════════════════════════════════
# PROJETOS
# ════════════════════════════════════════════════════════════

class ProjetoListSerializer(serializers.ModelSerializer):
    responsavel_nome = serializers.SerializerMethodField()
    responsavel_avatar = serializers.SerializerMethodField()
    progresso = serializers.IntegerField(read_only=True)
    total_tarefas = serializers.IntegerField(read_only=True)
    tarefas_concluidas = serializers.IntegerField(read_only=True)
    esta_atrasado = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.SerializerMethodField()

    class Meta:
        model = Projeto
        fields = [
            "id", "nome", "status", "prioridade",
            "responsavel_nome", "responsavel_avatar",
            "data_inicio", "data_prazo", "data_conclusao",
            "progresso", "total_tarefas", "tarefas_concluidas",
            "esta_atrasado", "dias_restantes", "cor", "criado_em",
        ]

    def get_responsavel_nome(self, obj):
        if obj.responsavel:
            return obj.responsavel.nome or obj.responsavel.email
        return None

    def get_responsavel_avatar(self, obj):
        if obj.responsavel:
            return getattr(obj.responsavel, "avatar_url", None)
        return None

    def get_dias_restantes(self, obj):
        return obj.dias_restantes


class ProjetoDetailSerializer(serializers.ModelSerializer):
    responsavel_nome = serializers.SerializerMethodField()
    responsavel_avatar = serializers.SerializerMethodField()
    criado_por_nome = serializers.SerializerMethodField()
    progresso = serializers.IntegerField(read_only=True)
    total_tarefas = serializers.IntegerField(read_only=True)
    tarefas_concluidas = serializers.IntegerField(read_only=True)
    esta_atrasado = serializers.BooleanField(read_only=True)
    dias_restantes = serializers.SerializerMethodField()
    tarefas_por_status = serializers.SerializerMethodField()
    membros = serializers.SerializerMethodField()
    total_comentarios = serializers.SerializerMethodField()

    class Meta:
        model = Projeto
        fields = [
            "id", "nome", "descricao", "status", "prioridade",
            "responsavel_nome", "responsavel_avatar",
            "data_inicio", "data_prazo", "data_conclusao",
            "progresso", "total_tarefas", "tarefas_concluidas",
            "esta_atrasado", "dias_restantes", "cor",
            "criado_por_nome", "criado_em", "atualizado_em",
            "tarefas_por_status", "membros", "total_comentarios",
        ]

    def get_responsavel_nome(self, obj):
        if obj.responsavel:
            return obj.responsavel.nome or obj.responsavel.email
        return None

    def get_responsavel_avatar(self, obj):
        if obj.responsavel:
            return getattr(obj.responsavel, "avatar_url", None)
        return None

    def get_criado_por_nome(self, obj):
        if obj.criado_por:
            return obj.criado_por.nome or obj.criado_por.email
        return None

    def get_dias_restantes(self, obj):
        return obj.dias_restantes

    def get_tarefas_por_status(self, obj):
        tarefas = obj.tarefas.select_related("responsavel").order_by("ordem")
        return {
            "a_fazer": TarefaListSerializer(
                tarefas.filter(status="a_fazer"), many=True
            ).data,
            "em_andamento": TarefaListSerializer(
                tarefas.filter(status="em_andamento"), many=True
            ).data,
            "revisao": TarefaListSerializer(
                tarefas.filter(status="revisao"), many=True
            ).data,
            "concluido": TarefaListSerializer(
                tarefas.filter(status="concluido"), many=True
            ).data,
        }

    def get_membros(self, obj):
        responsaveis = (
            obj.tarefas
            .filter(responsavel__isnull=False)
            .values_list("responsavel__id", "responsavel__nome", "responsavel__email")
            .distinct()
        )
        return [
            {
                "id": str(r[0]),
                "nome": r[1] or r[2],
            }
            for r in responsaveis
        ]

    def get_total_comentarios(self, obj):
        return Comentario.objects.filter(tarefa__projeto=obj).count()


class ProjetoCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Projeto
        fields = [
            "nome", "descricao", "status", "prioridade",
            "responsavel", "data_inicio", "data_prazo", "cor",
        ]

    def validate(self, data):
        data_inicio = data.get("data_inicio")
        data_prazo = data.get("data_prazo")
        if data_inicio and data_prazo and data_prazo < data_inicio:
            raise serializers.ValidationError(
                {"data_prazo": "A data de prazo deve ser maior ou igual à data de início."}
            )
        return data


# ════════════════════════════════════════════════════════════
# KANBAN
# ════════════════════════════════════════════════════════════

class KanbanSerializer(serializers.Serializer):
    a_fazer = TarefaListSerializer(many=True)
    em_andamento = TarefaListSerializer(many=True)
    revisao = TarefaListSerializer(many=True)
    concluido = TarefaListSerializer(many=True)
    totais = serializers.DictField()


# ════════════════════════════════════════════════════════════
# RESUMO
# ════════════════════════════════════════════════════════════

class ResumoProjetosSerializer(serializers.Serializer):
    total_projetos = serializers.IntegerField()
    projetos_ativos = serializers.IntegerField()
    projetos_atrasados = serializers.IntegerField()
    tarefas_pendentes = serializers.IntegerField()
    tarefas_minhas = serializers.IntegerField()
    tarefas_atrasadas = serializers.IntegerField()
    projetos_por_status = serializers.DictField()
