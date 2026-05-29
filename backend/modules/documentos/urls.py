"""
Synapse — M7: URLs do módulo Documentos.
"""
from django.urls import path
from .views import (
    DocumentoListCreateView,
    DocumentoDetailView,
    DocumentoDownloadView,
    VersaoListCreateView,
)

urlpatterns = [
    path("", DocumentoListCreateView.as_view(), name="documentos-list"),
    path("<uuid:pk>/", DocumentoDetailView.as_view(), name="documentos-detail"),
    path("<uuid:pk>/download/", DocumentoDownloadView.as_view(), name="documentos-download"),
    path("<uuid:doc_id>/versoes/", VersaoListCreateView.as_view(), name="documentos-versoes"),
]
