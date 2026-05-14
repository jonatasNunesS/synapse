"""
Synapse — M1: Models de Autenticação
Empresa, CustomUser (AbstractBaseUser), PasswordResetToken.
"""

import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

# ════════════════════════════════════════════════════════════
# CHOICES
# ════════════════════════════════════════════════════════════

SEGMENTO_CHOICES = [
    ("varejo", "Varejo"),
    ("servicos", "Serviços"),
    ("alimentacao", "Alimentação"),
    ("moda", "Moda"),
    ("eventos", "Eventos"),
    ("agencia", "Agência"),
    ("outro", "Outro"),
]

PLANO_CHOICES = [
    ("starter", "Starter"),
    ("pro", "Pro"),
    ("business", "Business"),
    ("enterprise", "Enterprise"),
]

PERFIL_CHOICES = [
    ("admin", "Administrador"),
    ("gerente", "Gerente"),
    ("colaborador", "Colaborador"),
]


# ════════════════════════════════════════════════════════════
# MODEL: EMPRESA
# ════════════════════════════════════════════════════════════

class Empresa(models.Model):
    """
    Tenant raiz do Synapse.
    Todos os dados de negócio são isolados por empresa.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=18, blank=True, default="")
    segmento = models.CharField(
        max_length=20,
        choices=SEGMENTO_CHOICES,
        default="outro",
    )
    plano = models.CharField(
        max_length=20,
        choices=PLANO_CHOICES,
        default="starter",
    )
    plano_ativo = models.BooleanField(default=True)
    plano_validade = models.DateField(null=True, blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "synapse_empresas"
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"{self.nome} ({self.plano})"


# ════════════════════════════════════════════════════════════
# MANAGER: CUSTOM USER
# ════════════════════════════════════════════════════════════

class CustomUserManager(BaseUserManager):
    """Manager para CustomUser com email como USERNAME_FIELD."""

    def create_user(
        self,
        email: str,
        nome: str,
        senha: str,
        empresa=None,
        **extra_fields,
    ) -> "CustomUser":
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, nome=nome, empresa=empresa, **extra_fields)
        user.set_password(senha)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, nome: str, senha: str, **extra_fields) -> "CustomUser":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("perfil", "admin")
        return self.create_user(email=email, nome=nome, senha=senha, **extra_fields)


# ════════════════════════════════════════════════════════════
# MODEL: CUSTOM USER
# ════════════════════════════════════════════════════════════

class CustomUser(AbstractBaseUser, PermissionsMixin):
    """
    Usuário do Synapse.
    Usa email como identificador único (USERNAME_FIELD).
    Vinculado a uma Empresa (multi-tenant).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usuarios",
        db_index=True,
    )
    email = models.EmailField(unique=True)
    nome = models.CharField(max_length=255)
    perfil = models.CharField(
        max_length=20,
        choices=PERFIL_CHOICES,
        default="admin",
    )
    avatar_url = models.CharField(max_length=500, blank=True, default="")
    ativo = models.BooleanField(default=True)

    # Campos obrigatórios pelo Django admin
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nome"]

    class Meta:
        db_table = "synapse_users"
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"{self.nome} <{self.email}>"

    @property
    def empresa_id_str(self) -> str:
        """Retorna empresa_id como string para uso em cache keys."""
        return str(self.empresa_id) if self.empresa_id else ""


# ════════════════════════════════════════════════════════════
# MODEL: PASSWORD RESET TOKEN
# ════════════════════════════════════════════════════════════

def _expira_em_default():
    """Retorna datetime 2 horas a partir de agora."""
    return timezone.now() + timedelta(hours=2)


class PasswordResetToken(models.Model):
    """
    Token de redefinição de senha.
    Válido por 2 horas, uso único.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="reset_tokens",
    )
    token = models.CharField(max_length=64, unique=True)
    usado = models.BooleanField(default=False)
    expira_em = models.DateTimeField(default=_expira_em_default)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "synapse_password_reset_tokens"
        verbose_name = "Token de Redefinição de Senha"
        verbose_name_plural = "Tokens de Redefinição de Senha"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"Reset token para {self.usuario.email}"

    @property
    def expirado(self) -> bool:
        return timezone.now() > self.expira_em

    @property
    def valido(self) -> bool:
        return not self.usado and not self.expirado

    @classmethod
    def gerar_token(cls) -> str:
        """Gera um token seguro de 48 bytes (64 chars em base64url)."""
        return secrets.token_urlsafe(48)
