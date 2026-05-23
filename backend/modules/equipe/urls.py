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

urlpatterns = [
    path("membros/", MembroListCreateView.as_view(), name="equipe-membros-list"),
    path("membros/<uuid:pk>/", MembroDetailView.as_view(), name="equipe-membros-detail"),
    path("convidar/", ConvidarMembroView.as_view(), name="equipe-convidar"),
    path("resumo/", ResumoEquipeView.as_view(), name="equipe-resumo"),
    path("membros/<uuid:membro_id>/metas/", MetaListCreateView.as_view(), name="equipe-metas-list"),
    path("membros/<uuid:membro_id>/metas/<uuid:meta_id>/", MetaDetailView.as_view(), name="equipe-metas-detail"),
]
