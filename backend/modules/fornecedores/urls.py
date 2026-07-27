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
    CompraFornecedorDetailView,
    CompraAdicionarEstoqueView,
    CompraRegistrarFinanceiroView,
    CompraApagarComAjustesView,
)

app_name = "fornecedores"

urlpatterns = [
    # Compra → estoque (rota flat, antes dos <uuid:pk> de fornecedor)
    path(
        "compras/<uuid:pk>/adicionar-ao-estoque/",
        CompraAdicionarEstoqueView.as_view(),
        name="compras-adicionar-estoque",
    ),
    path(
        "compras/<uuid:pk>/registrar-financeiro/",
        CompraRegistrarFinanceiroView.as_view(),
        name="compras-registrar-financeiro",
    ),
    path(
        "compras/<uuid:pk>/apagar-com-ajustes/",
        CompraApagarComAjustesView.as_view(),
        name="compras-apagar-com-ajustes",
    ),

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
        "<uuid:fornecedor_pk>/compras/<uuid:pk>/",
        CompraFornecedorDetailView.as_view(),
        name="compras-detail",
    ),
]
