"""
Synapse — Módulo Financeiro: URLs
"""
from django.urls import path

from .views import (
    CategoriaDetailView,
    CategoriaListCreateView,
    DREView,
    FluxoCaixaView,
    LancamentoDetailView,
    LancamentoListCreateView,
    LancamentoPagarView,
    ResumoFinanceiroView,
    VencimentosView,
    CaixinhaListCreateView,
    CaixinhaDetailView,
    CaixinhaMovimentoView,
    InvestimentoListCreateView,
    InvestimentoDetailView,
)

app_name = "financeiro"

urlpatterns = [
    # ── Categorias ──────────────────────────────────────────
    path("categorias/", CategoriaListCreateView.as_view(), name="categoria-list"),
    path("categorias/<uuid:pk>/", CategoriaDetailView.as_view(), name="categoria-detail"),

    # ── Lançamentos ─────────────────────────────────────────
    path("lancamentos/", LancamentoListCreateView.as_view(), name="lancamento-list"),
    path("lancamentos/<uuid:pk>/", LancamentoDetailView.as_view(), name="lancamento-detail"),
    path("lancamentos/<uuid:pk>/pagar/", LancamentoPagarView.as_view(), name="lancamento-pagar"),

    # ── Relatórios ──────────────────────────────────────────
    path("resumo/", ResumoFinanceiroView.as_view(), name="resumo"),
    path("fluxo-caixa/", FluxoCaixaView.as_view(), name="fluxo-caixa"),
    path("dre/", DREView.as_view(), name="dre"),
    path("vencimentos/", VencimentosView.as_view(), name="vencimentos"),

    # ── Caixinhas ──────────────────────────────────────────
    path("caixinhas/", CaixinhaListCreateView.as_view(), name="caixinha-list"),
    path("caixinhas/<uuid:pk>/", CaixinhaDetailView.as_view(), name="caixinha-detail"),
    path("caixinhas/<uuid:pk>/movimentar/", CaixinhaMovimentoView.as_view(), name="caixinha-movimentar"),

    # ── Investimentos ───────────────────────────────────────
    path("investimentos/", InvestimentoListCreateView.as_view(), name="investimento-list"),
    path("investimentos/<uuid:pk>/", InvestimentoDetailView.as_view(), name="investimento-detail"),
]
