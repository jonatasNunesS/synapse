"""
Synapse — Equipe: Service do Kanban da equipe (regras + permissões).

Permissões:
- Colunas: só admin cria/edita/exclui/reordena.
- Tarefas pessoais: admin cria/edita/apaga para qualquer membro; membro comum
  só para si mesmo (responsável = ele).
"""
from .exceptions import PermissaoNegadaError, RegraKanbanError
from .kanban_repository import KanbanEquipeRepository
from .models import TarefaPessoal


def _is_admin(user) -> bool:
    return getattr(user, "perfil", None) == "admin"


class KanbanEquipeService:
    # ── Colunas ──────────────────────────────────────────────────────────────
    @staticmethod
    def listar_colunas(empresa_id: str):
        return KanbanEquipeRepository.listar_colunas(empresa_id)

    @staticmethod
    def criar_coluna(empresa_id: str, solicitante, dados: dict):
        if not _is_admin(solicitante):
            raise PermissaoNegadaError("Só administradores gerenciam colunas.")
        if dados.get("ordem") in (None, ""):
            dados["ordem"] = KanbanEquipeRepository.proxima_ordem_coluna(empresa_id)
        return KanbanEquipeRepository.criar_coluna(empresa_id, dados)

    @staticmethod
    def atualizar_coluna(empresa_id: str, solicitante, coluna_id: str, dados: dict):
        if not _is_admin(solicitante):
            raise PermissaoNegadaError("Só administradores gerenciam colunas.")
        coluna = KanbanEquipeRepository.get_coluna(empresa_id, coluna_id)
        if coluna is None:
            raise RegraKanbanError("Coluna não encontrada.")
        return KanbanEquipeRepository.atualizar_coluna(coluna, dados)

    @staticmethod
    def excluir_coluna(empresa_id: str, solicitante, coluna_id: str, mover_para: str = None):
        if not _is_admin(solicitante):
            raise PermissaoNegadaError("Só administradores gerenciam colunas.")
        coluna = KanbanEquipeRepository.get_coluna(empresa_id, coluna_id)
        if coluna is None:
            raise RegraKanbanError("Coluna não encontrada.")

        tem_tarefas = TarefaPessoal.objects.filter(
            empresa_id=empresa_id, coluna_id=coluna_id
        ).exists()
        if tem_tarefas:
            if not mover_para:
                raise RegraKanbanError(
                    "Esta coluna tem tarefas. Escolha para qual coluna movê-las "
                    "antes de excluir."
                )
            destino = KanbanEquipeRepository.get_coluna(empresa_id, mover_para)
            if destino is None or str(destino.id) == str(coluna_id):
                raise RegraKanbanError("Coluna de destino inválida.")
            KanbanEquipeRepository.mover_tarefas_para_coluna(
                empresa_id, coluna_id, str(destino.id)
            )
        KanbanEquipeRepository.deletar_coluna(coluna)

    @staticmethod
    def reordenar_colunas(empresa_id: str, solicitante, ordens: list):
        if not _is_admin(solicitante):
            raise PermissaoNegadaError("Só administradores gerenciam colunas.")
        KanbanEquipeRepository.reordenar_colunas(empresa_id, ordens)
        return KanbanEquipeRepository.listar_colunas(empresa_id)

    # ── Tarefas pessoais ─────────────────────────────────────────────────────
    @staticmethod
    def listar_tarefas(empresa_id: str, filtros: dict = None):
        return KanbanEquipeRepository.listar_tarefas(empresa_id, filtros)

    @staticmethod
    def criar_tarefa(empresa_id: str, solicitante, dados: dict):
        responsavel = dados.get("responsavel")
        responsavel_id = getattr(responsavel, "id", responsavel)
        # Membro comum só cria tarefa para si mesmo.
        if not _is_admin(solicitante) and str(responsavel_id) != str(solicitante.id):
            raise PermissaoNegadaError(
                "Você só pode criar tarefas para você mesmo."
            )
        coluna = dados.get("coluna")
        coluna_id = getattr(coluna, "id", coluna)
        if KanbanEquipeRepository.get_coluna(empresa_id, coluna_id) is None:
            raise RegraKanbanError("Coluna inválida.")
        dados["criado_por"] = solicitante
        if dados.get("ordem") in (None, ""):
            dados["ordem"] = KanbanEquipeRepository.proxima_ordem_tarefa(
                empresa_id, coluna_id
            )
        return KanbanEquipeRepository.criar_tarefa(empresa_id, dados)

    @staticmethod
    def _obter_tarefa_com_permissao(empresa_id: str, solicitante, tarefa_id: str):
        tarefa = KanbanEquipeRepository.get_tarefa(empresa_id, tarefa_id)
        if tarefa is None:
            raise RegraKanbanError("Tarefa não encontrada.")
        if not _is_admin(solicitante) and str(tarefa.responsavel_id) != str(solicitante.id):
            raise PermissaoNegadaError(
                "Você só pode alterar as suas próprias tarefas."
            )
        return tarefa

    @staticmethod
    def atualizar_tarefa(empresa_id: str, solicitante, tarefa_id: str, dados: dict):
        tarefa = KanbanEquipeService._obter_tarefa_com_permissao(
            empresa_id, solicitante, tarefa_id
        )
        # Reatribuir para outro membro é privilégio de admin.
        if "responsavel" in dados and not _is_admin(solicitante):
            novo = getattr(dados["responsavel"], "id", dados["responsavel"])
            if str(novo) != str(solicitante.id):
                raise PermissaoNegadaError("Você não pode reatribuir a tarefa.")
        return KanbanEquipeRepository.atualizar_tarefa(tarefa, dados)

    @staticmethod
    def deletar_tarefa(empresa_id: str, solicitante, tarefa_id: str):
        tarefa = KanbanEquipeService._obter_tarefa_com_permissao(
            empresa_id, solicitante, tarefa_id
        )
        KanbanEquipeRepository.deletar_tarefa(tarefa)

    @staticmethod
    def mover_tarefa(empresa_id: str, solicitante, tarefa_id: str, coluna_id: str, ordem: int):
        tarefa = KanbanEquipeService._obter_tarefa_com_permissao(
            empresa_id, solicitante, tarefa_id
        )
        if KanbanEquipeRepository.get_coluna(empresa_id, coluna_id) is None:
            raise RegraKanbanError("Coluna de destino inválida.")
        return KanbanEquipeRepository.mover_tarefa(tarefa, coluna_id, ordem or 0)

    # ── Board consolidado ────────────────────────────────────────────────────
    @staticmethod
    def montar_kanban(empresa_id: str, membro_id: str = None):
        return KanbanEquipeRepository.montar_kanban(empresa_id, membro_id)
