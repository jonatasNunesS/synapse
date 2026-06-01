from django.urls import path
from .views import MensagemListCreateView, MensagemDetailView, MensagemDispararView

app_name = "mensagens"

urlpatterns = [
    path("", MensagemListCreateView.as_view(), name="mensagem-list"),
    path("<uuid:pk>/", MensagemDetailView.as_view(), name="mensagem-detail"),
    path("<uuid:pk>/disparar/", MensagemDispararView.as_view(), name="mensagem-disparar"),
]
