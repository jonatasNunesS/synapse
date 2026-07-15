"""
Synapse — Caixinhas: URLs.
"""
from django.urls import path

from .views import (
    CaixinhaDepositarView,
    CaixinhaDetailView,
    CaixinhaListCreateView,
    CaixinhaMovimentosView,
    CaixinhaResumoView,
    CaixinhaRetirarView,
)

app_name = "caixinhas"

urlpatterns = [
    # Rotas especiais antes do {pk}
    path("", CaixinhaListCreateView.as_view(), name="caixinha-list-create"),
    path("resumo/", CaixinhaResumoView.as_view(), name="caixinha-resumo"),
    # Detalhe e operações
    path("<uuid:pk>/", CaixinhaDetailView.as_view(), name="caixinha-detail"),
    path("<uuid:pk>/depositar/", CaixinhaDepositarView.as_view(), name="caixinha-depositar"),
    path("<uuid:pk>/retirar/", CaixinhaRetirarView.as_view(), name="caixinha-retirar"),
    path("<uuid:pk>/movimentos/", CaixinhaMovimentosView.as_view(), name="caixinha-movimentos"),
]
