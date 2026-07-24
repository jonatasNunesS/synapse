from django.urls import path
from .views import (
    ClienteListCreateView,
    ClienteDetailView,
    ClienteMoverFunilView,
    ClienteFunilView,
    ClienteResumoView,
    ClienteFollowupsView,
    InteracaoListCreateView,
    InteracaoDetailView,
    InteracaoBaixarEstoqueView,
    InteracaoConfirmarPagamentoView,
    InteracaoAdiarPagamentoView,
    InteracaoCancelarPagamentoView,
    InteracaoRegistrarFinanceiroView,
)

app_name = "clientes"

urlpatterns = [
    # Rotas de listagem/criação e especiais (antes do {pk})
    path("", ClienteListCreateView.as_view(), name="cliente-list-create"),
    path("funil/", ClienteFunilView.as_view(), name="cliente-funil"),
    path("resumo/", ClienteResumoView.as_view(), name="cliente-resumo"),
    path("followups/", ClienteFollowupsView.as_view(), name="cliente-followups"),

    # Venda (interação) → baixa de estoque (rota flat)
    path(
        "interacoes/<uuid:interacao_id>/baixar-estoque/",
        InteracaoBaixarEstoqueView.as_view(),
        name="interacao-baixar-estoque",
    ),

    # Fiado: cobrança no vencimento (confirmar / adiar / cancelar)
    path(
        "interacoes/<uuid:interacao_id>/confirmar-pagamento/",
        InteracaoConfirmarPagamentoView.as_view(),
        name="interacao-confirmar-pagamento",
    ),
    path(
        "interacoes/<uuid:interacao_id>/adiar-pagamento/",
        InteracaoAdiarPagamentoView.as_view(),
        name="interacao-adiar-pagamento",
    ),
    path(
        "interacoes/<uuid:interacao_id>/cancelar-pagamento/",
        InteracaoCancelarPagamentoView.as_view(),
        name="interacao-cancelar-pagamento",
    ),
    path(
        "interacoes/<uuid:interacao_id>/registrar-financeiro/",
        InteracaoRegistrarFinanceiroView.as_view(),
        name="interacao-registrar-financeiro",
    ),

    # Rotas de detalhe por {pk}
    path("<uuid:pk>/", ClienteDetailView.as_view(), name="cliente-detail"),
    path("<uuid:pk>/mover-funil/", ClienteMoverFunilView.as_view(), name="cliente-mover-funil"),
    path("<uuid:pk>/interacoes/", InteracaoListCreateView.as_view(), name="cliente-interacoes"),
    path(
        "<uuid:pk>/interacoes/<uuid:interacao_id>/",
        InteracaoDetailView.as_view(),
        name="cliente-interacao-detail",
    ),
]
