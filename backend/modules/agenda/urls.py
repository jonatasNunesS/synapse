"""
Synapse — Módulo Agenda: URLs
"""
from django.urls import path

from .views import (
    CategoriaEventoDetailView,
    CategoriaEventoListCreateView,
    EventoDetailView,
    EventoListCreateView,
)

app_name = "agenda"

urlpatterns = [
    # Categorias antes do detalhe do evento: são rotas irmãs sob /agenda/, e
    # deixar as mais específicas no topo é o que evita surpresa se algum dia
    # o `<uuid:pk>` virar um conversor mais solto.
    path(
        "categorias/",
        CategoriaEventoListCreateView.as_view(),
        name="categoria-evento-list",
    ),
    path(
        "categorias/<uuid:pk>/",
        CategoriaEventoDetailView.as_view(),
        name="categoria-evento-detail",
    ),
    path("", EventoListCreateView.as_view(), name="evento-list"),
    path("<uuid:pk>/", EventoDetailView.as_view(), name="evento-detail"),
]
