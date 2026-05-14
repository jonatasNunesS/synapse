"""
Synapse — M1: Views de Autenticação
Todas as views seguem o padrão: validar → service → resposta padrão.
Tokens JWT são setados em httpOnly cookies (nunca no body).
"""

import logging

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from shared.responses import created_response, error_response, success_response

from .exceptions import SynapseAuthError, TokenInvalidoError
from .serializers import (
    AtualizarPerfilSerializer,
    LoginSerializer,
    RecuperarSenhaSerializer,
    RedefinirSenhaSerializer,
    RegistroSerializer,
    UsuarioSerializer,
)
from .services import AuthService

logger = logging.getLogger("synapse.auth.views")

# ── Constantes de Cookie ──────────────────────────────────────
ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
ACCESS_MAX_AGE = 15 * 60          # 15 minutos
REFRESH_MAX_AGE = 7 * 24 * 60 * 60  # 7 dias


def _set_auth_cookies(response: Response, tokens: dict) -> None:
    """Seta access e refresh tokens em httpOnly cookies."""
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=tokens["access"],
        max_age=ACCESS_MAX_AGE,
        httponly=True,
        samesite="Lax",
        secure=False,  # True em produção
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=tokens["refresh"],
        max_age=REFRESH_MAX_AGE,
        httponly=True,
        samesite="Lax",
        secure=False,
        path="/",
    )


def _delete_auth_cookies(response: Response) -> None:
    """Remove os cookies de autenticação."""
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")


# ════════════════════════════════════════════════════════════
# POST /api/auth/registro/
# ════════════════════════════════════════════════════════════


class RegistroView(APIView):
    """Cria nova empresa + usuário admin e retorna tokens em cookies."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegistroSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        empresa, usuario = AuthService.registrar(serializer.validated_data)
        tokens = AuthService.gerar_tokens(usuario)

        data = {
            "usuario": UsuarioSerializer(usuario).data,
        }
        response = created_response(data=data, message="Conta criada com sucesso!")
        _set_auth_cookies(response, tokens)
        return response


# ════════════════════════════════════════════════════════════
# POST /api/auth/login/
# ════════════════════════════════════════════════════════════


class LoginView(APIView):
    """Autentica usuário e retorna tokens em cookies."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            usuario = AuthService.autenticar(
                email=serializer.validated_data["email"],
                senha=serializer.validated_data["senha"],
            )
        except SynapseAuthError as exc:
            return error_response(
                code=exc.code,
                message=exc.message,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        tokens = AuthService.gerar_tokens(usuario)
        data = {"usuario": UsuarioSerializer(usuario).data}
        response = success_response(data=data, message="Login realizado com sucesso.")
        _set_auth_cookies(response, tokens)
        return response


# ════════════════════════════════════════════════════════════
# POST /api/auth/logout/
# ════════════════════════════════════════════════════════════


class LogoutView(APIView):
    """Invalida refresh token e remove cookies."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass  # Token já inválido — não é erro

        response = success_response(message="Logout realizado com sucesso.")
        _delete_auth_cookies(response)
        return response


# ════════════════════════════════════════════════════════════
# POST /api/auth/refresh/
# ════════════════════════════════════════════════════════════


class RefreshView(APIView):
    """Gera novo access token a partir do refresh token no cookie."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)

        if not refresh_token:
            return error_response(
                code="TOKEN_AUSENTE",
                message="Refresh token não encontrado.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(refresh_token)
            new_access = str(refresh.access_token)
        except TokenError:
            return error_response(
                code="TOKEN_INVALIDO",
                message="Refresh token inválido ou expirado.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        response = success_response(message="Token renovado com sucesso.")
        response.set_cookie(
            key=ACCESS_COOKIE,
            value=new_access,
            max_age=ACCESS_MAX_AGE,
            httponly=True,
            samesite="Lax",
            secure=False,
            path="/",
        )
        return response


# ════════════════════════════════════════════════════════════
# POST /api/auth/recuperar-senha/
# ════════════════════════════════════════════════════════════


class RecuperarSenhaView(APIView):
    """Solicita redefinição de senha. Sempre retorna sucesso."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RecuperarSenhaSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Sempre silencioso (não revela se e-mail existe)
        AuthService.solicitar_recuperacao(serializer.validated_data["email"])

        return success_response(
            message="Se este e-mail estiver cadastrado, você receberá as instruções em breve."
        )


# ════════════════════════════════════════════════════════════
# POST /api/auth/redefinir-senha/
# ════════════════════════════════════════════════════════════


class RedefinirSenhaView(APIView):
    """Redefine a senha usando o token recebido por e-mail."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RedefinirSenhaSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            AuthService.redefinir_senha(
                token_str=serializer.validated_data["token"],
                nova_senha=serializer.validated_data["nova_senha"],
            )
        except TokenInvalidoError as exc:
            return error_response(
                code=exc.code,
                message=exc.message,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response(message="Senha redefinida com sucesso. Faça login com a nova senha.")


# ════════════════════════════════════════════════════════════
# GET/PATCH /api/auth/me/
# ════════════════════════════════════════════════════════════


class MeView(APIView):
    """Retorna ou atualiza dados do usuário autenticado."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        serializer = UsuarioSerializer(request.user)
        return success_response(data=serializer.data)

    def patch(self, request: Request) -> Response:
        serializer = AtualizarPerfilSerializer(
            request.user, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return success_response(
            data=UsuarioSerializer(request.user).data,
            message="Perfil atualizado com sucesso.",
        )
