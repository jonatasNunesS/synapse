"""
Synapse — Vendas: URLs.
"""
from django.urls import path

from .views import (
    VendaAdiarPagamentoView,
    VendaCancelarPagamentoView,
    VendaConfirmarPagamentoView,
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
    # ── Fiado: as três respostas à cobrança do dia ──
    path(
        "<uuid:pk>/confirmar-pagamento/",
        VendaConfirmarPagamentoView.as_view(),
        name="venda-confirmar-pagamento",
    ),
    path(
        "<uuid:pk>/adiar-pagamento/",
        VendaAdiarPagamentoView.as_view(),
        name="venda-adiar-pagamento",
    ),
    path(
        "<uuid:pk>/cancelar-pagamento/",
        VendaCancelarPagamentoView.as_view(),
        name="venda-cancelar-pagamento",
    ),
]
