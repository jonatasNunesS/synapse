"""
Agenda: Views — CRUD de Eventos
"""
import logging
from datetime import datetime

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import EmpresaQuerySetMixin, IsEmpresaMember
from shared.responses import success_response, created_response, no_content_response, error_response

from .models import Evento

logger = logging.getLogger("synapse")


class EventoListCreateView(EmpresaQuerySetMixin, APIView):
    """GET /api/agenda/eventos/ — POST /api/agenda/eventos/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        qs = Evento.objects.filter(empresa_id=empresa_id)

        # Filtros de período
        data_inicio = request.query_params.get("data_inicio")
        data_fim = request.query_params.get("data_fim")
        tipo = request.query_params.get("tipo")
        concluido = request.query_params.get("concluido")

        if data_inicio:
            try:
                qs = qs.filter(data_inicio__date__gte=datetime.fromisoformat(data_inicio).date())
            except ValueError:
                pass
        if data_fim:
            try:
                qs = qs.filter(data_inicio__date__lte=datetime.fromisoformat(data_fim).date())
            except ValueError:
                pass
        if tipo:
            qs = qs.filter(tipo=tipo)
        if concluido is not None:
            qs = qs.filter(concluido=concluido.lower() == "true")

        data = [
            {
                "id": str(e.id),
                "titulo": e.titulo,
                "descricao": e.descricao,
                "tipo": e.tipo,
                "cor": e.cor,
                "data_inicio": e.data_inicio.isoformat(),
                "data_fim": e.data_fim.isoformat() if e.data_fim else None,
                "dia_inteiro": e.dia_inteiro,
                "local": e.local,
                "concluido": e.concluido,
                "lembrete_minutos": e.lembrete_minutos,
                "criado_em": e.criado_em.isoformat(),
            }
            for e in qs
        ]
        return success_response(data=data)

    def post(self, request):
        empresa_id = self.get_empresa_id()
        d = request.data

        titulo = d.get("titulo", "").strip()
        if not titulo:
            return error_response("VALIDATION_ERROR", "O campo 'titulo' é obrigatório.")

        data_inicio_raw = d.get("data_inicio")
        if not data_inicio_raw:
            return error_response("VALIDATION_ERROR", "O campo 'data_inicio' é obrigatório.")

        try:
            data_inicio = datetime.fromisoformat(data_inicio_raw)
        except (ValueError, TypeError):
            return error_response("VALIDATION_ERROR", "data_inicio inválida. Use ISO format.")

        data_fim = None
        if d.get("data_fim"):
            try:
                data_fim = datetime.fromisoformat(d["data_fim"])
            except (ValueError, TypeError):
                pass

        evento = Evento.objects.create(
            empresa_id=empresa_id,
            titulo=titulo,
            descricao=d.get("descricao", ""),
            tipo=d.get("tipo", "reuniao"),
            cor=d.get("cor", "#6D28D9"),
            data_inicio=data_inicio,
            data_fim=data_fim,
            dia_inteiro=bool(d.get("dia_inteiro", False)),
            local=d.get("local", ""),
            lembrete_minutos=d.get("lembrete_minutos"),
            criado_por=request.user,
        )

        return created_response(
            data={
                "id": str(evento.id),
                "titulo": evento.titulo,
                "descricao": evento.descricao,
                "tipo": evento.tipo,
                "cor": evento.cor,
                "data_inicio": evento.data_inicio.isoformat(),
                "data_fim": evento.data_fim.isoformat() if evento.data_fim else None,
                "dia_inteiro": evento.dia_inteiro,
                "local": evento.local,
                "concluido": evento.concluido,
                "lembrete_minutos": evento.lembrete_minutos,
                "criado_em": evento.criado_em.isoformat(),
            },
            message="Evento criado com sucesso.",
        )


class EventoDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PATCH/DELETE /api/agenda/eventos/<pk>/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def _get_evento(self, empresa_id, pk):
        try:
            return Evento.objects.get(id=pk, empresa_id=empresa_id)
        except Evento.DoesNotExist:
            return None

    def _serialize(self, e):
        return {
            "id": str(e.id),
            "titulo": e.titulo,
            "descricao": e.descricao,
            "tipo": e.tipo,
            "cor": e.cor,
            "data_inicio": e.data_inicio.isoformat(),
            "data_fim": e.data_fim.isoformat() if e.data_fim else None,
            "dia_inteiro": e.dia_inteiro,
            "local": e.local,
            "concluido": e.concluido,
            "lembrete_minutos": e.lembrete_minutos,
            "criado_em": e.criado_em.isoformat(),
            "atualizado_em": e.atualizado_em.isoformat(),
        }

    def get(self, request, pk):
        evento = self._get_evento(self.get_empresa_id(), pk)
        if not evento:
            return error_response("NOT_FOUND", "Evento não encontrado.", status_code=404)
        return success_response(data=self._serialize(evento))

    def patch(self, request, pk):
        evento = self._get_evento(self.get_empresa_id(), pk)
        if not evento:
            return error_response("NOT_FOUND", "Evento não encontrado.", status_code=404)

        d = request.data
        campos_texto = ["titulo", "descricao", "tipo", "cor", "local"]
        for campo in campos_texto:
            if campo in d:
                setattr(evento, campo, d[campo])

        if "data_inicio" in d:
            try:
                evento.data_inicio = datetime.fromisoformat(d["data_inicio"])
            except (ValueError, TypeError):
                return error_response("VALIDATION_ERROR", "data_inicio inválida.")

        if "data_fim" in d:
            if d["data_fim"]:
                try:
                    evento.data_fim = datetime.fromisoformat(d["data_fim"])
                except (ValueError, TypeError):
                    return error_response("VALIDATION_ERROR", "data_fim inválida.")
            else:
                evento.data_fim = None

        if "dia_inteiro" in d:
            evento.dia_inteiro = bool(d["dia_inteiro"])
        if "concluido" in d:
            evento.concluido = bool(d["concluido"])
        if "lembrete_minutos" in d:
            evento.lembrete_minutos = d["lembrete_minutos"]

        evento.save()
        return success_response(data=self._serialize(evento), message="Evento atualizado.")

    def delete(self, request, pk):
        evento = self._get_evento(self.get_empresa_id(), pk)
        if not evento:
            return error_response("NOT_FOUND", "Evento não encontrado.", status_code=404)
        evento.delete()
        return no_content_response()
