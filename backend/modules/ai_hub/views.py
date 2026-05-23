"""
Synapse - AI Hub Views
Endpoints:
  POST /api/ai/gerar/          → Solicitar geração (retorna TaskIA)
  GET  /api/ai/status/{id}/    → Polling de status da TaskIA
  GET  /api/ai/historico/      → Listar conteúdos gerados
  POST /api/ai/favoritar/{id}/ → Toggle favorito
  GET  /api/ai/uso/            → Uso mensal e limite do plano
  GET  /api/ai/insight/        → Último insight semanal
"""
import logging

from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from shared.responses import success_response, error_response
from shared.pagination import StandardPagination

from .serializers import (
    ConteudoGeradoSerializer,
    TaskIASerializer,
    SolicitacaoConteudoSerializer,
    UsoIASerializer,
)
from .services import AIHubService, AILimitExceededError

logger = logging.getLogger("synapse")


class GerarConteudoView(APIView):
    """POST /api/ai/gerar/ — Solicita geração assíncrona de conteúdo."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SolicitacaoConteudoSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Dados inválidos.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        empresa_id = request.user.empresa_id
        usuario_id = request.user.id
        tipo = serializer.validated_data["tipo"]
        parametros = serializer.validated_data["parametros"]

        try:
            task_ia = AIHubService.solicitar_geracao(
                empresa_id=empresa_id,
                usuario_id=usuario_id,
                tipo=tipo,
                parametros=parametros,
            )
        except AILimitExceededError as e:
            return error_response(
                code=e.code,
                message=e.message,
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except Exception as e:
            logger.error(f"AI Hub: erro ao solicitar geração — {e}", exc_info=True)
            return error_response(
                code="AI_ERROR",
                message="Erro ao iniciar geração.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return success_response(
            data=TaskIASerializer(task_ia).data,
            message="Geração iniciada. Faça polling em /api/ai/status/{id}/",
            status_code=status.HTTP_202_ACCEPTED,
        )


class StatusTaskView(APIView):
    """GET /api/ai/status/{task_id}/ — Polling de status da TaskIA."""
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        empresa_id = request.user.empresa_id
        try:
            task_ia = AIHubService.obter_status_task(empresa_id, task_id)
        except Exception as e:
            return error_response(
                code="NOT_FOUND",
                message=str(e),
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=TaskIASerializer(task_ia).data)


class HistoricoConteudosView(APIView):
    """GET /api/ai/historico/ — Lista conteúdos gerados com paginação."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.user.empresa_id
        tipo = request.query_params.get("tipo")
        favorito_param = request.query_params.get("favorito")
        favorito = None
        if favorito_param is not None:
            favorito = favorito_param.lower() in ("true", "1")

        qs = AIHubService.listar_conteudos(empresa_id, tipo=tipo, favorito=favorito)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ConteudoGeradoSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class FavoritarConteudoView(APIView):
    """POST /api/ai/favoritar/{conteudo_id}/ — Toggle favorito."""
    permission_classes = [IsAuthenticated]

    def post(self, request, conteudo_id):
        empresa_id = request.user.empresa_id
        try:
            conteudo = AIHubService.toggle_favorito(empresa_id, conteudo_id)
        except Exception as e:
            return error_response(
                code="NOT_FOUND",
                message=str(e),
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(
            data=ConteudoGeradoSerializer(conteudo).data,
            message="Favorito atualizado.",
        )


class UsoIAView(APIView):
    """GET /api/ai/uso/ — Uso mensal e limite do plano."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.user.empresa_id
        uso = AIHubService.obter_uso(empresa_id)
        serializer = UsoIASerializer(uso)
        return success_response(data=serializer.data)


class InsightSemanalView(APIView):
    """GET /api/ai/insight/ — Último insight semanal gerado."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        empresa_id = request.user.empresa_id
        insight = AIHubService.obter_insight_semanal(empresa_id)
        if not insight:
            return success_response(
                data=None,
                message="Nenhum insight disponível ainda. O insight semanal é gerado automaticamente toda semana.",
            )
        return success_response(data=ConteudoGeradoSerializer(insight).data)
