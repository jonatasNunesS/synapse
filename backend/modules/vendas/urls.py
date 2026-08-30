"""
Synapse — Vendas: URLs.
"""
from django.urls import path

from .views import (
    VendaDetailView,
    VendaEstoqueView,
    VendaFinanceiroView,
    VendaListCreateView,
)

app_name = "vendas"

urlpatterns = [
    path("", VendaListCreateView.as_view(), name="venda-list-create"),
    path("<uuid:pk>/", VendaDetailView.as_view(), name="venda-detail"),
    path("<uuid:pk>/estoque/", VendaEstoqueView.as_view(), name="venda-estoque"),
    path(
        "<uuid:pk>/financeiro/",
        VendaFinanceiroView.as_view(),
        name="venda-financeiro",
    ),
]
