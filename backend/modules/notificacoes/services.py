"""
Synapse — M7: Service do módulo Notificações.
Toda a lógica de negócio passa por aqui.
"""
import logging
from .repository import NotificacaoRepository
from .models import Notificacao

logger = logging.getLogger("synapse")

# tipo da notificação → módulo que precisa estar ativo para ela existir.
# Tipos ausentes (financeiro, cliente, sistema) são de módulos obrigatórios.
TIPO_PARA_MODULO = {
    "estoque": "estoque",
    "fornecedor": "fornecedores",
    "projeto": "projetos",
    "equipe": "equipe",
    "documento": "documentos",
}


def _modulo_do_tipo_ativo(empresa_id, tipo: str) -> bool:
    """
    Ponto único que impede notificação de módulo desligado (independente de
    quem chama: task, signal ou service). Módulos obrigatórios passam sempre.
    """
    nome_modulo = TIPO_PARA_MODULO.get(tipo)
    if not nome_modulo or not empresa_id:
        return True

    from modules.auth.models import Empresa
    from shared.modulos import modulo_ativo

    empresa = Empresa.objects.filter(pk=empresa_id).only(
        f"modulo_{nome_modulo}"
    ).first()
    return modulo_ativo(empresa, nome_modulo)


class NotificacaoService:

    @staticmethod
    def criar_notificacao(
        usuario_id: str,
        empresa_id: str,
        tipo: str,
        titulo: str,
        mensagem: str,
        acao_url: str = "",
        prioridade: str = "normal",
    ) -> Notificacao:
        """Cria uma notificação e invalida o cache de contagem."""
        # Módulo desligado → nenhuma notificação é gerada.
        if not _modulo_do_tipo_ativo(empresa_id, tipo):
            logger.info(
                "Notificação ignorada (módulo desativado)",
                extra={"empresa_id": str(empresa_id), "tipo": tipo},
            )
            return None

        dados = {
            "tipo": tipo,
            "titulo": titulo,
            "mensagem": mensagem,
            "acao_url": acao_url,
            "prioridade": prioridade,
        }
        notificacao = NotificacaoRepository.criar(usuario_id, empresa_id, dados)
        NotificacaoRepository.invalidar_cache_contagem(str(usuario_id))
        logger.info(
            "Notificação criada",
            extra={"usuario_id": str(usuario_id), "tipo": tipo, "titulo": titulo},
        )
        return notificacao

    @staticmethod
    def criar_para_empresa(
        empresa_id: str,
        tipo: str,
        titulo: str,
        mensagem: str,
        excluir_usuario_id: str = None,
        acao_url: str = "",
        prioridade: str = "normal",
    ) -> list:
        """Cria notificação para todos os admins da empresa, excluindo opcionalmente um usuário."""
        from modules.auth.models import CustomUser

        # Módulo desligado → nenhuma notificação (evita varrer os admins à toa).
        if not _modulo_do_tipo_ativo(empresa_id, tipo):
            logger.info(
                "Notificação de empresa ignorada (módulo desativado)",
                extra={"empresa_id": str(empresa_id), "tipo": tipo},
            )
            return []

        admins = CustomUser.objects.filter(
            empresa_id=empresa_id,
            perfil__in=["admin", "gerente"],
            is_active=True,
        )
        if excluir_usuario_id:
            admins = admins.exclude(id=excluir_usuario_id)

        notificacoes = []
        for admin in admins:
            notif = NotificacaoService.criar_notificacao(
                usuario_id=str(admin.id),
                empresa_id=empresa_id,
                tipo=tipo,
                titulo=titulo,
                mensagem=mensagem,
                acao_url=acao_url,
                prioridade=prioridade,
            )
            if notif is not None:
                notificacoes.append(notif)
        return notificacoes

    @staticmethod
    def marcar_lida(notificacao_id: str, usuario_id: str) -> Notificacao:
        """Marca uma notificação como lida e invalida o cache."""
        notificacao = NotificacaoRepository.marcar_lida(notificacao_id, usuario_id)
        NotificacaoRepository.invalidar_cache_contagem(str(usuario_id))
        return notificacao

    @staticmethod
    def marcar_todas_lidas(usuario_id: str, empresa_id: str) -> int:
        """Marca todas as notificações como lidas e invalida o cache."""
        count = NotificacaoRepository.marcar_todas_lidas(usuario_id, empresa_id)
        NotificacaoRepository.invalidar_cache_contagem(str(usuario_id))
        return count

    @staticmethod
    def contar_nao_lidas(usuario_id: str) -> int:
        """Retorna contagem de notificações não lidas (com cache Redis)."""
        return NotificacaoRepository.contar_nao_lidas(usuario_id)
