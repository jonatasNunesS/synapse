"""
Synapse — M7: URLs do módulo Notificações.
"""
from django.urls import path
from .views import (
    NotificacaoListView,
    NotificacaoNaoLidasView,
    NotificacaoContagemView,
    NotificacaoMarcarLidaView,
    NotificacaoMarcarTodasLidasView,
    NotificacaoDeleteView,
)

urlpatterns = [
    path("", NotificacaoListView.as_view(), name="notificacoes-list"),
    path("nao-lidas/", NotificacaoNaoLidasView.as_view(), name="notificacoes-nao-lidas"),
    path("contagem/", NotificacaoContagemView.as_view(), name="notificacoes-contagem"),
    path("marcar-todas-lidas/", NotificacaoMarcarTodasLidasView.as_view(), name="notificacoes-marcar-todas"),
    path("<uuid:pk>/marcar-lida/", NotificacaoMarcarLidaView.as_view(), name="notificacoes-marcar-lida"),
    path("<uuid:pk>/", NotificacaoDeleteView.as_view(), name="notificacoes-delete"),
]
