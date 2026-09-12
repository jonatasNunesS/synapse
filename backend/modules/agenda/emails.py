"""
Synapse — Agenda: e-mail HTML do lembrete de evento.

Mesmo padrão de `equipe/emails.py`: uma função PURA que monta (assunto, html)
— fácil de testar sem rede — e um boundary de envio que NUNCA levanta. Um
lembrete que falha não pode derrubar a varredura dos outros eventos.
"""
import logging
import os

from django.conf import settings

logger = logging.getLogger("synapse")

# Paleta do Synapse usada nos e-mails (a mesma de equipe/emails.py).
COR_PRIMARIA = "#6D28D9"
COR_CARD = "#1E1B2E"
COR_TEXTO = "#FFFFFF"
COR_TEXTO_SEC = "#A78BFA"
COR_BORDA = "#2D2640"


def _frontend_url() -> str:
    """BASE_URL do front — FRONTEND_URL, ou NEXT_PUBLIC_APP_URL, ou localhost."""
    return (
        os.getenv("FRONTEND_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or "http://localhost:3000"
    ).rstrip("/")


def _quando(evento) -> str:
    """Quando o evento é, em português e no fuso da empresa (TIME_ZONE)."""
    from django.utils import timezone

    inicio = timezone.localtime(evento.data_inicio)
    if evento.dia_inteiro:
        return f"{inicio:%d/%m/%Y} · dia inteiro"
    fim = timezone.localtime(evento.data_fim)
    if inicio.date() == fim.date():
        return f"{inicio:%d/%m/%Y} · {inicio:%H:%M} – {fim:%H:%M}"
    return f"{inicio:%d/%m/%Y %H:%M} → {fim:%d/%m/%Y %H:%M}"


def _antecedencia_txt(evento) -> str:
    """"daqui a 30 minutos" / "amanhã" — como o lembrete se apresenta."""
    minutos = evento.lembrete_antecedencia
    if minutos >= 1440:
        dias = minutos // 1440
        return "amanhã" if dias == 1 else f"em {dias} dias"
    if minutos >= 60:
        horas = minutos // 60
        return f"daqui a {horas} hora" + ("s" if horas != 1 else "")
    return f"daqui a {minutos} minutos"


def _linha(rotulo: str, valor: str) -> str:
    return (
        f'<tr><td style="color:#8B80A8;font-size:13px;padding:3px 0;">{rotulo}</td>'
        f'<td style="color:{COR_TEXTO};font-size:14px;font-weight:600;'
        f'text-align:right;">{valor}</td></tr>'
    )


def render_email_lembrete(evento, empresa_nome: str, link: str) -> tuple:
    """Monta (assunto, html) do lembrete. Função pura — fácil de testar."""
    from django.utils.html import escape

    titulo = escape(evento.titulo or "Evento")
    quando = _quando(evento)
    assunto = f"Lembrete: {titulo}"

    linhas = [_linha("Quando", quando)]
    if evento.local:
        linhas.append(_linha("Onde", escape(evento.local)))
    if evento.cliente_id:
        linhas.append(_linha("Cliente", escape(evento.cliente.nome)))

    descricao_bloco = ""
    if evento.descricao:
        descricao_bloco = (
            f'<p style="margin:16px 0 0;color:#C4B5FD;font-size:13px;'
            f'line-height:1.6;white-space:pre-wrap;">{escape(evento.descricao)}</p>'
        )

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{assunto}</title></head>
<body style="font-family: Inter, Arial, sans-serif; background:#0F0D18; color:{COR_TEXTO}; margin:0; padding:0;">
  <div style="max-width:560px; margin:32px auto; padding:0 16px;">
    <div style="display:flex; align-items:center; gap:8px; padding:8px 4px 20px;">
      <span style="font-size:22px; font-weight:800; color:{COR_TEXTO_SEC};">Synapse</span>
      <span style="color:#5B5470;">·</span>
      <span style="font-size:14px; color:#8B80A8;">{escape(empresa_nome)}</span>
    </div>

    <h1 style="font-size:22px; font-weight:700; color:{COR_TEXTO}; margin:0 0 6px;">
      📅 {titulo}
    </h1>
    <p style="margin:0 0 20px; color:{COR_TEXTO_SEC}; font-size:14px;">
      Começa {_antecedencia_txt(evento)}.
    </p>

    <div style="background:{COR_CARD}; border:1px solid {COR_BORDA}; border-radius:14px; padding:24px;">
      <table style="width:100%; border-collapse:collapse;">
        {"".join(linhas)}
      </table>
      {descricao_bloco}
    </div>

    <div style="text-align:center; margin:28px 0 8px;">
      <a href="{link}" style="display:inline-block; background:{COR_PRIMARIA}; color:#fff;
         text-decoration:none; padding:13px 30px; border-radius:9px; font-weight:600; font-size:15px;">
        Abrir a agenda →
      </a>
    </div>

    <hr style="border:none; border-top:1px solid #2A2540; margin:28px 0 16px;">
    <p style="color:#5B5470; font-size:12px; text-align:center; line-height:1.6;">
      Synapse · {escape(empresa_nome)}<br>
      Você recebeu este lembrete porque pediu um aviso para este compromisso.
    </p>
  </div>
</body>
</html>"""
    return assunto, html


def _enviar(to: str, subject: str, html: str) -> None:
    """
    Boundary de envio. Sem RESEND_API_KEY → loga o e-mail (mesmo padrão dos
    demais e-mails do sistema). Nunca levanta: falhas são logadas.
    """
    if not settings.RESEND_API_KEY:
        logger.info(
            "Lembrete de agenda (RESEND ausente — apenas log)",
            extra={"to": to, "subject": subject},
        )
        return
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        resposta = resend.Emails.send(
            {
                "from": settings.DEFAULT_FROM_EMAIL,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
        if isinstance(resposta, dict) and resposta.get("statusCode", 0) >= 400:
            logger.error(
                "Resend recusou o lembrete de agenda",
                extra={"to": to, "error": resposta.get("message") or str(resposta)},
            )
    except Exception as exc:  # nunca interrompe a varredura
        logger.error(
            "Falha ao enviar lembrete de agenda", extra={"to": to, "error": str(exc)}
        )


def enviar_email_lembrete(evento, destinatario_email: str) -> None:
    """
    Envia o lembrete ao destinatário. Nunca levanta — qualquer erro é logado,
    para que um e-mail ruim não impeça o sino nem os outros eventos da rodada.
    """
    try:
        if not destinatario_email:
            return
        empresa_nome = getattr(evento.empresa, "nome", "") or ""
        link = f"{_frontend_url()}/agenda"
        assunto, html = render_email_lembrete(evento, empresa_nome, link)
        _enviar(destinatario_email, assunto, html)
    except Exception as exc:  # defensivo — e-mail nunca derruba o lembrete
        logger.error(
            "Erro ao montar/enviar lembrete de agenda",
            extra={"evento_id": str(getattr(evento, "id", "")), "error": str(exc)},
        )
