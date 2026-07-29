"""
Synapse — Equipe: Repository do Kanban da equipe.

Colunas (ColunaKanbanEquipe) + tarefas pessoais (TarefaPessoal) + a visão
consolidada que junta tarefas pessoais e tarefas de projeto (read-only).

Cache do board consolidado: TTL 60s, invalidado por versão (bump em qualquer
mutação de coluna/tarefa), o que zera todas as variações por membro de uma vez.
"""
from django.core.cache import cache
from django.db import transaction
from django.db.models import Max

from modules.projetos.models import Tarefa

from .models import ColunaKanbanEquipe, TarefaPessoal

CACHE_KANBAN_VERSION = "synapse:{empresa_id}:equipe:kanban:version"
CACHE_KANBAN_KEY = "synapse:{empresa_id}:equipe:kanban:{membro}:v{version}"
CACHE_KANBAN_TTL = 60


def _versao(empresa_id: str) -> int:
    return int(cache.get(CACHE_KANBAN_VERSION.format(empresa_id=empresa_id)) or 1)


def invalidar_kanban(empresa_id: str) -> None:
    """Bump da versão → invalida todas as variações (por membro) do board."""
    chave = CACHE_KANBAN_VERSION.format(empresa_id=empresa_id)
    try:
        cache.incr(chave)
    except ValueError:
        cache.set(chave, _versao(empresa_id) + 1)


class KanbanEquipeRepository:
    # ── Colunas ──────────────────────────────────────────────────────────────
    @staticmethod
    def listar_colunas(empresa_id: str):
        return ColunaKanbanEquipe.objects.filter(empresa_id=empresa_id).order_by(
            "ordem", "criado_em"
        )

    @staticmethod
    def get_coluna(empresa_id: str, coluna_id: str):
        return ColunaKanbanEquipe.objects.filter(
            empresa_id=empresa_id, id=coluna_id
        ).first()

    @staticmethod
    def proxima_ordem_coluna(empresa_id: str) -> int:
        atual = ColunaKanbanEquipe.objects.filter(empresa_id=empresa_id).aggregate(
            m=Max("ordem")
        )["m"]
        return (atual or 0) + 1

    @staticmethod
    def criar_coluna(empresa_id: str, dados: dict) -> ColunaKanbanEquipe:
        coluna = ColunaKanbanEquipe.objects.create(empresa_id=empresa_id, **dados)
        invalidar_kanban(empresa_id)
        return coluna

    @staticmethod
    def atualizar_coluna(coluna: ColunaKanbanEquipe, dados: dict) -> ColunaKanbanEquipe:
        for campo, valor in dados.items():
            setattr(coluna, campo, valor)
        coluna.save()
        invalidar_kanban(str(coluna.empresa_id))
        return coluna

    @staticmethod
    def deletar_coluna(coluna: ColunaKanbanEquipe) -> None:
        empresa_id = str(coluna.empresa_id)
        coluna.delete()
        invalidar_kanban(empresa_id)

    @staticmethod
    @transaction.atomic
    def reordenar_colunas(empresa_id: str, ordens: list) -> None:
        """ordens: [{"id": uuid, "ordem": int}, ...] — atualiza em batch."""
        mapa = {str(o["id"]): o["ordem"] for o in ordens}
        colunas = ColunaKanbanEquipe.objects.filter(
            empresa_id=empresa_id, id__in=list(mapa.keys())
        )
        for col in colunas:
            col.ordem = mapa[str(col.id)]
        ColunaKanbanEquipe.objects.bulk_update(colunas, ["ordem"])
        invalidar_kanban(empresa_id)

    @staticmethod
    def mover_tarefas_para_coluna(empresa_id: str, de_coluna_id: str, para_coluna_id: str) -> int:
        """Move todas as tarefas pessoais de uma coluna para outra."""
        return TarefaPessoal.objects.filter(
            empresa_id=empresa_id, coluna_id=de_coluna_id
        ).update(coluna_id=para_coluna_id)

    # ── Tarefas pessoais ─────────────────────────────────────────────────────
    @staticmethod
    def listar_tarefas(empresa_id: str, filtros: dict = None):
        qs = (
            TarefaPessoal.objects.filter(empresa_id=empresa_id)
            .select_related("responsavel", "coluna")
            .order_by("ordem", "criado_em")
        )
        filtros = filtros or {}
        if filtros.get("membro"):
            qs = qs.filter(responsavel_id=filtros["membro"])
        if filtros.get("coluna"):
            qs = qs.filter(coluna_id=filtros["coluna"])
        return qs

    @staticmethod
    def get_tarefa(empresa_id: str, tarefa_id: str):
        return (
            TarefaPessoal.objects.filter(empresa_id=empresa_id, id=tarefa_id)
            .select_related("responsavel", "coluna")
            .first()
        )

    @staticmethod
    def proxima_ordem_tarefa(empresa_id: str, coluna_id: str) -> int:
        atual = TarefaPessoal.objects.filter(
            empresa_id=empresa_id, coluna_id=coluna_id
        ).aggregate(m=Max("ordem"))["m"]
        return (atual or 0) + 1

    @staticmethod
    def criar_tarefa(empresa_id: str, dados: dict) -> TarefaPessoal:
        tarefa = TarefaPessoal.objects.create(empresa_id=empresa_id, **dados)
        invalidar_kanban(empresa_id)
        return tarefa

    @staticmethod
    def atualizar_tarefa(tarefa: TarefaPessoal, dados: dict) -> TarefaPessoal:
        for campo, valor in dados.items():
            setattr(tarefa, campo, valor)
        tarefa.save()
        invalidar_kanban(str(tarefa.empresa_id))
        return tarefa

    @staticmethod
    def deletar_tarefa(tarefa: TarefaPessoal) -> None:
        empresa_id = str(tarefa.empresa_id)
        tarefa.delete()
        invalidar_kanban(empresa_id)

    @staticmethod
    def mover_tarefa(tarefa: TarefaPessoal, coluna_id: str, ordem: int) -> TarefaPessoal:
        tarefa.coluna_id = coluna_id
        tarefa.ordem = ordem
        tarefa.save(update_fields=["coluna", "ordem", "atualizado_em"])
        invalidar_kanban(str(tarefa.empresa_id))
        return tarefa

    # ── Board consolidado ────────────────────────────────────────────────────
    @staticmethod
    def montar_kanban(empresa_id: str, membro_id: str = None) -> dict:
        """
        Board consolidado: para cada coluna, junta tarefas pessoais + tarefas de
        projeto (read-only) daquela coluna. Filtra por membro se informado.
        Resultado é cacheado por 60s (versão por empresa).
        """
        versao = _versao(empresa_id)
        chave = CACHE_KANBAN_KEY.format(
            empresa_id=empresa_id, membro=membro_id or "all", version=versao
        )
        cacheado = cache.get(chave)
        if cacheado is not None:
            return cacheado

        colunas = list(
            ColunaKanbanEquipe.objects.filter(empresa_id=empresa_id).order_by(
                "ordem", "criado_em"
            )
        )

        pessoais_qs = TarefaPessoal.objects.filter(empresa_id=empresa_id).select_related(
            "responsavel"
        )
        projeto_qs = (
            Tarefa.objects.filter(
                empresa_id=empresa_id, coluna_kanban_equipe__isnull=False
            )
            .select_related("responsavel", "projeto")
        )
        if membro_id:
            pessoais_qs = pessoais_qs.filter(responsavel_id=membro_id)
            projeto_qs = projeto_qs.filter(responsavel_id=membro_id)

        # Agrupa por coluna_id
        pessoais_por_col: dict = {}
        for t in pessoais_qs:
            pessoais_por_col.setdefault(str(t.coluna_id), []).append(t)
        projeto_por_col: dict = {}
        for t in projeto_qs:
            projeto_por_col.setdefault(str(t.coluna_kanban_equipe_id), []).append(t)

        resultado = {"colunas": []}
        for col in colunas:
            cid = str(col.id)
            tarefas = [
                _tarefa_pessoal_dict(t) for t in pessoais_por_col.get(cid, [])
            ] + [_tarefa_projeto_dict(t) for t in projeto_por_col.get(cid, [])]
            tarefas.sort(key=lambda x: (x["ordem"], x["titulo"]))
            resultado["colunas"].append(
                {
                    "id": cid,
                    "nome": col.nome,
                    "ordem": col.ordem,
                    "cor": col.cor,
                    "tarefas": tarefas,
                }
            )

        cache.set(chave, resultado, CACHE_KANBAN_TTL)
        return resultado


def _responsavel_dict(user):
    if not user:
        return None
    return {
        "id": str(user.id),
        "nome": user.nome or user.email,
        "avatar_url": getattr(user, "avatar_url", "") or "",
    }


def _tarefa_pessoal_dict(t: TarefaPessoal) -> dict:
    return {
        "id": str(t.id),
        "origem": "pessoal",
        "titulo": t.titulo,
        "descricao": t.descricao,
        "prioridade": t.prioridade,
        "prazo": t.prazo.isoformat() if t.prazo else None,
        "esta_atrasada": t.esta_atrasada,
        "coluna_id": str(t.coluna_id),
        "ordem": t.ordem,
        "responsavel": _responsavel_dict(t.responsavel),
        "read_only": False,
        "projeto_id": None,
        "projeto_nome": None,
    }


def _tarefa_projeto_dict(t: Tarefa) -> dict:
    return {
        "id": str(t.id),
        "origem": "projeto",
        "titulo": t.titulo,
        "descricao": t.descricao,
        "prioridade": t.prioridade,
        "prazo": t.data_prazo.isoformat() if t.data_prazo else None,
        "esta_atrasada": t.esta_atrasada,
        "coluna_id": str(t.coluna_kanban_equipe_id),
        "ordem": t.ordem,
        "responsavel": _responsavel_dict(t.responsavel),
        "read_only": True,
        "projeto_id": str(t.projeto_id),
        "projeto_nome": t.projeto.nome if t.projeto_id else None,
    }
