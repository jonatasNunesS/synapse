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

STATUS_EMPRESA_CHOICES = [
    ("ativa", "Ativa"),
    ("suspensa", "Suspensa"),
]

# ── Identidade visual (white-label) ──────────────────────────────────────────
# Paletas e fontes são CURADAS: a empresa escolhe uma das opções, não digita
# cor nem nome de fonte. As cores de cada paleta vivem no frontend (CSS), aqui
# fica só a chave escolhida.
TEMA_PALETA_CHOICES = [
    ("synapse", "Synapse"),
    ("oceano", "Oceano"),
    ("floresta", "Floresta"),
    ("ambar", "Âmbar"),
    ("grafite", "Grafite"),
]

TEMA_FONTE_CHOICES = [
    ("padrao", "Padrão"),
    ("serifada", "Serifada"),
    ("geometrica", "Geométrica"),
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

    # ── Módulos opcionais ────────────────────────────────────────────────
    # Cada empresa escolhe o que usa (no cadastro e depois em Configurações).
    # Default True: empresas já existentes seguem com tudo ligado — desligar
    # apenas OCULTA o módulo, nunca apaga dados.
    modulo_estoque = models.BooleanField(default=True)
    modulo_fornecedores = models.BooleanField(default=True)
    modulo_projetos = models.BooleanField(default=True)
    modulo_agenda = models.BooleanField(default=True)
    modulo_equipe = models.BooleanField(default=True)
    modulo_documentos = models.BooleanField(default=True)

    # ── Identidade visual ────────────────────────────────────────────────
    # Vale para TODOS os usuários da empresa (white-label, não preferência
    # individual). Empresas existentes seguem no padrão Synapse.
    tema_paleta = models.CharField(
        max_length=20,
        choices=TEMA_PALETA_CHOICES,
        default="synapse",
    )
    tema_fonte = models.CharField(
        max_length=20,
        choices=TEMA_FONTE_CHOICES,
        default="padrao",
    )

    # Suspensão administrativa (painel Synapse). Independente de `ativo`: uma
    # empresa suspensa continua logando, mas vê a tela de aviso e não opera.
    status = models.CharField(
        max_length=10,
        choices=STATUS_EMPRESA_CHOICES,
        default="ativa",
        db_index=True,
    )
    data_suspensao = models.DateTimeField(null=True, blank=True)
    motivo_suspensao = models.TextField(blank=True, default="")
    suspensa_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="empresas_suspensas",
    )

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

    # Staff da PLATAFORMA Synapse (painel administrativo) — não confundir com
    # is_staff (Django admin) nem com perfil (papel dentro da empresa cliente).
    is_staff_synapse = models.BooleanField(default=False)

    # Já viu o aviso único da migração das recorrências pro novo modelo?
    viu_aviso_recorrencias = models.BooleanField(default=False)

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

# Validade padrão por tipo de token (em horas)
TOKEN_VALIDADE_HORAS = {
    "reset": 2,       # redefinição comum
    "convite": 48,    # primeiro acesso (onboarding, janela maior)
}

TOKEN_TIPO_CHOICES = [
    ("reset", "Redefinição de senha"),
    ("convite", "Convite / primeiro acesso"),
]


def _expira_em_default():
    """Retorna datetime 2 horas a partir de agora (validade do reset comum)."""
    return timezone.now() + timedelta(hours=TOKEN_VALIDADE_HORAS["reset"])


class PasswordResetToken(models.Model):
    """
    Token de definição de senha via link por e-mail. Uso único.
    Dois tipos, mesmo mecanismo (gerar token → link → definir senha):
      - reset:   redefinição comum, válido 2h
      - convite: primeiro acesso de membro convidado, válido 48h
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="reset_tokens",
    )
    token = models.CharField(max_length=64, unique=True)
    tipo = models.CharField(
        max_length=10,
        choices=TOKEN_TIPO_CHOICES,
        default="reset",
        db_index=True,
    )
    usado = models.BooleanField(default=False)
    expira_em = models.DateTimeField(default=_expira_em_default)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "synapse_password_reset_tokens"
        verbose_name = "Token de Definição de Senha"
        verbose_name_plural = "Tokens de Definição de Senha"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} para {self.usuario.email}"

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

    @classmethod
    def criar_para(cls, usuario, tipo: str = "reset") -> "PasswordResetToken":
        """Cria um token do tipo indicado com a validade correspondente."""
        horas = TOKEN_VALIDADE_HORAS.get(tipo, TOKEN_VALIDADE_HORAS["reset"])
        return cls.objects.create(
            usuario=usuario,
            token=cls.gerar_token(),
            tipo=tipo,
            expira_em=timezone.now() + timedelta(hours=horas),
        )
