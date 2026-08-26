"""
Synapse — Vendas: URLs.
"""
from django.urls import path

from .views import VendaDetailView, VendaListCreateView

app_name = "vendas"

urlpatterns = [
    path("", VendaListCreateView.as_view(), name="venda-list-create"),
    path("<uuid:pk>/", VendaDetailView.as_view(), name="venda-detail"),
]
