"""
Synapse — Painel Administrativo: URLs.
"""
from django.urls import path

from .views import (
    EmpresasListView,
    EmpresaDetailView,
    TrocarPlanoView,
    HistoricoPlanoView,
)

app_name = "painel_admin"

urlpatterns = [
    path("empresas/", EmpresasListView.as_view(), name="empresas"),
    path("empresas/<uuid:empresa_id>/", EmpresaDetailView.as_view(), name="empresa-detalhe"),
    path("empresas/<uuid:empresa_id>/trocar-plano/", TrocarPlanoView.as_view(), name="trocar-plano"),
    path("empresas/<uuid:empresa_id>/historico/", HistoricoPlanoView.as_view(), name="historico"),
]
