"""
Synapse — Módulo Agenda: URLs
"""
from django.urls import path

from .views import EventoDetailView, EventoListCreateView

app_name = "agenda"

urlpatterns = [
    path("", EventoListCreateView.as_view(), name="evento-list"),
    path("<uuid:pk>/", EventoDetailView.as_view(), name="evento-detail"),
]
