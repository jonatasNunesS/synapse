"""
Mensagens Automáticas: Views — CRUD + Disparo Manual
"""
import logging
from datetime import datetime

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from shared.authentication import CookieJWTAuthentication
from shared.permissions import EmpresaQuerySetMixin, IsEmpresaMember
from shared.responses import success_response, created_response, no_content_response, error_response

from .models import MensagemAutomatica, LogEnvioMensagem

logger = logging.getLogger("synapse")

GATILHO_LABELS = {
    "aniversario": "Aniversário do Cliente",
    "followup_atrasado": "Follow-up Atrasado",
    "boas_vindas": "Boas-vindas (novo cliente)",
    "inativo_30d": "Cliente Inativo 30 dias",
    "inativo_60d": "Cliente Inativo 60 dias",
    "vencimento_proximo": "Vencimento Próximo (7 dias)",
    "manual": "Disparo Manual",
}


def _serialize(m, include_logs=False):
    data = {
        "id": str(m.id),
        "nome": m.nome,
        "assunto": m.assunto,
        "corpo_html": m.corpo_html,
        "gatilho": m.gatilho,
        "gatilho_label": GATILHO_LABELS.get(m.gatilho, m.gatilho),
        "status": m.status,
        "total_enviados": m.total_enviados,
        "ultimo_disparo": m.ultimo_disparo.isoformat() if m.ultimo_disparo else None,
        "criado_em": m.criado_em.isoformat(),
    }
    if include_logs:
        data["logs"] = [
            {
                "id": str(log.id),
                "destinatario_email": log.destinatario_email,
                "destinatario_nome": log.destinatario_nome,
                "status": log.status,
                "erro": log.erro,
                "enviado_em": log.enviado_em.isoformat(),
            }
            for log in m.logs.all()[:20]
        ]
    return data


def _enviar_email(api_key: str, from_email: str, to_email: str, assunto: str, html: str) -> bool:
    """Envia email via Resend API. Retorna True se enviado."""
    if not api_key:
        return False
    try:
        import urllib.request
        import json as _json
        payload = _json.dumps({
            "from": from_email,
            "to": [to_email],
            "subject": assunto,
            "html": html,
        }).encode()
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status < 300
    except Exception as exc:
        logger.warning(f"Falha ao enviar email via Resend: {exc}")
        return False


class MensagemListCreateView(EmpresaQuerySetMixin, APIView):
    """GET/POST /api/mensagens/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def get(self, request):
        empresa_id = self.get_empresa_id()
        qs = MensagemAutomatica.objects.filter(empresa_id=empresa_id)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return success_response(data=[_serialize(m) for m in qs])

    def post(self, request):
        empresa_id = self.get_empresa_id()
        d = request.data

        nome = str(d.get("nome", "")).strip()
        assunto = str(d.get("assunto", "")).strip()
        corpo_html = str(d.get("corpo_html", "")).strip()
        gatilho = d.get("gatilho", "")

        if not nome:
            return error_response("VALIDATION_ERROR", "O campo 'nome' é obrigatório.")
        if not assunto:
            return error_response("VALIDATION_ERROR", "O campo 'assunto' é obrigatório.")
        if not corpo_html:
            return error_response("VALIDATION_ERROR", "O campo 'corpo_html' é obrigatório.")
        if gatilho not in GATILHO_LABELS:
            return error_response("VALIDATION_ERROR", f"Gatilho inválido. Opções: {list(GATILHO_LABELS.keys())}")

        msg = MensagemAutomatica.objects.create(
            empresa_id=empresa_id,
            nome=nome,
            assunto=assunto,
            corpo_html=corpo_html,
            gatilho=gatilho,
            status=d.get("status", "rascunho"),
            criado_por=request.user,
        )
        return created_response(data=_serialize(msg), message="Mensagem criada com sucesso.")


class MensagemDetailView(EmpresaQuerySetMixin, APIView):
    """GET/PATCH/DELETE /api/mensagens/<pk>/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def _get(self, empresa_id, pk):
        try:
            return MensagemAutomatica.objects.get(id=pk, empresa_id=empresa_id)
        except MensagemAutomatica.DoesNotExist:
            return None

    def get(self, request, pk):
        msg = self._get(self.get_empresa_id(), pk)
        if not msg:
            return error_response("NOT_FOUND", "Mensagem não encontrada.", status_code=404)
        return success_response(data=_serialize(msg, include_logs=True))

    def patch(self, request, pk):
        msg = self._get(self.get_empresa_id(), pk)
        if not msg:
            return error_response("NOT_FOUND", "Mensagem não encontrada.", status_code=404)
        d = request.data
        for campo in ["nome", "assunto", "corpo_html", "gatilho", "status"]:
            if campo in d:
                setattr(msg, campo, d[campo])
        msg.save()
        return success_response(data=_serialize(msg), message="Mensagem atualizada.")

    def delete(self, request, pk):
        msg = self._get(self.get_empresa_id(), pk)
        if not msg:
            return error_response("NOT_FOUND", "Mensagem não encontrada.", status_code=404)
        msg.delete()
        return no_content_response()


class MensagemDispararView(EmpresaQuerySetMixin, APIView):
    """POST /api/mensagens/<pk>/disparar/ — disparo manual para lista de emails"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsEmpresaMember]

    def post(self, request, pk):
        empresa_id = self.get_empresa_id()
        try:
            msg = MensagemAutomatica.objects.get(id=pk, empresa_id=empresa_id)
        except MensagemAutomatica.DoesNotExist:
            return error_response("NOT_FOUND", "Mensagem não encontrada.", status_code=404)

        destinatarios = request.data.get("destinatarios", [])
        if not destinatarios or not isinstance(destinatarios, list):
            return error_response("VALIDATION_ERROR", "Forneça uma lista 'destinatarios' com email e nome.")

        api_key = getattr(settings, "RESEND_API_KEY", "")
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "Synapse <noreply@synapse.app>")
        debug = getattr(settings, "DEBUG", False)

        enviados = 0
        falhas = 0
        for dest in destinatarios[:50]:
            to_email = dest.get("email", "")
            to_nome = dest.get("nome", "")
            if not to_email:
                continue

            # Substituir variáveis no corpo
            html = msg.corpo_html.replace("{{nome}}", to_nome).replace("{{email}}", to_email)

            if debug or not api_key:
                log_status = "simulado"
                sucesso = True
            else:
                sucesso = _enviar_email(api_key, from_email, to_email, msg.assunto, html)
                log_status = "enviado" if sucesso else "falhou"

            LogEnvioMensagem.objects.create(
                mensagem=msg,
                empresa_id=empresa_id,
                destinatario_email=to_email,
                destinatario_nome=to_nome,
                status=log_status,
            )
            if sucesso:
                enviados += 1
            else:
                falhas += 1

        msg.total_enviados += enviados
        msg.ultimo_disparo = datetime.now()
        msg.save()

        return success_response(data={
            "enviados": enviados,
            "falhas": falhas,
            "total": enviados + falhas,
            "modo": "simulado (dev)" if (debug or not api_key) else "real",
        }, message=f"Disparo concluído: {enviados} enviados, {falhas} falhas.")
