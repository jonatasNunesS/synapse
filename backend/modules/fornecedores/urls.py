"""
M5 — Fornecedores: URLs
"""
from django.urls import path

from .views import (
    FornecedorResumoView,
    FornecedorRankingView,
    CategoriaFornecedorListCreateView,
    CategoriaFornecedorDetailView,
    FornecedorListCreateView,
    FornecedorDetailView,
    FornecedorAvaliacaoView,
    CompraFornecedorListCreateView,
    CompraAdicionarAoEstoqueView,
)

app_name = "fornecedores"

urlpatterns = [
    # Resumo e Ranking
    path("resumo/", FornecedorResumoView.as_view(), name="resumo"),
    path("ranking/", FornecedorRankingView.as_view(), name="ranking"),

    # Categorias
    path("categorias/", CategoriaFornecedorListCreateView.as_view(), name="categorias-list"),
    path("categorias/<uuid:pk>/", CategoriaFornecedorDetailView.as_view(), name="categorias-detail"),

    # Fornecedores
    path("", FornecedorListCreateView.as_view(), name="fornecedores-list"),
    path("<uuid:pk>/", FornecedorDetailView.as_view(), name="fornecedores-detail"),
    path("<uuid:pk>/avaliar/", FornecedorAvaliacaoView.as_view(), name="fornecedores-avaliar"),

    # Compras (nested)
    path(
        "<uuid:fornecedor_pk>/compras/",
        CompraFornecedorListCreateView.as_view(),
        name="compras-list",
    ),
    path(
        "<uuid:fornecedor_pk>/compras/<uuid:compra_pk>/adicionar-ao-estoque/",
        CompraAdicionarAoEstoqueView.as_view(),
        name="compras-adicionar-estoque",
    ),
]
