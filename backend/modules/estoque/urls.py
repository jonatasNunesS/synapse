from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoriaEstoqueViewSet,
    ProdutoViewSet,
    MovimentacaoViewSet,
    EstoqueResumoView,
)

router = DefaultRouter()
router.register(r"categorias", CategoriaEstoqueViewSet, basename="estoque-categorias")
router.register(r"produtos", ProdutoViewSet, basename="estoque-produtos")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="estoque-movimentacoes")

# Rotas de resumo/alertas/relatório
resumo_list = EstoqueResumoView.as_view({"get": "resumo"})
alertas_list = EstoqueResumoView.as_view({"get": "alertas"})
relatorio_list = EstoqueResumoView.as_view({"get": "relatorio"})

urlpatterns = [
    path("", include(router.urls)),
    path("resumo/", resumo_list, name="estoque-resumo"),
    path("alertas/", alertas_list, name="estoque-alertas"),
    path("relatorio/", relatorio_list, name="estoque-relatorio"),
]
