"""
Synapse — M6: Repository do módulo Projetos e Tarefas.
Toda query ao banco de dados passa por aqui. Nunca diretamente nas views.
"""
import logging
from datetime import date

from django.db import transaction
from django.db.models import Count, Q

from .models import ChecklistItem, Comentario, Projeto, Tarefa

logger = logging.getLogger("synapse")


class ProjetoRepository:
    """Repositório de queries do módulo Projetos."""

    # ── Projetos ──────────────────────────────────────────────

    @staticmethod
    def listar_projetos(empresa_id, filtros: dict = None):
        """Lista projetos ativos com filtros opcionais."""
        qs = (
            Projeto.objects.filter(empresa_id=empresa_id, ativo=True)
            .select_related("responsavel", "criado_por")
            .prefetch_related("tarefas")
        )

        if filtros:
            if filtros.get("status"):
                qs = qs.filter(status=filtros["status"])
            if filtros.get("prioridade"):
                qs = qs.filter(prioridade=filtros["prioridade"])
            if filtros.get("responsavel_id"):
                qs = qs.filter(responsavel_id=filtros["responsavel_id"])
            if filtros.get("esta_atrasado") in (True, "true", "True", "1"):
                qs = qs.filter(
                    data_prazo__lt=date.today()
                ).exclude(status__in=["concluido", "cancelado"])
            if filtros.get("busca"):
                qs = qs.filter(nome__icontains=filtros["busca"])

        return qs.order_by("-criado_em")

    @staticmethod
    def get_projeto(empresa_id, projeto_id):
        """Busca projeto por ID garantindo multi-tenant."""
        return (
            Projeto.objects.filter(empresa_id=empresa_id, id=projeto_id, ativo=True)
            .select_related("responsavel", "criado_por")
            .prefetch_related("tarefas__responsavel")
            .first()
        )

    @staticmethod
    def criar_projeto(empresa_id, usuario_id, dados: dict) -> Projeto:
        """Cria um novo projeto."""
        return Projeto.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def atualizar_projeto(projeto: Projeto, dados: dict) -> Projeto:
        """Atualiza um projeto existente."""
        for campo, valor in dados.items():
            setattr(projeto, campo, valor)
        projeto.save()
        return projeto

    @staticmethod
    def soft_delete_projeto(projeto: Projeto) -> Projeto:
        """Soft delete: marca projeto como inativo."""
        projeto.ativo = False
        projeto.save(update_fields=["ativo", "atualizado_em"])
        return projeto

    @staticmethod
    def tem_tarefas_ativas(projeto_id) -> bool:
        """Verifica se o projeto tem tarefas ativas (não concluídas)."""
        return Tarefa.objects.filter(
            projeto_id=projeto_id
        ).exclude(status="concluido").exists()

    # ── Kanban ────────────────────────────────────────────────

    @staticmethod
    def obter_kanban(empresa_id, projeto_id) -> dict:
        """Retorna tarefas do projeto agrupadas por status para o Kanban."""
        tarefas = (
            Tarefa.objects.filter(
                empresa_id=empresa_id,
                projeto_id=projeto_id,
            )
            .select_related("responsavel")
            .order_by("ordem", "criado_em")
        )

        grupos = {
            "a_fazer": [],
            "em_andamento": [],
            "revisao": [],
            "concluido": [],
        }
        totais = {k: 0 for k in grupos}

        for tarefa in tarefas:
            if tarefa.status in grupos:
                grupos[tarefa.status].append(tarefa)
                totais[tarefa.status] += 1

        return {**grupos, "totais": totais}

    # ── Tarefas ───────────────────────────────────────────────

    @staticmethod
    def listar_tarefas(empresa_id, filtros: dict = None):
        """Lista tarefas da empresa com filtros opcionais."""
        qs = (
            Tarefa.objects.filter(empresa_id=empresa_id)
            .select_related("projeto", "responsavel", "criado_por")
        )

        if filtros:
            if filtros.get("projeto_id"):
                qs = qs.filter(projeto_id=filtros["projeto_id"])
            if filtros.get("status"):
                qs = qs.filter(status=filtros["status"])
            if filtros.get("prioridade"):
                qs = qs.filter(prioridade=filtros["prioridade"])
            if filtros.get("responsavel_id"):
                qs = qs.filter(responsavel_id=filtros["responsavel_id"])
            if filtros.get("esta_atrasada") in (True, "true", "True", "1"):
                qs = qs.filter(
                    data_prazo__lt=date.today()
                ).exclude(status="concluido")
            if filtros.get("busca"):
                qs = qs.filter(titulo__icontains=filtros["busca"])

        return qs.order_by("ordem", "criado_em")

    @staticmethod
    def get_tarefa(empresa_id, tarefa_id):
        """Busca tarefa por ID garantindo multi-tenant."""
        return (
            Tarefa.objects.filter(empresa_id=empresa_id, id=tarefa_id)
            .select_related("projeto", "responsavel", "criado_por")
            .prefetch_related("comentarios__autor", "checklist")
            .first()
        )

    @staticmethod
    def get_tarefa_by_projeto(empresa_id, projeto_id, tarefa_id):
        """Busca tarefa por ID dentro de um projeto específico."""
        return (
            Tarefa.objects.filter(
                empresa_id=empresa_id,
                projeto_id=projeto_id,
                id=tarefa_id,
            )
            .select_related("projeto", "responsavel", "criado_por")
            .prefetch_related("comentarios__autor", "checklist")
            .first()
        )

    @staticmethod
    def criar_tarefa(empresa_id, usuario_id, dados: dict) -> Tarefa:
        """Cria uma nova tarefa."""
        return Tarefa.objects.create(
            empresa_id=empresa_id,
            criado_por_id=usuario_id,
            **dados,
        )

    @staticmethod
    def atualizar_tarefa(tarefa: Tarefa, dados: dict) -> Tarefa:
        """Atualiza uma tarefa existente."""
        for campo, valor in dados.items():
            setattr(tarefa, campo, valor)
        tarefa.save()
        return tarefa

    @staticmethod
    def deletar_tarefa(tarefa: Tarefa) -> None:
        """Remove uma tarefa permanentemente."""
        tarefa.delete()

    @staticmethod
    @transaction.atomic
    def mover_tarefa(empresa_id, tarefa_id, novo_status: str, nova_ordem: int) -> Tarefa:
        """
        Move tarefa no Kanban com reordenação atômica.
        - Atualiza status e ordem da tarefa
        - Reordena demais tarefas da coluna destino
        - Preenche/limpa data_conclusao conforme status
        """
        tarefa = (
            Tarefa.objects.select_for_update()
            .filter(empresa_id=empresa_id, id=tarefa_id)
            .first()
        )
        if not tarefa:
            return None

        # Reordenar tarefas da coluna destino (incrementar as >= nova_ordem)
        Tarefa.objects.filter(
            projeto_id=tarefa.projeto_id,
            status=novo_status,
            ordem__gte=nova_ordem,
        ).exclude(id=tarefa_id).update(ordem=models_F("ordem") + 1)

        # Atualizar status e ordem
        tarefa.status = novo_status
        tarefa.ordem = nova_ordem

        # Gerenciar data_conclusao
        if novo_status == "concluido":
            tarefa.data_conclusao = date.today()
        elif tarefa.data_conclusao is not None:
            tarefa.data_conclusao = None

        tarefa.save()
        return tarefa

    # ── Comentários ───────────────────────────────────────────

    @staticmethod
    def listar_comentarios(tarefa_id):
        """Lista comentários de uma tarefa."""
        return (
            Comentario.objects.filter(tarefa_id=tarefa_id)
            .select_related("autor")
            .order_by("criado_em")
        )

    @staticmethod
    def get_comentario(empresa_id, tarefa_id, comentario_id):
        """Busca comentário por ID garantindo multi-tenant."""
        return Comentario.objects.filter(
            empresa_id=empresa_id,
            tarefa_id=tarefa_id,
            id=comentario_id,
        ).first()

    @staticmethod
    def criar_comentario(empresa_id, tarefa_id, autor_id, texto: str) -> Comentario:
        """Cria um novo comentário."""
        return Comentario.objects.create(
            empresa_id=empresa_id,
            tarefa_id=tarefa_id,
            autor_id=autor_id,
            texto=texto,
        )

    @staticmethod
    def atualizar_comentario(comentario: Comentario, texto: str) -> Comentario:
        """Atualiza o texto de um comentário."""
        comentario.texto = texto
        comentario.editado = True
        comentario.save(update_fields=["texto", "editado", "atualizado_em"])
        return comentario

    @staticmethod
    def deletar_comentario(comentario: Comentario) -> None:
        """Remove um comentário."""
        comentario.delete()

    # ── Checklist ─────────────────────────────────────────────

    @staticmethod
    def get_checklist_item(tarefa_id, item_id):
        """Busca item de checklist por ID."""
        return ChecklistItem.objects.filter(
            tarefa_id=tarefa_id, id=item_id
        ).first()

    @staticmethod
    def criar_checklist_item(tarefa_id, texto: str, ordem: int = 0) -> ChecklistItem:
        """Cria um novo item de checklist."""
        return ChecklistItem.objects.create(
            tarefa_id=tarefa_id,
            texto=texto,
            ordem=ordem,
        )

    @staticmethod
    def toggle_checklist_item(item: ChecklistItem) -> ChecklistItem:
        """Alterna o estado concluído de um item de checklist."""
        item.concluido = not item.concluido
        item.save(update_fields=["concluido"])
        return item

    @staticmethod
    def deletar_checklist_item(item: ChecklistItem) -> None:
        """Remove um item de checklist."""
        item.delete()

    # ── Resumo ────────────────────────────────────────────────

    @staticmethod
    def calcular_resumo(empresa_id, usuario_id) -> dict:
        """Calcula KPIs do módulo de projetos."""
        hoje = date.today()

        total_projetos = Projeto.objects.filter(
            empresa_id=empresa_id, ativo=True
        ).count()

        projetos_ativos = Projeto.objects.filter(
            empresa_id=empresa_id,
            ativo=True,
            status__in=["planejamento", "em_andamento"],
        ).count()

        projetos_atrasados = Projeto.objects.filter(
            empresa_id=empresa_id,
            ativo=True,
            data_prazo__lt=hoje,
        ).exclude(status__in=["concluido", "cancelado"]).count()

        tarefas_pendentes = Tarefa.objects.filter(
            empresa_id=empresa_id,
        ).exclude(status="concluido").count()

        tarefas_minhas = Tarefa.objects.filter(
            empresa_id=empresa_id,
            responsavel_id=usuario_id,
        ).exclude(status="concluido").count()

        tarefas_atrasadas = Tarefa.objects.filter(
            empresa_id=empresa_id,
            data_prazo__lt=hoje,
        ).exclude(status="concluido").count()

        # Contagem por status
        status_counts = (
            Projeto.objects.filter(empresa_id=empresa_id, ativo=True)
            .values("status")
            .annotate(total=Count("id"))
        )
        projetos_por_status = {
            "planejamento": 0,
            "em_andamento": 0,
            "pausado": 0,
            "concluido": 0,
            "cancelado": 0,
        }
        for row in status_counts:
            projetos_por_status[row["status"]] = row["total"]

        return {
            "total_projetos": total_projetos,
            "projetos_ativos": projetos_ativos,
            "projetos_atrasados": projetos_atrasados,
            "tarefas_pendentes": tarefas_pendentes,
            "tarefas_minhas": tarefas_minhas,
            "tarefas_atrasadas": tarefas_atrasadas,
            "projetos_por_status": projetos_por_status,
        }

    # ── Tarefas para Tasks Celery ─────────────────────────────

    @staticmethod
    def listar_tarefas_vencendo_hoje():
        """Tarefas com prazo = hoje e não concluídas (para notificações)."""
        return (
            Tarefa.objects.filter(
                data_prazo=date.today(),
            )
            .exclude(status="concluido")
            .select_related("empresa", "responsavel", "projeto")
        )

    @staticmethod
    def listar_tarefas_atrasadas():
        """Tarefas com prazo < hoje e não concluídas."""
        return (
            Tarefa.objects.filter(
                data_prazo__lt=date.today(),
            )
            .exclude(status="concluido")
            .select_related("empresa", "responsavel", "projeto")
        )

    @staticmethod
    def listar_projetos_atrasados():
        """Projetos com prazo < hoje e não concluídos/cancelados."""
        return (
            Projeto.objects.filter(
                ativo=True,
                data_prazo__lt=date.today(),
            )
            .exclude(status__in=["concluido", "cancelado"])
            .select_related("empresa", "responsavel", "criado_por")
        )


# Importação tardia para evitar circular import no mover_tarefa
from django.db.models import F as models_F  # noqa: E402
