"""
Synapse — Recorrências: Views. Multi-tenant (empresa via request.user).
"""
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import IsEmpresaMember
from shared.pagination import StandardPagination
from shared.responses import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)
from shared.exceptions import ResourceNotFound, BusinessRuleViolation

from .services import RecorrenciaService
from .serializers import (
    RecorrenciaSerializer,
    RecorrenciaCreateSerializer,
    OcorrenciaDetailSerializer,
    OcorrenciaResumoSerializer,
    ConfirmarSerializer,
    AdiarSerializer,
)

logger = logging.getLogger("synapse")


class RecorrenciaListCreateView(APIView):
    """GET /api/recorrencias/ — lista | POST — cria."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        from .repository import RecorrenciaRepository
        qs = RecorrenciaRepository.listar(request.user.empresa_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(RecorrenciaSerializer(page, many=True).data)

    def post(self, request):
        serializer = RecorrenciaCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        rec = RecorrenciaService.criar(
            request.user.empresa_id, request.user.id, serializer.validated_data
        )
        return created_response(
            data=RecorrenciaSerializer(rec).data, message="Recorrência criada."
        )


class RecorrenciaDetailView(APIView):
    """GET/PATCH/DELETE /api/recorrencias/{id}/"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        try:
            rec = RecorrenciaService.obter(request.user.empresa_id, pk)
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Recorrência não encontrada.", status_code=404)
        return success_response(data=RecorrenciaSerializer(rec).data)

    def patch(self, request, pk):
        serializer = RecorrenciaCreateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            rec = RecorrenciaService.atualizar(
                request.user.empresa_id, pk, serializer.validated_data
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Recorrência não encontrada.", status_code=404)
        return success_response(data=RecorrenciaSerializer(rec).data, message="Recorrência atualizada.")

    def delete(self, request, pk):
        """Encerra a recorrência (pausa definitiva + fecha ocorrências vivas)."""
        try:
            RecorrenciaService.encerrar(request.user.empresa_id, pk)
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Recorrência não encontrada.", status_code=404)
        return no_content_response()


class RecorrenciaPausarView(APIView):
    """POST /api/recorrencias/{id}/pausar/  e  /reativar/"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        ativa = request.path.rstrip("/").endswith("reativar")
        try:
            rec = RecorrenciaService.definir_ativa(request.user.empresa_id, pk, ativa)
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Recorrência não encontrada.", status_code=404)
        return success_response(
            data=RecorrenciaSerializer(rec).data,
            message="Recorrência reativada." if ativa else "Recorrência pausada.",
        )


class OcorrenciasPendentesView(APIView):
    """GET /api/recorrencias/ocorrencias/pendentes/ — perguntas vivas do sino."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        qs = RecorrenciaService.listar_pendentes(request.user.empresa_id)
        return success_response(data=OcorrenciaDetailSerializer(qs, many=True).data)


class OcorrenciaDetailView(APIView):
    """GET /api/recorrencias/ocorrencias/{id}/"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        try:
            oc = RecorrenciaService.obter_ocorrencia(request.user.empresa_id, pk)
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Ocorrência não encontrada.", status_code=404)
        return success_response(data=OcorrenciaDetailSerializer(oc).data)


class OcorrenciaConfirmarView(APIView):
    """POST /api/recorrencias/ocorrencias/{id}/confirmar/"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        serializer = ConfirmarSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Dados inválidos.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            oc, lancamento = RecorrenciaService.confirmar(
                request.user.empresa_id, pk,
                valor=serializer.validated_data.get("valor"),
                atualizar_recorrencia=serializer.validated_data.get("atualizar_recorrencia", False),
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Ocorrência não encontrada.", status_code=404)
        except BusinessRuleViolation as e:
            return error_response(e.code, e.message, status_code=status.HTTP_409_CONFLICT)
        return success_response(
            data=OcorrenciaResumoSerializer(oc).data,
            message="Confirmado! Lançamento criado.",
        )


class OcorrenciaAdiarView(APIView):
    """POST /api/recorrencias/ocorrencias/{id}/adiar/"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        serializer = AdiarSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR", message="Informe quantos dias adiar.",
                details=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            oc = RecorrenciaService.adiar(
                request.user.empresa_id, pk, serializer.validated_data["dias"]
            )
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Ocorrência não encontrada.", status_code=404)
        return success_response(
            data=OcorrenciaResumoSerializer(oc).data, message="Ocorrência adiada."
        )


class AvisoVistoView(APIView):
    """POST /api/recorrencias/aviso-visto/ — marca o aviso da migração como visto."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request):
        user = request.user
        if not user.viu_aviso_recorrencias:
            user.viu_aviso_recorrencias = True
            user.save(update_fields=["viu_aviso_recorrencias", "atualizado_em"])
        return success_response(message="Aviso marcado como visto.")


class OcorrenciaCancelarView(APIView):
    """POST /api/recorrencias/ocorrencias/{id}/cancelar/ — só este mês."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        try:
            oc = RecorrenciaService.cancelar(request.user.empresa_id, pk)
        except ResourceNotFound:
            return error_response("NOT_FOUND", "Ocorrência não encontrada.", status_code=404)
        return success_response(
            data=OcorrenciaResumoSerializer(oc).data,
            message="Ocorrência cancelada. A recorrência continua ativa.",
        )
