"""
Synapse — M7: Exceções do módulo Equipe.
"""


class ConviteEmailError(Exception):
    """
    O e-mail de convite não pôde ser enviado (sem RESEND_API_KEY, domínio
    não verificado, ou erro do provedor). Usada para abortar a criação do
    membro de forma atômica — nada é persistido se o convite não sai.
    """

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class PermissaoNegadaError(Exception):
    """Ação não permitida para o perfil/usuário (mapeada para HTTP 403)."""

    def __init__(self, message: str = "Você não tem permissão para esta ação."):
        self.message = message
        super().__init__(message)


class RegraKanbanError(Exception):
    """Violação de regra do Kanban (mapeada para HTTP 400)."""

    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)
