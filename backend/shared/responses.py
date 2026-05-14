"""
Synapse - Helpers de Resposta Padrão
Garante que toda resposta segue o padrão:
Sucesso: {"success": true, "data": {}, "message": "", "pagination": {}}
Erro: {"success": false, "error": {"code": "", "message": "", "details": {}}}
"""

from rest_framework import status
from rest_framework.response import Response


def success_response(data=None, message="", status_code=status.HTTP_200_OK):
    """Resposta de sucesso no padrão Synapse."""
    return Response(
        {
            "success": True,
            "data": data or {},
            "message": message,
        },
        status=status_code,
    )


def created_response(data=None, message="Recurso criado com sucesso."):
    """Resposta de criação (201) no padrão Synapse."""
    return success_response(data=data, message=message, status_code=status.HTTP_201_CREATED)


def no_content_response():
    """Resposta de exclusão (204) sem conteúdo."""
    return Response(status=status.HTTP_204_NO_CONTENT)


def error_response(code, message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
    """Resposta de erro no padrão Synapse."""
    return Response(
        {
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            },
        },
        status=status_code,
    )
