"""
Synapse — M1: AuthService
Toda a lógica de negócio de autenticação fica aqui.
Views apenas chamam o service e devolvem a resposta.
"""

import logging
from typing import Tuple

from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken

from .exceptions import EmpresaInativaError, SynapseAuthError, TokenInvalidoError
from .models import CustomUser, Empresa, PasswordResetToken
from .tasks import enviar_email_recuperacao

logger = logging.getLogger("synapse.auth")


class AuthService:
    """
    Serviço central de autenticação do Synapse.
    Todos os métodos são estáticos — não há estado.
    """

    # ── Registro ─────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def registrar(dados: dict) -> Tuple[Empresa, CustomUser]:
        """
        Cria Empresa e CustomUser admin em transação atômica.

        Args:
            dados: Dados validados do RegistroSerializer.

        Returns:
            Tupla (empresa, usuario).
        """
        empresa = Empresa.objects.create(
            nome=dados["nome_empresa"],
            segmento=dados["segmento"],
        )

        usuario = CustomUser.objects.create_user(
            email=dados["email"],
            nome=dados["nome_usuario"],
            senha=dados["senha"],
            empresa=empresa,
            perfil="admin",
        )

        logger.info(
            "Novo registro",
            extra={"empresa_id": str(empresa.id), "email": usuario.email},
        )

        return empresa, usuario

    # ── Autenticação ─────────────────────────────────────────

    @staticmethod
    def autenticar(email: str, senha: str) -> CustomUser:
        """
        Autentica usuário por email e senha.

        Raises:
            SynapseAuthError: Credenciais inválidas ou usuário/empresa inativo.
        """
        usuario = authenticate(username=email, password=senha)

        if usuario is None:
            raise SynapseAuthError("E-mail ou senha incorretos.")

        if not usuario.ativo or not usuario.is_active:
            raise SynapseAuthError("Usuário inativo. Entre em contato com o administrador.")

        if usuario.empresa and not usuario.empresa.ativo:
            raise EmpresaInativaError()

        logger.info("Login", extra={"email": email})
        return usuario

    # ── Geração de Tokens ─────────────────────────────────────

    @staticmethod
    def gerar_tokens(usuario: CustomUser) -> dict:
        """
        Gera par de tokens JWT (access + refresh) via Simple JWT.

        Returns:
            {"access": "...", "refresh": "..."}
        """
        refresh = RefreshToken.for_user(usuario)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

    # ── Recuperação de Senha ──────────────────────────────────

    @staticmethod
    def solicitar_recuperacao(email: str) -> None:
        """
        Gera token de redefinição e dispara e-mail via Celery.
        Não revela se o e-mail existe (sempre silencioso).
        """
        try:
            usuario = CustomUser.objects.get(email=email, ativo=True)
        except CustomUser.DoesNotExist:
            # Segurança: não revelar se e-mail existe
            logger.info("Recuperação solicitada para e-mail inexistente", extra={"email": email})
            return

        token_str = PasswordResetToken.gerar_token()
        PasswordResetToken.objects.create(
            usuario=usuario,
            token=token_str,
        )

        # Dispara task Celery (assíncrono)
        enviar_email_recuperacao.delay(
            email=usuario.email,
            token=token_str,
            nome=usuario.nome,
        )

        logger.info("Token de recuperação gerado", extra={"email": email})

    # ── Redefinição de Senha ──────────────────────────────────

    @staticmethod
    @transaction.atomic
    def redefinir_senha(token_str: str, nova_senha: str) -> None:
        """
        Redefine a senha do usuário usando o token.

        Raises:
            TokenInvalidoError: Token inválido, expirado ou já usado.
        """
        try:
            reset_token = PasswordResetToken.objects.select_related("usuario").get(
                token=token_str
            )
        except PasswordResetToken.DoesNotExist:
            raise TokenInvalidoError("Token não encontrado.")

        if not reset_token.valido:
            if reset_token.usado:
                raise TokenInvalidoError("Este token já foi utilizado.")
            raise TokenInvalidoError("Este token expirou.")

        usuario = reset_token.usuario
        usuario.set_password(nova_senha)
        usuario.save(update_fields=["password"])

        reset_token.usado = True
        reset_token.save(update_fields=["usado"])

        logger.info("Senha redefinida", extra={"email": usuario.email})
