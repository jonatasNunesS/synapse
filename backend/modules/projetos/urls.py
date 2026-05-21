"""
Synapse — M6: URLs do módulo Projetos e Tarefas.
"""
from django.urls import path

from .views import (
    ChecklistCreateView,
    ChecklistDetailView,
    ComentarioDetailView,
    ComentarioListCreateView,
    ProjetoDetailView,
    ProjetoKanbanView,
    ProjetoListCreateView,
    ProjetoResumoView,
    ProjetoTarefasView,
    TarefaDetailView,
    TarefaListView,
    TarefaMoverView,
)

app_name = "projetos"

urlpatterns = [
    # ── Projetos ──────────────────────────────────────────────
    path("", ProjetoListCreateView.as_view(), name="projeto-list-create"),
    path("resumo/", ProjetoResumoView.as_view(), name="projeto-resumo"),
    path("<uuid:pk>/", ProjetoDetailView.as_view(), name="projeto-detail"),
    path("<uuid:pk>/kanban/", ProjetoKanbanView.as_view(), name="projeto-kanban"),
    path("<uuid:pk>/tarefas/", ProjetoTarefasView.as_view(), name="projeto-tarefas"),
    # ── Tarefas ───────────────────────────────────────────────
    path("tarefas/", TarefaListView.as_view(), name="tarefa-list"),
    path("tarefas/<uuid:pk>/", TarefaDetailView.as_view(), name="tarefa-detail"),
    path("tarefas/<uuid:pk>/mover/", TarefaMoverView.as_view(), name="tarefa-mover"),
    # ── Comentários ───────────────────────────────────────────
    path(
        "tarefas/<uuid:pk>/comentarios/",
        ComentarioListCreateView.as_view(),
        name="comentario-list-create",
    ),
    path(
        "tarefas/<uuid:pk>/comentarios/<uuid:cid>/",
        ComentarioDetailView.as_view(),
        name="comentario-detail",
    ),
    # ── Checklist ─────────────────────────────────────────────
    path(
        "tarefas/<uuid:pk>/checklist/",
        ChecklistCreateView.as_view(),
        name="checklist-create",
    ),
    path(
        "tarefas/<uuid:pk>/checklist/<uuid:item_id>/",
        ChecklistDetailView.as_view(),
        name="checklist-detail",
    ),
]
