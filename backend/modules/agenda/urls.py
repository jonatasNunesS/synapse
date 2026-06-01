from django.urls import path
from .views import EventoListCreateView, EventoDetailView

app_name = "agenda"

urlpatterns = [
    path("eventos/", EventoListCreateView.as_view(), name="evento-list"),
    path("eventos/<uuid:pk>/", EventoDetailView.as_view(), name="evento-detail"),
]
