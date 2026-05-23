"""
Synapse — M7: Service do módulo Equipe.
Toda a lógica de negócio passa por aqui.
"""
import logging
from .repository import EquipeRepository
from .models import MembroEquipe, MetaMembro

logger = logging.getLogger("synapse")


class EquipeService:

    @staticmethod
    def adicionar_membro(empresa_id: str, usuario_id: str, dados: dict) -> MembroEquipe:
        """Adiciona um usuário existente à equipe."""
        membro = EquipeRepository.criar(empresa_id, usuario_id, dados)
        logger.info("Membro adicionado à equipe", extra={"empresa_id": empresa_id, "usuario_id": usuario_id})
        return membro

    @staticmethod
    def convidar_membro(empresa_id: str, dados_usuario: dict, dados_membro: dict):
        """Cria novo usuário e adiciona à equipe. Dispara e-mail de boas-vindas via Celery."""
        from .tasks import enviar_email_boas_vindas
        from modules.auth.models import Empresa

        empresa = Empresa.objects.get(id=empresa_id)
        usuario, membro = EquipeRepository.criar_membro_convidado(
            empresa_id, dados_usuario, dados_membro
        )
        # Disparar e-mail de boas-vindas via Celery
        enviar_email_boas_vindas.delay(str(usuario.id), empresa.nome)
        logger.info("Membro convidado", extra={"empresa_id": empresa_id, "email": usuario.email})
        return usuario, membro

    @staticmethod
    def atualizar_membro(membro_id: str, empresa_id: str, dados: dict) -> MembroEquipe:
        membro = EquipeRepository.obter(membro_id, empresa_id)
        return EquipeRepository.atualizar(membro, dados)

    @staticmethod
    def remover_membro(membro_id: str, empresa_id: str) -> bool:
        return EquipeRepository.deletar(membro_id, empresa_id)

    @staticmethod
    def obter_resumo(empresa_id: str) -> dict:
        return EquipeRepository.resumo(empresa_id)

    @staticmethod
    def criar_meta(membro_id: str, empresa_id: str, dados: dict) -> MetaMembro:
        # Verificar que o membro pertence à empresa
        EquipeRepository.obter(membro_id, empresa_id)
        return EquipeRepository.criar_meta(membro_id, empresa_id, dados)

    @staticmethod
    def atualizar_meta(meta_id: str, membro_id: str, empresa_id: str, dados: dict) -> MetaMembro:
        meta = EquipeRepository.obter_meta(meta_id, membro_id, empresa_id)
        return EquipeRepository.atualizar_meta(meta, dados)

    @staticmethod
    def deletar_meta(meta_id: str, membro_id: str, empresa_id: str) -> bool:
        return EquipeRepository.deletar_meta(meta_id, membro_id, empresa_id)
