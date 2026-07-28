"""
Synapse — Painel Administrativo: URLs.
"""
from django.urls import path

from .views import (
    EmpresasListView,
    EmpresaDetailView,
    SuspenderEmpresaView,
    ReativarEmpresaView,
    UsuariosEmpresaView,
    UsuarioEmpresaDetailView,
    RedefinirSenhaUsuarioView,
    TrocarPlanoView,
    HistoricoPlanoView,
)

app_name = "painel_admin"

urlpatterns = [
    path("empresas/", EmpresasListView.as_view(), name="empresas"),
    path("empresas/<uuid:empresa_id>/", EmpresaDetailView.as_view(), name="empresa-detalhe"),
    path(
        "empresas/<uuid:empresa_id>/suspender/",
        SuspenderEmpresaView.as_view(),
        name="suspender",
    ),
    path(
        "empresas/<uuid:empresa_id>/reativar/",
        ReativarEmpresaView.as_view(),
        name="reativar",
    ),
    path(
        "empresas/<uuid:empresa_id>/usuarios/",
        UsuariosEmpresaView.as_view(),
        name="usuarios",
    ),
    path(
        "empresas/<uuid:empresa_id>/usuarios/<uuid:usuario_id>/",
        UsuarioEmpresaDetailView.as_view(),
        name="usuario-detalhe",
    ),
    path(
        "empresas/<uuid:empresa_id>/usuarios/<uuid:usuario_id>/redefinir-senha/",
        RedefinirSenhaUsuarioView.as_view(),
        name="usuario-redefinir-senha",
    ),
    path(
        "empresas/<uuid:empresa_id>/trocar-plano/",
        TrocarPlanoView.as_view(),
        name="trocar-plano",
    ),
    path(
        "empresas/<uuid:empresa_id>/historico/",
        HistoricoPlanoView.as_view(),
        name="historico",
    ),
]
