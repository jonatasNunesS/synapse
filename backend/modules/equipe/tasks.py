"""
Synapse — M7: Tasks Celery do módulo Equipe.
"""
import logging
import os

from celery import shared_task

logger = logging.getLogger("synapse")

FRONTEND_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")


def _html_convite(nome: str, empresa_nome: str, link: str) -> str:
    """E-mail de convite: traz o LINK de primeiro acesso, nunca uma senha."""
    return f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><title>Convite — Synapse</title></head>
    <body style="font-family: Inter, Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0;">
      <div style="max-width: 560px; margin: 40px auto; background: #1e293b; border-radius: 12px; padding: 40px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 28px; font-weight: 700; color: #a78bfa;">Synapse</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px;">
          Você foi convidado(a) para a equipe
        </h1>
        <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
          Olá, <strong style="color: #e2e8f0;">{nome}</strong>!<br><br>
          Você foi adicionado(a) à equipe da empresa
          <strong style="color: #e2e8f0;">{empresa_nome}</strong> no Synapse.
          Para acessar, defina sua senha clicando no botão abaixo.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="{link}"
             style="display: inline-block; background: #7c3aed; color: #fff;
                    text-decoration: none; padding: 14px 32px; border-radius: 8px;
                    font-weight: 600; font-size: 15px;">
            Definir senha e acessar
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          Este link expira em <strong>48 horas</strong>. Se você não esperava este
          convite, pode ignorar este e-mail.
        </p>
        <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;">
        <p style="color: #475569; font-size: 12px; text-align: center;">
          Synapse · Gestão Empresarial com IA
        </p>
      </div>
    </body>
    </html>
    """


@shared_task(name="equipe.enviar_email_convite", bind=True, max_retries=3)
def enviar_email_convite(self, usuario_id: str, empresa_nome: str, token: str):
    """
    Envia o e-mail de convite/primeiro acesso via Resend, com o LINK de
    definição de senha (token de convite, 48h). Sem RESEND_API_KEY, loga o
    link para permitir o teste em desenvolvimento.
    """
    try:
        from modules.auth.models import CustomUser
        from django.conf import settings

        usuario = CustomUser.objects.get(id=usuario_id)
        link = f"{FRONTEND_URL}/redefinir-senha?token={token}&convite=1"

        if not settings.RESEND_API_KEY:
            logger.warning(
                "RESEND_API_KEY não configurado. E-mail de convite não enviado.",
                extra={"email": usuario.email, "link": link},
            )
            return {"status": "skipped", "reason": "no_api_key", "link": link}

        import resend

        resend.api_key = settings.RESEND_API_KEY
        params = {
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [usuario.email],
            "subject": f"Convite para a equipe — {empresa_nome} · Synapse",
            "html": _html_convite(usuario.nome, empresa_nome, link),
        }
        resend.Emails.send(params)
        logger.info(
            "E-mail de convite enviado",
            extra={"usuario_id": usuario_id, "email": usuario.email},
        )
        return {"status": "ok", "email": usuario.email}

    except Exception as exc:
        logger.error(f"Erro ao enviar e-mail de convite: {exc}")
        raise self.retry(exc=exc, countdown=60)
