"""
Synapse - Exceções Globais e Handler Customizado
Padrão de resposta de erro:
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Dados inválidos.",
        "details": {}
    }
}
"""

import logging

from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied as DRFPermissionDenied,
    ValidationError as DRFValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("synapse")


def custom_exception_handler(exc, context):
    """
    Handler global de exceções do DRF.
    Converte todas as exceções para o padrão de resposta Synapse.
    """
    # Chama o handler padrão do DRF primeiro
    response = exception_handler(exc, context)

    if response is not None:
        error_data = _build_error_response(exc, response)
        response.data = error_data
        return response

    # Exceções não tratadas pelo DRF
    if isinstance(exc, ValidationError):
        return Response(
            _format_error("VALIDATION_ERROR", str(exc), {}),
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, Http404):
        return Response(
            _format_error("NOT_FOUND", "Recurso não encontrado.", {}),
            status=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, PermissionDenied):
        return Response(
            _format_error("PERMISSION_DENIED", "Acesso negado.", {}),
            status=status.HTTP_403_FORBIDDEN,
        )

    # Erro inesperado - logar e retornar 500 genérico
    logger.exception(
        "Erro não tratado",
        extra={
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "view": context.get("view", None).__class__.__name__
            if context.get("view")
            else "Unknown",
        },
    )

    return Response(
        _format_error(
            "INTERNAL_ERROR",
            "Erro interno do servidor. Tente novamente mais tarde.",
            {},
        ),
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _build_error_response(exc, response):
    """Constrói a resposta de erro no padrão Synapse."""
    if isinstance(exc, DRFValidationError):
        return _format_error(
            "VALIDATION_ERROR",
            "Dados inválidos.",
            response.data if isinstance(response.data, dict) else {"detail": response.data},
        )

    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return _format_error(
            "AUTHENTICATION_ERROR",
            "Autenticação necessária ou credenciais inválidas.",
            {},
        )

    if isinstance(exc, DRFPermissionDenied):
        return _format_error(
            "PERMISSION_DENIED",
            str(exc.detail) if exc.detail else "Acesso negado.",
            {},
        )

    # Fallback para outros erros DRF
    detail = response.data.get("detail", str(exc)) if isinstance(response.data, dict) else str(exc)
    return _format_error("API_ERROR", str(detail), {})


def _format_error(code: str, message: str, details: dict) -> dict:
    """Formata erro no padrão Synapse."""
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
    }


class SynapseException(Exception):
    """Exceção base do Synapse."""

    def __init__(self, code: str, message: str, details: dict = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


class BusinessRuleViolation(SynapseException):
    """Violação de regra de negócio."""

    pass


class ResourceNotFound(SynapseException):
    """Recurso não encontrado."""

    def __init__(self, resource: str, identifier: str = ""):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} não encontrado(a).",
            details={"resource": resource, "identifier": identifier},
        )


class TenantAccessDenied(SynapseException):
    """Tentativa de acesso a dados de outra empresa."""

    def __init__(self):
        super().__init__(
            code="TENANT_ACCESS_DENIED",
            message="Acesso negado. Você não tem permissão para acessar dados desta empresa.",
            details={},
        )
