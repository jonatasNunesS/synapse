"""
Synapse — Módulo Financeiro: URLs
"""
from django.urls import path

from .views import (
    AdiarEmprestimoView,
    CategoriaDetailView,
    CategoriaListCreateView,
    DREView,
    EmprestimosListView,
    EmprestimosResumoView,
    FluxoCaixaView,
    LancamentoDetailView,
    LancamentoExcluirView,
    LancamentoHistoricoView,
    LancamentoListCreateView,
    LancamentoPagarView,
    QuitarEmprestimoView,
    ResumoFinanceiroView,
    SaldoFinanceiroView,
    VencimentosView,
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
    path("lancamentos/<uuid:pk>/excluir/", LancamentoExcluirView.as_view(), name="lancamento-excluir"),
    path("lancamentos/<uuid:pk>/historico/", LancamentoHistoricoView.as_view(), name="lancamento-historico"),
    path("lancamentos/<uuid:pk>/quitar-emprestimo/", QuitarEmprestimoView.as_view(), name="lancamento-quitar-emprestimo"),
    path("lancamentos/<uuid:pk>/adiar-emprestimo/", AdiarEmprestimoView.as_view(), name="lancamento-adiar-emprestimo"),

    # ── Empréstimos ─────────────────────────────────────────
    path("emprestimos/", EmprestimosListView.as_view(), name="emprestimos-list"),
    path("emprestimos/resumo/", EmprestimosResumoView.as_view(), name="emprestimos-resumo"),

    # ── Relatórios ──────────────────────────────────────────
    path("resumo/", ResumoFinanceiroView.as_view(), name="resumo"),
    path("saldo/", SaldoFinanceiroView.as_view(), name="saldo"),
    path("fluxo-caixa/", FluxoCaixaView.as_view(), name="fluxo-caixa"),
    path("dre/", DREView.as_view(), name="dre"),
    path("vencimentos/", VencimentosView.as_view(), name="vencimentos"),
]
