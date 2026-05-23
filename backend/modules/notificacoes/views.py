"""
Synapse — M7: Views do módulo Notificações.
View → Service → Repository → Model (Clean Architecture).
"""
import logging
from django.core.cache import cache
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from shared.pagination import StandardPagination
from .models import Notificacao
from .repository import NotificacaoRepository
from .serializers import NotificacaoSerializer, ContagemNotificacoesSerializer
from .services import NotificacaoService

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


class NotificacaoListView(APIView):
    """GET /api/notificacoes/ — Lista todas as notificações do usuário."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuario_id = str(request.user.id)
        cache_key = f"synapse:{usuario_id}:notificacoes:lista"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        filtros = {
            "tipo": request.query_params.get("tipo"),
            "lida": request.query_params.get("lida"),
            "prioridade": request.query_params.get("prioridade"),
        }
        # Converter string "true"/"false" para bool
        if filtros["lida"] is not None:
            filtros["lida"] = filtros["lida"].lower() == "true"

        qs = NotificacaoRepository.listar_todas(usuario_id, filtros)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = NotificacaoSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        cache.set(cache_key, response.data, 30)
        return response


class NotificacaoNaoLidasView(APIView):
    """GET /api/notificacoes/nao-lidas/ — Lista não lidas (máx 50)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuario_id = str(request.user.id)
        cache_key = f"synapse:{usuario_id}:notificacoes:nao_lidas"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        qs = NotificacaoRepository.listar_nao_lidas(usuario_id)
        serializer = NotificacaoSerializer(qs, many=True)
        data = {"success": True, "data": serializer.data, "message": ""}
        cache.set(cache_key, data, 30)
        return Response(data)


class NotificacaoContagemView(APIView):
    """GET /api/notificacoes/contagem/ — Contagem de não lidas (polling)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = NotificacaoService.contar_nao_lidas(str(request.user.id))
        return _success(data={"count": count})


class NotificacaoMarcarLidaView(APIView):
    """PATCH /api/notificacoes/{id}/marcar-lida/"""

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notificacao = NotificacaoService.marcar_lida(str(pk), str(request.user.id))
            # Invalidar cache de lista
            cache.delete(f"synapse:{request.user.id}:notificacoes:lista")
            cache.delete(f"synapse:{request.user.id}:notificacoes:nao_lidas")
            serializer = NotificacaoSerializer(notificacao)
            return _success(data=serializer.data, message="Notificação marcada como lida.")
        except Notificacao.DoesNotExist:
            return _error("NOT_FOUND", "Notificação não encontrada.", status_code=404)


class NotificacaoMarcarTodasLidasView(APIView):
    """PATCH /api/notificacoes/marcar-todas-lidas/"""

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        count = NotificacaoService.marcar_todas_lidas(
            str(request.user.id), str(request.user.empresa_id)
        )
        # Invalidar caches
        cache.delete(f"synapse:{request.user.id}:notificacoes:lista")
        cache.delete(f"synapse:{request.user.id}:notificacoes:nao_lidas")
        return _success(
            data={"marcadas": count},
            message=f"{count} notificação(ões) marcada(s) como lida(s).",
        )


class NotificacaoDeleteView(APIView):
    """DELETE /api/notificacoes/{id}/"""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        deleted = NotificacaoRepository.deletar(str(pk), str(request.user.id))
        if not deleted:
            return _error("NOT_FOUND", "Notificação não encontrada.", status_code=404)
        # Invalidar caches
        cache.delete(f"synapse:{request.user.id}:notificacoes:lista")
        cache.delete(f"synapse:{request.user.id}:notificacoes:nao_lidas")
        NotificacaoRepository.invalidar_cache_contagem(str(request.user.id))
        return _success(message="Notificação excluída.")
