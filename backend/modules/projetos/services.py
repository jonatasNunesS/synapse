"""
Synapse — M6: Service do módulo Projetos e Tarefas.
Toda lógica de negócio do módulo. Regra: View → Service → Repository → Model.
"""
import logging

from shared.cache import build_cache_key, get_cached, invalidate_cache, set_cached

from .models import Comentario, Projeto, Tarefa
from .repository import ProjetoRepository

logger = logging.getLogger("synapse")

# TTLs de cache
TTL_LISTA = 120       # 2 minutos
TTL_DETALHE = 180     # 3 minutos
TTL_KANBAN = 60       # 1 minuto
TTL_RESUMO = 180      # 3 minutos


class ProjetoService:
    """Service do módulo Projetos e Tarefas."""

    # ── Projetos ──────────────────────────────────────────────

    @staticmethod
    def listar_projetos(empresa_id, filtros: dict = None):
        """Lista projetos com filtros. Cache TTL 2 min."""
        cache_key = build_cache_key(
            empresa_id, "projetos", "lista", filtros or {}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            # Retorna queryset fresco (cache só para dados serializados via views)
            pass
        return ProjetoRepository.listar_projetos(empresa_id, filtros)

    @staticmethod
    def obter_projeto(empresa_id, projeto_id) -> Projeto:
        """Obtém projeto por ID. Cache TTL 3 min."""
        projeto = ProjetoRepository.get_projeto(empresa_id, projeto_id)
        if not projeto:
            raise ValueError("Projeto não encontrado.")
        return projeto

    @staticmethod
    def criar_projeto(empresa_id, usuario_id, dados: dict) -> Projeto:
        """Cria um novo projeto e invalida cache."""
        projeto = ProjetoRepository.criar_projeto(empresa_id, usuario_id, dados)
        invalidate_cache(empresa_id, "projetos")
        logger.info(
            "Projeto criado",
            extra={
                "empresa_id": str(empresa_id),
                "projeto_id": str(projeto.id),
                "nome": projeto.nome,
            },
        )
        return projeto

    @staticmethod
    def atualizar_projeto(empresa_id, projeto_id, dados: dict) -> Projeto:
        """Atualiza projeto existente e invalida cache."""
        projeto = ProjetoRepository.get_projeto(empresa_id, projeto_id)
        if not projeto:
            raise ValueError("Projeto não encontrado.")
        projeto = ProjetoRepository.atualizar_projeto(projeto, dados)
        invalidate_cache(empresa_id, "projetos")
        return projeto

    @staticmethod
    def deletar_projeto(empresa_id, projeto_id) -> None:
        """Soft delete do projeto. Bloqueia se há tarefas ativas."""
        projeto = ProjetoRepository.get_projeto(empresa_id, projeto_id)
        if not projeto:
            raise ValueError("Projeto não encontrado.")
        if ProjetoRepository.tem_tarefas_ativas(projeto_id):
            raise ValueError(
                "Não é possível excluir um projeto com tarefas ativas. "
                "Conclua ou remova as tarefas primeiro."
            )
        ProjetoRepository.soft_delete_projeto(projeto)
        invalidate_cache(empresa_id, "projetos")

    # ── Kanban ────────────────────────────────────────────────

    @staticmethod
    def obter_kanban(empresa_id, projeto_id) -> dict:
        """Retorna Kanban do projeto. Cache TTL 1 min."""
        cache_key = build_cache_key(
            empresa_id, "projetos", "kanban", {"projeto_id": str(projeto_id)}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        kanban = ProjetoRepository.obter_kanban(empresa_id, projeto_id)
        # Não serializa aqui — a view serializa via KanbanSerializer
        return kanban

    @staticmethod
    def invalidar_cache_kanban(empresa_id, projeto_id) -> None:
        """Invalida cache do kanban de um projeto específico."""
        cache_key = build_cache_key(
            empresa_id, "projetos", "kanban", {"projeto_id": str(projeto_id)}
        )
        from django.core.cache import cache
        cache.delete(cache_key)

    # ── Tarefas ───────────────────────────────────────────────

    @staticmethod
    def listar_tarefas(empresa_id, filtros: dict = None):
        """Lista tarefas da empresa com filtros."""
        return ProjetoRepository.listar_tarefas(empresa_id, filtros)

    @staticmethod
    def obter_tarefa(empresa_id, tarefa_id) -> Tarefa:
        """Obtém tarefa por ID."""
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        return tarefa

    @staticmethod
    def criar_tarefa(empresa_id, usuario_id, dados: dict) -> Tarefa:
        """Cria nova tarefa. Valida projeto e dispara notificação se há responsável."""
        # Verificar que o projeto pertence à empresa
        projeto_id = dados.get("projeto_id") or (
            dados["projeto"].id if hasattr(dados.get("projeto"), "id") else dados.get("projeto")
        )
        projeto = ProjetoRepository.get_projeto(empresa_id, projeto_id)
        if not projeto:
            raise ValueError("Projeto não encontrado ou não pertence à sua empresa.")

        tarefa = ProjetoRepository.criar_tarefa(empresa_id, usuario_id, dados)
        invalidate_cache(empresa_id, "projetos")

        # Disparar notificação se responsável definido
        if tarefa.responsavel_id:
            from .tasks import notificar_responsavel_tarefa
            notificar_responsavel_tarefa.delay(
                str(tarefa.id), str(tarefa.responsavel_id)
            )

        logger.info(
            "Tarefa criada",
            extra={
                "empresa_id": str(empresa_id),
                "tarefa_id": str(tarefa.id),
                "projeto_id": str(tarefa.projeto_id),
            },
        )
        return tarefa

    @staticmethod
    def atualizar_tarefa(empresa_id, tarefa_id, dados: dict) -> Tarefa:
        """Atualiza tarefa existente."""
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")

        responsavel_anterior = tarefa.responsavel_id
        tarefa = ProjetoRepository.atualizar_tarefa(tarefa, dados)
        invalidate_cache(empresa_id, "projetos")

        # Notificar novo responsável se mudou
        novo_responsavel = dados.get("responsavel_id") or (
            dados["responsavel"].id
            if hasattr(dados.get("responsavel"), "id")
            else dados.get("responsavel")
        )
        if novo_responsavel and str(novo_responsavel) != str(responsavel_anterior or ""):
            from .tasks import notificar_responsavel_tarefa
            notificar_responsavel_tarefa.delay(
                str(tarefa.id), str(novo_responsavel)
            )

        return tarefa

    @staticmethod
    def deletar_tarefa(empresa_id, tarefa_id) -> None:
        """Remove tarefa permanentemente."""
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        projeto_id = tarefa.projeto_id
        ProjetoRepository.deletar_tarefa(tarefa)
        invalidate_cache(empresa_id, "projetos")

    @staticmethod
    def mover_tarefa(empresa_id, tarefa_id, novo_status: str, nova_ordem: int) -> Tarefa:
        """Move tarefa no Kanban (atômico) e invalida cache."""
        tarefa = ProjetoRepository.mover_tarefa(
            empresa_id, tarefa_id, novo_status, nova_ordem
        )
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        # Invalida cache do kanban do projeto
        ProjetoService.invalidar_cache_kanban(empresa_id, tarefa.projeto_id)
        invalidate_cache(empresa_id, "projetos")
        return tarefa

    # ── Comentários ───────────────────────────────────────────

    @staticmethod
    def listar_comentarios(empresa_id, tarefa_id):
        """Lista comentários de uma tarefa."""
        # Verificar que tarefa pertence à empresa
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        return ProjetoRepository.listar_comentarios(tarefa_id)

    @staticmethod
    def adicionar_comentario(empresa_id, tarefa_id, autor_id, texto: str) -> Comentario:
        """Adiciona comentário em uma tarefa."""
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        comentario = ProjetoRepository.criar_comentario(
            empresa_id, tarefa_id, autor_id, texto
        )
        invalidate_cache(empresa_id, "projetos")
        return comentario

    @staticmethod
    def editar_comentario(empresa_id, tarefa_id, comentario_id, autor_id, texto: str) -> Comentario:
        """Edita comentário. Apenas o autor pode editar."""
        comentario = ProjetoRepository.get_comentario(empresa_id, tarefa_id, comentario_id)
        if not comentario:
            raise ValueError("Comentário não encontrado.")
        if str(comentario.autor_id) != str(autor_id):
            raise PermissionError("Você não tem permissão para editar este comentário.")
        return ProjetoRepository.atualizar_comentario(comentario, texto)

    @staticmethod
    def deletar_comentario(empresa_id, tarefa_id, comentario_id, autor_id) -> None:
        """Deleta comentário. Apenas o autor pode deletar."""
        comentario = ProjetoRepository.get_comentario(empresa_id, tarefa_id, comentario_id)
        if not comentario:
            raise ValueError("Comentário não encontrado.")
        if str(comentario.autor_id) != str(autor_id):
            raise PermissionError("Você não tem permissão para deletar este comentário.")
        ProjetoRepository.deletar_comentario(comentario)

    # ── Checklist ─────────────────────────────────────────────

    @staticmethod
    def adicionar_checklist_item(empresa_id, tarefa_id, texto: str, ordem: int = 0):
        """Adiciona item ao checklist de uma tarefa."""
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        return ProjetoRepository.criar_checklist_item(tarefa_id, texto, ordem)

    @staticmethod
    def toggle_checklist_item(empresa_id, tarefa_id, item_id):
        """Alterna estado de um item de checklist."""
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        item = ProjetoRepository.get_checklist_item(tarefa_id, item_id)
        if not item:
            raise ValueError("Item de checklist não encontrado.")
        return ProjetoRepository.toggle_checklist_item(item)

    @staticmethod
    def deletar_checklist_item(empresa_id, tarefa_id, item_id) -> None:
        """Remove item do checklist."""
        tarefa = ProjetoRepository.get_tarefa(empresa_id, tarefa_id)
        if not tarefa:
            raise ValueError("Tarefa não encontrada.")
        item = ProjetoRepository.get_checklist_item(tarefa_id, item_id)
        if not item:
            raise ValueError("Item de checklist não encontrado.")
        ProjetoRepository.deletar_checklist_item(item)

    # ── Resumo ────────────────────────────────────────────────

    @staticmethod
    def obter_resumo(empresa_id, usuario_id) -> dict:
        """KPIs do módulo. Cache TTL 3 min."""
        cache_key = build_cache_key(
            empresa_id, "projetos", "resumo", {"usuario_id": str(usuario_id)}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        resumo = ProjetoRepository.calcular_resumo(empresa_id, usuario_id)
        set_cached(cache_key, resumo, TTL_RESUMO)
        return resumo
