"""
Synapse — M7: URLs do módulo Equipe.
"""
from django.urls import path
from .views import (
    MembroListCreateView,
    MembroDetailView,
    ConvidarMembroView,
    ResumoEquipeView,
    MetaListCreateView,
    MetaDetailView,
)
from .kanban_views import (
    ColunasListCreateView,
    ColunaDetailView,
    ReordenarColunasView,
    TarefasPessoaisListCreateView,
    TarefaPessoalDetailView,
    MoverTarefaView,
    KanbanConsolidadoView,
)

urlpatterns = [
    path("membros/", MembroListCreateView.as_view(), name="equipe-membros-list"),
    path("membros/<uuid:pk>/", MembroDetailView.as_view(), name="equipe-membros-detail"),
    path("convidar/", ConvidarMembroView.as_view(), name="equipe-convidar"),
    path("resumo/", ResumoEquipeView.as_view(), name="equipe-resumo"),
    path("membros/<uuid:membro_id>/metas/", MetaListCreateView.as_view(), name="equipe-metas-list"),
    path("membros/<uuid:membro_id>/metas/<uuid:meta_id>/", MetaDetailView.as_view(), name="equipe-metas-detail"),

    # ── Kanban da equipe ──────────────────────────────────────────────────
    path("kanban/", KanbanConsolidadoView.as_view(), name="equipe-kanban"),
    path("kanban/colunas/", ColunasListCreateView.as_view(), name="equipe-kanban-colunas"),
    path(
        "kanban/colunas/reordenar/",
        ReordenarColunasView.as_view(),
        name="equipe-kanban-colunas-reordenar",
    ),
    path(
        "kanban/colunas/<uuid:coluna_id>/",
        ColunaDetailView.as_view(),
        name="equipe-kanban-coluna-detail",
    ),
    path("tarefas/", TarefasPessoaisListCreateView.as_view(), name="equipe-tarefas"),
    path(
        "tarefas/<uuid:tarefa_id>/",
        TarefaPessoalDetailView.as_view(),
        name="equipe-tarefa-detail",
    ),
    path(
        "tarefas/<uuid:tarefa_id>/mover/",
        MoverTarefaView.as_view(),
        name="equipe-tarefa-mover",
    ),
]
