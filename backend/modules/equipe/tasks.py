"""
Synapse — M7: Envio de e-mail de convite do módulo Equipe.

O convite é enviado de forma SÍNCRONA (não via Celery) porque o envio precisa
ser atômico com a criação do membro: se o e-mail não sai, o convite inteiro
falha e nada é persistido (ver EquipeService.convidar_membro). Um envio
assíncrono não permitiria o rollback da criação.
"""
import logging
import os

from django.conf import settings

from .exceptions import ConviteEmailError

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


def enviar_convite_email(usuario, empresa_nome: str, token: str) -> None:
    """
    Envia o e-mail de convite/primeiro acesso via Resend, SÍNCRONO.
    Levanta ConviteEmailError em qualquer falha (sem chave, domínio não
    verificado, erro do Resend) para que o chamador faça rollback da criação.
    """
    link = f"{FRONTEND_URL}/redefinir-senha?token={token}&convite=1"

    if not settings.RESEND_API_KEY:
        raise ConviteEmailError(
            "E-mail de convite não configurado no servidor (RESEND_API_KEY ausente). "
            "O membro não foi criado."
        )

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        params = {
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [usuario.email],
            "subject": f"Convite para a equipe — {empresa_nome} · Synapse",
            "html": _html_convite(usuario.nome, empresa_nome, link),
        }
        resposta = resend.Emails.send(params)
    except ConviteEmailError:
        raise
    except Exception as exc:
        logger.error(
            "Falha ao enviar e-mail de convite",
            extra={"email": usuario.email, "error": str(exc)},
        )
        raise ConviteEmailError(
            f"Não foi possível enviar o e-mail de convite: {exc}. O membro não foi criado."
        )

    # O SDK do Resend retorna erro no corpo (dict com 'statusCode'/'message')
    # em vez de levantar em alguns casos (ex.: domínio não verificado).
    erro_resend = None
    if isinstance(resposta, dict):
        if resposta.get("statusCode") and resposta.get("statusCode") >= 400:
            erro_resend = resposta.get("message") or resposta.get("error") or str(resposta)
        elif not resposta.get("id"):
            erro_resend = resposta.get("message") or str(resposta)
    if erro_resend:
        logger.error(
            "Resend recusou o e-mail de convite",
            extra={"email": usuario.email, "error": erro_resend},
        )
        raise ConviteEmailError(
            f"O provedor de e-mail recusou o convite: {erro_resend}. O membro não foi criado."
        )

    logger.info(
        "E-mail de convite enviado",
        extra={"email": usuario.email},
    )
