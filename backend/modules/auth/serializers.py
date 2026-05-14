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
            "criado_em",
        ]
        read_only_fields = fields


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializer de leitura para CustomUser (sem senha)."""

    empresa = EmpresaSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "nome",
            "perfil",
            "avatar_url",
            "ativo",
            "empresa",
            "criado_em",
        ]
        read_only_fields = fields


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
