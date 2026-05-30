from django.urls import path
from .views import BuscaGlobalView

urlpatterns = [
    path("", BuscaGlobalView.as_view(), name="busca-global"),
]
