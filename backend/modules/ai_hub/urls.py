"""
Synapse - AI Hub URLs
"""
from django.urls import path
from .views import (
    GerarConteudoView,
    StatusTaskView,
    HistoricoConteudosView,
    FavoritarConteudoView,
    UsoIAView,
    InsightSemanalView,
)

app_name = "ai_hub"

urlpatterns = [
    path("gerar/", GerarConteudoView.as_view(), name="gerar"),
    path("status/<uuid:task_id>/", StatusTaskView.as_view(), name="status"),
    path("historico/", HistoricoConteudosView.as_view(), name="historico"),
    path("favoritar/<uuid:conteudo_id>/", FavoritarConteudoView.as_view(), name="favoritar"),
    path("uso/", UsoIAView.as_view(), name="uso"),
    path("insight/", InsightSemanalView.as_view(), name="insight"),
]
