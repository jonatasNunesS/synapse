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
