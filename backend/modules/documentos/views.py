"""
Synapse — M7: Views do módulo Documentos.
View → Service → Repository → Model (Clean Architecture).
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shared.pagination import StandardPagination
from .models import Documento, VersaoDocumento
from .repository import DocumentoRepository
from .serializers import (
    DocumentoListSerializer,
    DocumentoDetailSerializer,
    DocumentoCreateSerializer,
    DocumentoUpdateSerializer,
    NovaVersaoSerializer,
    VersaoDocumentoSerializer,
)
from .services import DocumentoService

logger = logging.getLogger("synapse")


def _success(data=None, message="", pagination=None, status_code=200):
    payload = {"success": True, "data": data or {}, "message": message}
    if pagination:
        payload["pagination"] = pagination
    return Response(payload, status=status_code)


def _error(code, message, details=None, status_code=400):
    return Response(
        {"success": False, "error": {"code": code, "message": message, "details": details or {}}},
        status=status_code,
    )


class DocumentoListCreateView(APIView):
    """GET /api/documentos/ | POST /api/documentos/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = str(request.user.empresa_id)
        filtros = {
            "tipo": request.query_params.get("tipo"),
            "status": request.query_params.get("status"),
            "busca": request.query_params.get("busca"),
            "tag": request.query_params.get("tag"),
        }
        qs = DocumentoRepository.listar(empresa_id, filtros)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DocumentoListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = DocumentoCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return _error("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        doc = DocumentoService.criar(
            str(request.user.empresa_id),
            str(request.user.id),
            serializer.validated_data,
        )
        return _success(
            DocumentoDetailSerializer(doc).data,
            "Documento criado com sucesso.",
            status_code=201,
        )


class DocumentoDetailView(APIView):
    """GET/PATCH/DELETE /api/documentos/{id}/"""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            doc = DocumentoRepository.obter(str(pk), str(request.user.empresa_id))
            return _success(DocumentoDetailSerializer(doc).data)
        except Documento.DoesNotExist:
            return _error("NOT_FOUND", "Documento não encontrado.", status_code=404)

    def patch(self, request, pk):
        try:
            DocumentoRepository.obter(str(pk), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return _error("NOT_FOUND", "Documento não encontrado.", status_code=404)

        serializer = DocumentoUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return _error("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        doc = DocumentoService.atualizar(
            str(pk), str(request.user.empresa_id), serializer.validated_data
        )
        return _success(DocumentoDetailSerializer(doc).data, "Documento atualizado.")

    def delete(self, request, pk):
        deleted = DocumentoService.deletar(str(pk), str(request.user.empresa_id))
        if not deleted:
            return _error("NOT_FOUND", "Documento não encontrado.", status_code=404)
        return _success(message="Documento excluído.")


class VersaoListCreateView(APIView):
    """GET/POST /api/documentos/{id}/versoes/"""

    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        try:
            DocumentoRepository.obter(str(doc_id), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return _error("NOT_FOUND", "Documento não encontrado.", status_code=404)

        versoes = DocumentoRepository.listar_versoes(str(doc_id), str(request.user.empresa_id))
        serializer = VersaoDocumentoSerializer(versoes, many=True)
        return _success(serializer.data)

    def post(self, request, doc_id):
        try:
            DocumentoRepository.obter(str(doc_id), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return _error("NOT_FOUND", "Documento não encontrado.", status_code=404)

        serializer = NovaVersaoSerializer(data=request.data)
        if not serializer.is_valid():
            return _error("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        versao = DocumentoService.criar_versao(
            str(doc_id),
            str(request.user.empresa_id),
            str(request.user.id),
            serializer.validated_data,
        )
        return _success(
            VersaoDocumentoSerializer(versao).data,
            f"Versão {versao.numero_versao} criada.",
            status_code=201,
        )
