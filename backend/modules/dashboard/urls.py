"""
Synapse — M8 Dashboard: URLs
Prefixo: /api/dashboard/
"""
from django.urls import path

from .views import (
    DashboardAtividadeView,
    DashboardAlertasEstoqueView,
    DashboardFluxoCaixaView,
    DashboardFollowUpsView,
    DashboardFunilVendasView,
    DashboardMinhasTarefasView,
    DashboardProjetosView,
    DashboardResumoView,
    DashboardVencimentosView,
)

urlpatterns = [
    path("resumo/", DashboardResumoView.as_view(), name="dashboard-resumo"),
    path("fluxo-caixa/", DashboardFluxoCaixaView.as_view(), name="dashboard-fluxo-caixa"),
    path("funil-vendas/", DashboardFunilVendasView.as_view(), name="dashboard-funil-vendas"),
    path("vencimentos/", DashboardVencimentosView.as_view(), name="dashboard-vencimentos"),
    path("followups/", DashboardFollowUpsView.as_view(), name="dashboard-followups"),
    path("minhas-tarefas/", DashboardMinhasTarefasView.as_view(), name="dashboard-minhas-tarefas"),
    path("alertas-estoque/", DashboardAlertasEstoqueView.as_view(), name="dashboard-alertas-estoque"),
    path("projetos/", DashboardProjetosView.as_view(), name="dashboard-projetos"),
    path("atividade/", DashboardAtividadeView.as_view(), name="dashboard-atividade"),
]
