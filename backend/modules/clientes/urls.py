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
)

app_name = "clientes"

urlpatterns = [
    # Rotas de listagem/criação e especiais (antes do {pk})
    path("", ClienteListCreateView.as_view(), name="cliente-list-create"),
    path("funil/", ClienteFunilView.as_view(), name="cliente-funil"),
    path("resumo/", ClienteResumoView.as_view(), name="cliente-resumo"),
    path("followups/", ClienteFollowupsView.as_view(), name="cliente-followups"),

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
