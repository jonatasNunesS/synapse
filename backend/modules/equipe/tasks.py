"""
Synapse — M7: Tasks Celery do módulo Equipe.
"""
import logging
from celery import shared_task

logger = logging.getLogger("synapse")


@shared_task(name="equipe.enviar_email_boas_vindas", bind=True, max_retries=3)
def enviar_email_boas_vindas(self, usuario_id: str, empresa_nome: str):
    """Envia e-mail de boas-vindas para novo membro via Resend."""
    try:
        from modules.auth.models import CustomUser
        from django.conf import settings
        import resend

        usuario = CustomUser.objects.get(id=usuario_id)
        if not settings.RESEND_API_KEY:
            logger.warning("RESEND_API_KEY não configurado. E-mail de boas-vindas não enviado.")
            return {"status": "skipped", "reason": "no_api_key"}

        resend.api_key = settings.RESEND_API_KEY
        # A API do Resend exige a chave "from"; SendParams(from_=...) gerava
        # a chave literal "from_", rejeitada com 422 em todo envio.
        params = {
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [usuario.email],
            "subject": f"Bem-vindo ao Synapse — {empresa_nome}",
            "html": (
                f"<h2>Olá, {usuario.nome}!</h2>"
                f"<p>Você foi adicionado à equipe da empresa <strong>{empresa_nome}</strong> "
                f"no Synapse.</p>"
                f"<p>Acesse a plataforma para começar: "
                f"<a href='https://synapse.app'>synapse.app</a></p>"
                f"<p>Equipe Synapse</p>"
            ),
        }
        resend.Emails.send(params)
        logger.info(
            "E-mail de boas-vindas enviado",
            extra={"usuario_id": usuario_id, "email": usuario.email},
        )
        return {"status": "ok", "email": usuario.email}

    except Exception as exc:
        logger.error(f"Erro ao enviar e-mail de boas-vindas: {exc}")
        raise self.retry(exc=exc, countdown=60)
