"""
Synapse — M1: Tasks Celery de Autenticação
Envio de e-mails via Resend (assíncrono).
"""

import logging
import os

from celery import shared_task

logger = logging.getLogger("synapse.auth.tasks")

FRONTEND_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")


@shared_task(
    bind=True,
    name="auth.enviar_email_recuperacao",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def enviar_email_recuperacao(self, email: str, token: str, nome: str) -> dict:
    """
    Envia e-mail de recuperação de senha via Resend.
    Retry automático em caso de falha (max 3 tentativas).

    Args:
        email: E-mail do destinatário.
        token: Token de redefinição.
        nome: Nome do usuário.

    Returns:
        Dict com status do envio.
    """
    link = f"{FRONTEND_URL}/redefinir-senha?token={token}"

    html_body = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Redefinição de Senha — Synapse</title>
    </head>
    <body style="font-family: Inter, Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0;">
      <div style="max-width: 560px; margin: 40px auto; background: #1e293b; border-radius: 12px; padding: 40px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 28px; font-weight: 700; color: #a78bfa;">Synapse</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px;">
          Redefinição de senha
        </h1>
        <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
          Olá, <strong style="color: #e2e8f0;">{nome}</strong>!<br><br>
          Recebemos uma solicitação para redefinir a senha da sua conta no Synapse.
          Clique no botão abaixo para criar uma nova senha.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="{link}"
             style="display: inline-block; background: #7c3aed; color: #fff;
                    text-decoration: none; padding: 14px 32px; border-radius: 8px;
                    font-weight: 600; font-size: 15px;">
            Redefinir minha senha
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          Este link expira em <strong>2 horas</strong>. Se você não solicitou a redefinição,
          ignore este e-mail — sua senha permanece a mesma.
        </p>
        <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;">
        <p style="color: #475569; font-size: 12px; text-align: center;">
          Synapse · Gestão Empresarial com IA
        </p>
      </div>
    </body>
    </html>
    """

    resend_api_key = os.getenv("RESEND_API_KEY", "")

    if not resend_api_key:
        # Em desenvolvimento sem chave: apenas loga o link
        logger.warning(
            "RESEND_API_KEY não configurada. E-mail não enviado.",
            extra={"email": email, "link": link},
        )
        return {"status": "skipped", "reason": "RESEND_API_KEY not set", "link": link}

    try:
        import resend  # type: ignore

        resend.api_key = resend_api_key
        params = {
            "from": "Synapse <noreply@synapse.app>",
            "to": [email],
            "subject": "Redefinição de senha — Synapse",
            "html": html_body,
        }
        response = resend.Emails.send(params)
        email_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
        logger.info("E-mail de recuperação enviado", extra={"email": email, "id": email_id})
        return {"status": "sent", "id": email_id}

    except Exception as exc:
        logger.error(
            "Falha ao enviar e-mail de recuperação",
            extra={"email": email, "error": str(exc)},
        )
        raise self.retry(exc=exc)
