"""
Synapse — M1: Serializers de Autenticação
Registro, Login, Recuperação e Redefinição de Senha.
"""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import CustomUser, Empresa, PasswordResetToken

# ════════════════════════════════════════════════════════════
# SERIALIZERS DE SAÍDA (Read)
# ════════════════════════════════════════════════════════════


class EmpresaSerializer(serializers.ModelSerializer):
    """Serializer de leitura para Empresa."""

    class Meta:
        model = Empresa
        fields = [
            "id",
            "nome",
            "cnpj",
            "segmento",
            "plano",
            "plano_ativo",
            "plano_validade",
            "ativo",
            "status",
            "tema_paleta",
            "tema_fonte",
            "criado_em",
        ]
        read_only_fields = fields


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializer de leitura para CustomUser (sem senha)."""

    empresa = EmpresaSerializer(read_only=True)
    modulos = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "nome",
            "perfil",
            "avatar_url",
            "ativo",
            "is_staff_synapse",
            "viu_aviso_recorrencias",
            "empresa",
            "modulos",
            "criado_em",
        ]
        read_only_fields = fields

    def get_modulos(self, obj) -> dict:
        """Mapa {modulo: bool} dos módulos OPCIONAIS da empresa do usuário."""
        from shared.modulos import modulos_da_empresa

        return modulos_da_empresa(obj.empresa)


# ════════════════════════════════════════════════════════════
# SERIALIZER: REGISTRO
# ════════════════════════════════════════════════════════════


class RegistroSerializer(serializers.Serializer):
    """
    Valida os dados de registro de nova empresa + usuário admin.
    Cria Empresa e CustomUser em transação atômica (via AuthService).
    """

    # Dados do usuário
    nome_usuario = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True, min_length=8)
    confirmar_senha = serializers.CharField(write_only=True)

    # Dados da empresa
    nome_empresa = serializers.CharField(max_length=255)
    segmento = serializers.ChoiceField(
        choices=["varejo", "servicos", "alimentacao", "moda", "eventos", "agencia", "outro"]
    )

    # Etapa 3 do cadastro — as respostas configuram os módulos opcionais.
    # Opcionais na API: se não vierem, a empresa nasce com tudo ligado (o
    # comportamento de antes, mantendo a retrocompatibilidade do endpoint).
    modulo_estoque = serializers.BooleanField(required=False)
    modulo_fornecedores = serializers.BooleanField(required=False)
    modulo_projetos = serializers.BooleanField(required=False)
    modulo_agenda = serializers.BooleanField(required=False)
    modulo_equipe = serializers.BooleanField(required=False)
    modulo_documentos = serializers.BooleanField(required=False)

    def validate_email(self, value: str) -> str:
        """Verifica unicidade do e-mail."""
        if CustomUser.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("Este e-mail já está cadastrado.")
        return value.lower()

    def validate_senha(self, value: str) -> str:
        """Aplica validadores de senha do Django."""
        validate_password(value)
        return value

    def validate(self, attrs: dict) -> dict:
        """Verifica se as senhas coincidem."""
        if attrs["senha"] != attrs["confirmar_senha"]:
            raise serializers.ValidationError(
                {"confirmar_senha": "As senhas não coincidem."}
            )
        return attrs


# ════════════════════════════════════════════════════════════
# SERIALIZER: LOGIN
# ════════════════════════════════════════════════════════════


class LoginSerializer(serializers.Serializer):
    """Valida credenciais de login."""

    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True)

    def validate_email(self, value: str) -> str:
        return value.lower()


# ════════════════════════════════════════════════════════════
# SERIALIZER: RECUPERAR SENHA
# ════════════════════════════════════════════════════════════


class RecuperarSenhaSerializer(serializers.Serializer):
    """
    Solicita redefinição de senha.
    Não revela se o e-mail existe (segurança).
    """

    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return value.lower()


# ════════════════════════════════════════════════════════════
# SERIALIZER: REDEFINIR SENHA
# ════════════════════════════════════════════════════════════


class RedefinirSenhaSerializer(serializers.Serializer):
    """Valida token e nova senha para redefinição."""

    token = serializers.CharField(max_length=64)
    nova_senha = serializers.CharField(write_only=True, min_length=8)
    confirmar_senha = serializers.CharField(write_only=True)

    def validate_token(self, value: str) -> str:
        """Verifica se o token existe, não foi usado e não expirou."""
        try:
            reset_token = PasswordResetToken.objects.select_related("usuario").get(
                token=value
            )
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError("Token inválido.")

        if reset_token.usado:
            raise serializers.ValidationError("Este token já foi utilizado.")

        if reset_token.expirado:
            raise serializers.ValidationError("Este token expirou.")

        return value

    def validate_nova_senha(self, value: str) -> str:
        validate_password(value)
        return value

    def validate(self, attrs: dict) -> dict:
        if attrs["nova_senha"] != attrs["confirmar_senha"]:
            raise serializers.ValidationError(
                {"confirmar_senha": "As senhas não coincidem."}
            )
        return attrs


# ════════════════════════════════════════════════════════════
# SERIALIZER: ATUALIZAR PERFIL (PATCH /me/)
# ════════════════════════════════════════════════════════════


class AtualizarPerfilSerializer(serializers.ModelSerializer):
    """Permite atualizar apenas nome e avatar_url."""

    class Meta:
        model = CustomUser
        fields = ["nome", "avatar_url"]


# ════════════════════════════════════════════════════════════
# SERIALIZER: MÓDULOS DA EMPRESA (PATCH /empresa/modulos/)
# ════════════════════════════════════════════════════════════


class ModulosEmpresaSerializer(serializers.ModelSerializer):
    """
    Liga/desliga os módulos OPCIONAIS da empresa. Módulos obrigatórios
    (financeiro, clientes, dashboard) não têm campo — não podem ser desligados.
    """

    class Meta:
        model = Empresa
        fields = [
            "modulo_estoque",
            "modulo_fornecedores",
            "modulo_projetos",
            "modulo_agenda",
            "modulo_equipe",
            "modulo_documentos",
        ]


# ════════════════════════════════════════════════════════════
# SERIALIZER: IDENTIDADE VISUAL (PATCH /empresa/tema/)
# ════════════════════════════════════════════════════════════


class TemaEmpresaSerializer(serializers.ModelSerializer):
    """
    Paleta e fonte da empresa. As duas são escolhas curadas: qualquer valor
    fora das opções é 400 (o ModelSerializer valida pelos choices do model).
    """

    class Meta:
        model = Empresa
        fields = ["tema_paleta", "tema_fonte"]
