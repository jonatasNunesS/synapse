"""
Synapse — Módulo Agenda: Views
View → Service → Repository. Multi-tenant obrigatório (EmpresaQuerySetMixin).
"""
import logging

from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.cache import build_cache_key, get_cached, set_cached
from shared.pagination import StandardPagination
from shared.permissions import EmpresaQuerySetMixin, IsEmpresaMember
from shared.responses import (
    created_response,
    error_response,
    no_content_response,
    success_response,
)

from .repository import CACHE_TTL
from .serializers import EventoCreateSerializer, EventoSerializer
from .services import AgendaService

logger = logging.getLogger("synapse")


class EventoListCreateView(EmpresaQuerySetMixin, APIView):
    """
    GET  /api/agenda/?inicio=&fim=  → lista eventos (por intervalo, paginado)
    POST /api/agenda/               → cria evento
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        inicio = self._parse_dt(request.query_params.get("inicio"))
        fim = self._parse_dt(request.query_params.get("fim"))

        # Cache da página (chave inclui os query params: intervalo + page)
        params = dict(request.query_params)
        cache_key = build_cache_key(empresa_id, "agenda", "lista", params)
        cached = get_cached(cache_key)
        if cached is not None:
            from rest_framework.response import Response

            return Response(cached)

        eventos = AgendaService.listar_eventos(empresa_id, inicio, fim)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(eventos, request)
        serializer = EventoSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        set_cached(cache_key, response.data, CACHE_TTL)
        return response

    def post(self, request):
        empresa_id = self.get_empresa_id()
        serializer = EventoCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        evento = AgendaService.criar_evento(
            empresa_id, request.user.id, serializer.validated_data
        )
        return created_response(
            data=EventoSerializer(evento).data,
            message="Evento criado com sucesso.",
        )

    @staticmethod
    def _parse_dt(value):
        """Converte string ISO em datetime (aware). Retorna None se ausente/inválida."""
        if not value:
            return None
        dt = parse_datetime(value)
        if dt is None:
            # Aceita data pura (YYYY-MM-DD) → início do dia
            from django.utils.dateparse import parse_date

            d = parse_date(value)
            if d is None:
                return None
            from datetime import datetime, time

            dt = datetime.combine(d, time.min)
        # USE_TZ=True: garante datetime aware
        from django.utils import timezone

        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return dt


class EventoDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PUT/PATCH/DELETE /api/agenda/{id}/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request, pk):
        empresa_id = self.get_empresa_id()
        evento = self._get(empresa_id, pk)
        return success_response(data=EventoSerializer(evento).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def delete(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            AgendaService.deletar_evento(empresa_id, pk)
        except ValueError as e:
            return error_response("EVENTO_NAO_ENCONTRADO", str(e), status_code=404)
        return no_content_response()

    def _get(self, empresa_id, pk):
        from .repository import AgendaRepository

        evento = AgendaRepository.obter(empresa_id, pk)
        if not evento:
            raise NotFound("Evento não encontrado.")
        return evento

    def _update(self, request, pk, partial: bool):
        empresa_id = self.get_empresa_id()
        evento = self._get(empresa_id, pk)
        serializer = EventoCreateSerializer(
            evento, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        evento = AgendaService.atualizar_evento(
            empresa_id, pk, serializer.validated_data
        )
        return success_response(
            data=EventoSerializer(evento).data,
            message="Evento atualizado com sucesso.",
        )
