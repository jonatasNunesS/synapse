"""
Synapse — M7: Serializers do módulo Equipe.
"""
from rest_framework import serializers
from .models import MembroEquipe, MetaMembro


class MetaMembroSerializer(serializers.ModelSerializer):
    progresso_percentual = serializers.SerializerMethodField()

    class Meta:
        model = MetaMembro
        fields = [
            "id", "titulo", "descricao", "tipo", "valor_meta", "valor_atual",
            "periodo", "data_inicio", "data_fim", "atingida", "progresso_percentual",
            "criado_em",
        ]
        read_only_fields = ["id", "criado_em", "progresso_percentual"]

    def get_progresso_percentual(self, obj):
        return obj.progresso_percentual


class MembroEquipeListSerializer(serializers.ModelSerializer):
    nome = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    perfil = serializers.SerializerMethodField()
    total_tarefas_abertas = serializers.SerializerMethodField()
    total_projetos = serializers.SerializerMethodField()
    usuario_id = serializers.UUIDField(source="usuario.id", read_only=True)

    class Meta:
        model = MembroEquipe
        fields = [
            "id", "usuario_id", "nome", "email", "cargo", "departamento",
            "perfil", "ativo", "total_tarefas_abertas", "total_projetos",
            "data_entrada",
        ]

    def get_nome(self, obj):
        return obj.nome

    def get_email(self, obj):
        return obj.email

    def get_perfil(self, obj):
        return obj.perfil

    def get_total_tarefas_abertas(self, obj):
        return obj.total_tarefas_abertas

    def get_total_projetos(self, obj):
        return obj.total_projetos


class MembroEquipeDetailSerializer(serializers.ModelSerializer):
    nome = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    perfil = serializers.SerializerMethodField()
    total_tarefas_abertas = serializers.SerializerMethodField()
    total_projetos = serializers.SerializerMethodField()
    progresso_meta_atual = serializers.SerializerMethodField()
    metas = MetaMembroSerializer(many=True, read_only=True)
    usuario_id = serializers.UUIDField(source="usuario.id", read_only=True)

    class Meta:
        model = MembroEquipe
        fields = [
            "id", "usuario_id", "nome", "email", "cargo", "departamento", "bio",
            "perfil", "ativo", "total_tarefas_abertas", "total_projetos",
            "progresso_meta_atual", "metas", "data_entrada", "criado_em",
        ]

    def get_nome(self, obj):
        return obj.nome

    def get_email(self, obj):
        return obj.email

    def get_perfil(self, obj):
        return obj.perfil

    def get_total_tarefas_abertas(self, obj):
        return obj.total_tarefas_abertas

    def get_total_projetos(self, obj):
        return obj.total_projetos

    def get_progresso_meta_atual(self, obj):
        return obj.progresso_meta_atual


class MembroEquipeCreateSerializer(serializers.ModelSerializer):
    usuario_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = MembroEquipe
        fields = ["usuario_id", "cargo", "departamento", "bio", "data_entrada"]

    def validate_usuario_id(self, value):
        from modules.auth.models import CustomUser
        empresa_id = self.context["request"].user.empresa_id
        try:
            usuario = CustomUser.objects.get(id=value, empresa_id=empresa_id)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(
                "Usuário não encontrado ou não pertence a esta empresa."
            )
        if MembroEquipe.objects.filter(empresa_id=empresa_id, usuario_id=value).exists():
            raise serializers.ValidationError(
                "Este usuário já é membro da equipe."
            )
        return value


class ConvidarMembroSerializer(serializers.Serializer):
    email = serializers.EmailField()
    perfil = serializers.ChoiceField(choices=["admin", "gerente", "colaborador"])
    nome = serializers.CharField(max_length=255)
    cargo = serializers.CharField(max_length=100, required=False, allow_blank=True)
    departamento = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_email(self, value):
        from modules.auth.models import CustomUser
        empresa_id = self.context["request"].user.empresa_id
        if CustomUser.objects.filter(email=value, empresa_id=empresa_id).exists():
            raise serializers.ValidationError(
                "Este e-mail já está cadastrado nesta empresa."
            )
        return value


class ResumoEquipeSerializer(serializers.Serializer):
    total_membros = serializers.IntegerField()
    membros_ativos = serializers.IntegerField()
    por_perfil = serializers.DictField()
    por_departamento = serializers.ListField()
