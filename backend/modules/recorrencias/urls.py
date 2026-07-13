"""
Synapse — Recorrências: URLs.
"""
from django.urls import path

from .views import (
    RecorrenciaListCreateView,
    RecorrenciaDetailView,
    RecorrenciaPausarView,
    OcorrenciasPendentesView,
    OcorrenciaDetailView,
    OcorrenciaConfirmarView,
    OcorrenciaAdiarView,
    OcorrenciaCancelarView,
    AvisoVistoView,
)

app_name = "recorrencias"

urlpatterns = [
    # Ocorrências (rotas específicas ANTES das <uuid:pk> de recorrência)
    path("ocorrencias/pendentes/", OcorrenciasPendentesView.as_view(), name="ocorrencias-pendentes"),
    path("ocorrencias/<uuid:pk>/", OcorrenciaDetailView.as_view(), name="ocorrencia-detail"),
    path("ocorrencias/<uuid:pk>/confirmar/", OcorrenciaConfirmarView.as_view(), name="ocorrencia-confirmar"),
    path("ocorrencias/<uuid:pk>/adiar/", OcorrenciaAdiarView.as_view(), name="ocorrencia-adiar"),
    path("ocorrencias/<uuid:pk>/cancelar/", OcorrenciaCancelarView.as_view(), name="ocorrencia-cancelar"),

    # Aviso de migração
    path("aviso-visto/", AvisoVistoView.as_view(), name="aviso-visto"),

    # Recorrências
    path("", RecorrenciaListCreateView.as_view(), name="list"),
    path("<uuid:pk>/", RecorrenciaDetailView.as_view(), name="detail"),
    path("<uuid:pk>/pausar/", RecorrenciaPausarView.as_view(), name="pausar"),
    path("<uuid:pk>/reativar/", RecorrenciaPausarView.as_view(), name="reativar"),
]
