"""
Synapse - AI Hub URLs
"""
from django.urls import path
from .views import (
    GerarConteudoView,
    StatusTaskView,
    HistoricoConteudosView,
    FavoritarConteudoView,
    CreditosView,
    InsightSemanalView,
    AnaliseFinanceiraView,
    ChatFinanceiroPerguntaView,
)

app_name = "ai_hub"

urlpatterns = [
    path("gerar/", GerarConteudoView.as_view(), name="gerar"),
    path("analise-financeira/", AnaliseFinanceiraView.as_view(), name="analise-financeira"),
    path("chat-financeiro/pergunta/", ChatFinanceiroPerguntaView.as_view(), name="chat-financeiro-pergunta"),
    path("status/<uuid:task_id>/", StatusTaskView.as_view(), name="status"),
    path("historico/", HistoricoConteudosView.as_view(), name="historico"),
    path("favoritar/<uuid:conteudo_id>/", FavoritarConteudoView.as_view(), name="favoritar"),
    path("creditos/", CreditosView.as_view(), name="creditos"),
    path("uso/", CreditosView.as_view(), name="uso"),  # alias legado
    path("insight/", InsightSemanalView.as_view(), name="insight"),
]
