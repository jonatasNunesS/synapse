"""
Synapse — M7: Service do módulo Equipe.
Toda a lógica de negócio passa por aqui.
"""
import logging

from django.core.cache import cache

from . import emails
from .models import MembroEquipe, MetaMembro
from .repository import EquipeRepository

logger = logging.getLogger("synapse")

# Campos da meta cujas mudanças são anunciadas no e-mail de "editada".
_CAMPOS_META_RASTREADOS = [
    "titulo", "descricao", "tipo", "valor_meta", "valor_atual",
    "periodo", "data_inicio", "data_fim",
]


def _meta_concluida(meta: MetaMembro) -> bool:
    """True se a meta atingiu/superou o alvo (alvo > 0)."""
    return bool(
        meta.valor_meta
        and float(meta.valor_meta) > 0
        and float(meta.valor_atual) >= float(meta.valor_meta)
    )


def _disparar_conclusao_se_preciso(meta: MetaMembro) -> bool:
    """
    Se a meta acabou de ser concluída (e o e-mail ainda não foi enviado),
    marca atingida + email_conclusao_enviado e dispara o e-mail de parabéns.
    Retorna True se enviou o e-mail de conclusão.
    """
    if _meta_concluida(meta) and not meta.email_conclusao_enviado:
        meta.atingida = True
        meta.email_conclusao_enviado = True
        meta.save(update_fields=["atingida", "email_conclusao_enviado"])
        emails.enviar_email_meta(meta, "concluida")
        return True
    return False

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
        # Momento 1: e-mail de "meta criada" para o membro.
        emails.enviar_email_meta(meta, "criada")
        # Caso raro: meta já nasce concluída → também dispara o parabéns (uma vez).
        _disparar_conclusao_se_preciso(meta)
        return meta

    @staticmethod
    def atualizar_meta(
        meta_id: str, membro_id: str, empresa_id: str, dados: dict
    ) -> MetaMembro:
        meta = EquipeRepository.obter_meta(meta_id, membro_id, empresa_id)

        # Captura o "antes" dos campos rastreados para montar o diff do e-mail.
        antes = {c: getattr(meta, c) for c in _CAMPOS_META_RASTREADOS}

        resultado = EquipeRepository.atualizar_meta(meta, dados)
        _invalidar_cache_equipe(empresa_id)

        # Momento 3 tem prioridade: se esta edição concluiu a meta, manda o
        # e-mail de parabéns (e NÃO o de "editada", pra não duplicar aviso).
        if _disparar_conclusao_se_preciso(resultado):
            return resultado

        # Momento 2: e-mail de "editada" com o que mudou (se algo mudou).
        campos_alterados = {}
        for campo in _CAMPOS_META_RASTREADOS:
            novo = getattr(resultado, campo)
            if antes[campo] != novo:
                campos_alterados[campo] = {"de": antes[campo], "para": novo}
        if campos_alterados:
            emails.enviar_email_meta(resultado, "editada", campos_alterados)

        return resultado

    @staticmethod
    def deletar_meta(meta_id: str, membro_id: str, empresa_id: str) -> bool:
        resultado = EquipeRepository.deletar_meta(meta_id, membro_id, empresa_id)
        _invalidar_cache_equipe(empresa_id)
        return resultado
