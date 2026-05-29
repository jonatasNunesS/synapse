"""
Synapse — M7: Views do módulo Documentos.
View → Service → Repository → Model (Clean Architecture).
"""
import logging
import os
from django.http import FileResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from shared.pagination import StandardPagination
from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsEmpresaMember
from shared.responses import success_response, error_response, no_content_response
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


class DocumentoListCreateView(APIView):
    """GET /api/documentos/ | POST /api/documentos/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

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
            return error_response("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        doc = DocumentoService.criar(
            str(request.user.empresa_id),
            str(request.user.id),
            serializer.validated_data,
        )
        return success_response(
            DocumentoDetailSerializer(doc).data,
            "Documento criado com sucesso.",
            status_code=201,
        )


class DocumentoDetailView(APIView):
    """GET/PATCH/DELETE /api/documentos/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        try:
            doc = DocumentoRepository.obter(str(pk), str(request.user.empresa_id))
            return success_response(DocumentoDetailSerializer(doc).data)
        except Documento.DoesNotExist:
            return error_response("NOT_FOUND", "Documento não encontrado.", status_code=404)

    def patch(self, request, pk):
        try:
            doc = DocumentoRepository.obter(str(pk), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return error_response("NOT_FOUND", "Documento não encontrado.", status_code=404)

        # ALTO-6: passar instância ao serializer para atualização parcial correta
        serializer = DocumentoUpdateSerializer(instance=doc, data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        doc = DocumentoService.atualizar(
            str(pk), str(request.user.empresa_id), serializer.validated_data
        )
        return success_response(DocumentoDetailSerializer(doc).data, "Documento atualizado.")

    def delete(self, request, pk):
        deleted = DocumentoService.deletar(str(pk), str(request.user.empresa_id))
        if not deleted:
            return error_response("NOT_FOUND", "Documento não encontrado.", status_code=404)
        return no_content_response()


class VersaoListCreateView(APIView):
    """GET/POST /api/documentos/{id}/versoes/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, doc_id):
        try:
            DocumentoRepository.obter(str(doc_id), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return error_response("NOT_FOUND", "Documento não encontrado.", status_code=404)

        versoes = DocumentoRepository.listar_versoes(str(doc_id), str(request.user.empresa_id))
        serializer = VersaoDocumentoSerializer(versoes, many=True)
        return success_response(serializer.data)

    def post(self, request, doc_id):
        try:
            DocumentoRepository.obter(str(doc_id), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return error_response("NOT_FOUND", "Documento não encontrado.", status_code=404)

        serializer = NovaVersaoSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response("VALIDATION_ERROR", "Dados inválidos.", serializer.errors, 400)

        versao = DocumentoService.criar_versao(
            str(doc_id),
            str(request.user.empresa_id),
            str(request.user.id),
            serializer.validated_data,
        )
        return success_response(
            VersaoDocumentoSerializer(versao).data,
            f"Versão {versao.numero_versao} criada.",
            status_code=201,
        )


class DocumentoDownloadView(APIView):
    """
    GET /api/documentos/{id}/download/
    Serve o arquivo do documento de forma autenticada e com isolamento
    multi-tenant. Em produção, o Django não serve /media/ diretamente
    (DEBUG=False), por isso esta view usa FileResponse para streaming
    seguro do arquivo sem expor URLs públicas.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        try:
            doc = DocumentoRepository.obter(str(pk), str(request.user.empresa_id))
        except Documento.DoesNotExist:
            return error_response("NOT_FOUND", "Documento não encontrado.", status_code=404)

        if not doc.arquivo:
            return error_response(
                "NO_FILE",
                "Este documento não possui arquivo anexado.",
                status_code=404,
            )

        # Abre o arquivo via storage backend (local ou S3 em prod)
        try:
            arquivo = doc.arquivo.open("rb")
        except (FileNotFoundError, OSError):
            return error_response(
                "FILE_NOT_FOUND",
                "Arquivo não encontrado no servidor.",
                status_code=404,
            )

        # Determina o nome de download a partir do path original
        filename = os.path.basename(doc.arquivo.name)
        response = FileResponse(
            arquivo,
            as_attachment=True,
            filename=filename,
        )
        return response
