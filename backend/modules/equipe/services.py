"""
Synapse — M7: Service do módulo Equipe.
Toda a lógica de negócio passa por aqui.
"""
import logging

from django.core.cache import cache

from .models import MembroEquipe, MetaMembro
from .repository import EquipeRepository

logger = logging.getLogger("synapse")

# Chaves de cache (espelham as constantes do repository)
_CACHE_MEMBROS = "synapse:{empresa_id}:equipe:membros"
_CACHE_RESUMO = "synapse:{empresa_id}:equipe:resumo"


def _invalidar_cache_equipe(empresa_id: str) -> None:
    """Invalida o cache de membros e resumo da equipe."""
    cache.delete(_CACHE_MEMBROS.format(empresa_id=empresa_id))
    cache.delete(_CACHE_RESUMO.format(empresa_id=empresa_id))


class EquipeService:

    @staticmethod
    def adicionar_membro(empresa_id: str, usuario_id: str, dados: dict) -> MembroEquipe:
        """Adiciona um usuário existente à equipe."""
        membro = EquipeRepository.criar(empresa_id, usuario_id, dados)
        _invalidar_cache_equipe(empresa_id)
        logger.info(
            "Membro adicionado à equipe",
            extra={"empresa_id": empresa_id, "usuario_id": usuario_id},
        )
        return membro

    @staticmethod
    def convidar_membro(empresa_id: str, dados_usuario: dict, dados_membro: dict):
        """
        Cria o membro convidado de forma ATÔMICA com o envio do e-mail: usuário
        (sem senha utilizável) + membro + token de primeiro acesso + envio do
        convite acontecem numa única transação. Se o e-mail não puder ser
        enviado, ConviteEmailError sobe e faz rollback de tudo — nada de membro
        fantasma. O envio é síncrono justamente para permitir esse rollback.
        """
        from django.db import transaction
        from .tasks import enviar_convite_email
        from modules.auth.models import Empresa
        from modules.auth.services import AuthService

        empresa = Empresa.objects.get(id=empresa_id)

        with transaction.atomic():
            usuario, membro = EquipeRepository.criar_membro_convidado(
                empresa_id, dados_usuario, dados_membro
            )
            # Token de convite (48h, uso único) — mesmo mecanismo do reset
            token = AuthService.gerar_token_convite(usuario)
            # Síncrono e dentro da transação: se falhar, tudo acima é revertido
            enviar_convite_email(usuario, empresa.nome, token)

        _invalidar_cache_equipe(empresa_id)
        logger.info(
            "Membro convidado",
            extra={"empresa_id": empresa_id, "email": usuario.email},
        )
        return usuario, membro

    @staticmethod
    def atualizar_membro(membro_id: str, empresa_id: str, dados: dict) -> MembroEquipe:
        membro = EquipeRepository.obter(membro_id, empresa_id)
        resultado = EquipeRepository.atualizar(membro, dados)
        _invalidar_cache_equipe(empresa_id)
        return resultado

    @staticmethod
    def remover_membro(membro_id: str, empresa_id: str, solicitante_id: str = None) -> bool:
        resultado = EquipeRepository.deletar(membro_id, empresa_id, solicitante_id)
        _invalidar_cache_equipe(empresa_id)
        return resultado

    @staticmethod
    def obter_resumo(empresa_id: str) -> dict:
        return EquipeRepository.resumo(empresa_id)

    @staticmethod
    def criar_meta(membro_id: str, empresa_id: str, dados: dict) -> MetaMembro:
        EquipeRepository.obter(membro_id, empresa_id)
        meta = EquipeRepository.criar_meta(membro_id, empresa_id, dados)
        _invalidar_cache_equipe(empresa_id)
        return meta

    @staticmethod
    def atualizar_meta(
        meta_id: str, membro_id: str, empresa_id: str, dados: dict
    ) -> MetaMembro:
        meta = EquipeRepository.obter_meta(meta_id, membro_id, empresa_id)
        resultado = EquipeRepository.atualizar_meta(meta, dados)
        _invalidar_cache_equipe(empresa_id)
        return resultado

    @staticmethod
    def deletar_meta(meta_id: str, membro_id: str, empresa_id: str) -> bool:
        resultado = EquipeRepository.deletar_meta(meta_id, membro_id, empresa_id)
        _invalidar_cache_equipe(empresa_id)
        return resultado
