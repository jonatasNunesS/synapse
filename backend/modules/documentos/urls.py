"""
Synapse — M7: URLs do módulo Documentos.
"""
from django.urls import path
from .views import (
    DocumentoListCreateView,
    DocumentoDetailView,
    VersaoListCreateView,
)

urlpatterns = [
    path("", DocumentoListCreateView.as_view(), name="documentos-list"),
    path("<uuid:pk>/", DocumentoDetailView.as_view(), name="documentos-detail"),
    path("<uuid:doc_id>/versoes/", VersaoListCreateView.as_view(), name="documentos-versoes"),
]
