"""
Synapse — M1: Exceções de Autenticação
"""

from shared.exceptions import SynapseException


class SynapseAuthError(SynapseException):
    """Erro de autenticação (credenciais inválidas, usuário inativo, etc.)."""

    def __init__(self, message: str = "Credenciais inválidas.", details: dict | None = None):
        super().__init__(
            code="AUTH_ERROR",
            message=message,
            details=details or {},
        )
        self.status_code = 401


class EmpresaInativaError(SynapseAuthError):
    """Empresa do usuário está inativa."""

    def __init__(self):
        super().__init__(
            message="Sua empresa está inativa. Entre em contato com o suporte.",
        )


class TokenInvalidoError(SynapseException):
    """Token de redefinição de senha inválido, expirado ou já usado."""

    def __init__(self, message: str = "Token inválido ou expirado."):
        super().__init__(
            code="TOKEN_INVALIDO",
            message=message,
            details={},
        )
        self.status_code = 400
