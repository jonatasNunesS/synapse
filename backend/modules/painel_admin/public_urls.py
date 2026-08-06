"""
Synapse — Planos: rota PÚBLICA (sem autenticação).

Separada de `urls.py` porque tudo lá é restrito ao staff. Aqui mora só o que
a landing pública consome: GET /api/planos/.
"""
from django.urls import path

from .views import PlanosPublicosView

app_name = "planos_publicos"

urlpatterns = [
    path("", PlanosPublicosView.as_view(), name="planos"),
]
