"""
Synapse — Equipe: e-mail HTML de metas.

Enviado ao MEMBRO (nunca ao admin) nos 3 momentos do ciclo de vida da meta:
criada, editada e concluída. Envio SÍNCRONO via Resend, mas NÃO crítico: se o
Resend falhar ou não estiver configurado, apenas loga — nunca quebra o save da
meta (todas as chamadas são embrulhadas em try/except no chamador e aqui).
"""
import logging
import os
from datetime import date

from django.conf import settings

logger = logging.getLogger("synapse")

# Paleta do Synapse usada nos e-mails.
COR_PRIMARIA = "#6D28D9"
COR_CARD = "#1E1B2E"
COR_TEXTO = "#FFFFFF"
COR_TEXTO_SEC = "#A78BFA"
COR_VERDE = "#10B981"
COR_AMARELO = "#F59E0B"
COR_TRILHO = "#2D1B69"

MOMENTOS = {
    "criada": {
        "titulo": "🎯 Você recebeu uma nova meta!",
        "assunto": "Você recebeu uma nova meta",
    },
    "editada": {
        "titulo": "✏️ Sua meta foi atualizada",
        "assunto": "Sua meta foi atualizada",
    },
    "concluida": {
        "titulo": "🏆 Parabéns! Meta concluída!",
        "assunto": "Parabéns! Você concluiu uma meta 🎉",
    },
}

# Rótulos amigáveis dos campos (para o bloco "O que mudou").
CAMPO_LABEL = {
    "titulo": "Título",
    "descricao": "Descrição",
    "tipo": "Tipo",
    "valor_meta": "Meta",
    "valor_atual": "Valor atual",
    "periodo": "Período",
    "data_inicio": "Início",
    "data_fim": "Prazo",
}


def _frontend_url() -> str:
    """BASE_URL do front — FRONTEND_URL, ou NEXT_PUBLIC_APP_URL, ou localhost."""
    return (
        os.getenv("FRONTEND_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or "http://localhost:3000"
    ).rstrip("/")


def _fmt_valor(meta, valor) -> str:
    """Formata como moeda (metas de vendas) ou número (demais tipos)."""
    try:
        n = float(valor)
    except (TypeError, ValueError):
        n = 0.0
    if meta.tipo == "vendas":
        return "R$ " + f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    # Número "limpo" (sem casas decimais quando inteiro).
    return f"{n:,.0f}".replace(",", ".") if n == int(n) else f"{n}"


def _progresso_pct(meta) -> int:
    if meta.valor_meta and float(meta.valor_meta) > 0:
        pct = float(meta.valor_atual) / float(meta.valor_meta) * 100
        return max(0, min(100, round(pct)))
    return 0


def _barra_progresso(pct: int, concluida: bool) -> str:
    cor = COR_VERDE if concluida else COR_PRIMARIA
    largura = 100 if concluida else pct
    return (
        f'<div style="background:{COR_TRILHO};border-radius:8px;height:12px;width:100%">'
        f'<div style="background:{cor};border-radius:8px;height:12px;width:{largura}%"></div>'
        f"</div>"
    )


def _dias_restantes_txt(meta) -> str:
    if not meta.data_fim:
        return ""
    dias = (meta.data_fim - date.today()).days
    if dias > 0:
        return f"{dias} dia{'s' if dias != 1 else ''} restante{'s' if dias != 1 else ''}"
    if dias == 0:
        return "vence hoje"
    return f"venceu há {abs(dias)} dia{'s' if abs(dias) != 1 else ''}"


def _bloco_mudancas(meta, campos_alterados: dict) -> str:
    """Bloco 'O que mudou' — lista cada campo alterado (de → para)."""
    if not campos_alterados:
        return ""
    linhas = []
    for campo, mudanca in campos_alterados.items():
        label = CAMPO_LABEL.get(campo, campo)
        de = mudanca.get("de")
        para = mudanca.get("para")
        if campo in ("valor_meta", "valor_atual"):
            de, para = _fmt_valor(meta, de), _fmt_valor(meta, para)
        linhas.append(
            f'<li style="margin-bottom:4px;">{label} alterado de '
            f'<strong>{de}</strong> para <strong>{para}</strong></li>'
        )
    return (
        f'<div style="margin-top:20px;padding:14px 16px;background:#2A2540;'
        f'border-radius:10px;border-left:3px solid {COR_AMARELO};">'
        f'<p style="margin:0 0 8px;color:{COR_AMARELO};font-weight:600;font-size:13px;">'
        f"O que mudou</p>"
        f'<ul style="margin:0;padding-left:18px;color:#C4B5FD;font-size:13px;line-height:1.5;">'
        f'{"".join(linhas)}</ul></div>'
    )


def render_email_meta(meta, momento: str, empresa_nome: str, link: str,
                      campos_alterados: dict = None) -> tuple:
    """Monta (assunto, html) da variante pedida. Função pura — fácil de testar."""
    cfg = MOMENTOS.get(momento, MOMENTOS["editada"])
    concluida = momento == "concluida"
    pct = 100 if concluida else _progresso_pct(meta)
    card_bg = "#20243B" if concluida else COR_CARD
    borda_card = f"2px solid {COR_VERDE}" if concluida else "1px solid #2D2640"

    unidade_meta = _fmt_valor(meta, meta.valor_meta)
    unidade_atual = _fmt_valor(meta, meta.valor_atual)
    tipo_label = meta.get_tipo_display()
    periodo_label = meta.get_periodo_display()
    prazo_txt = meta.data_fim.strftime("%d/%m/%Y") if meta.data_fim else "—"
    dias = _dias_restantes_txt(meta)

    abaixo_barra = (
        f'<p style="margin:8px 0 0;color:{COR_VERDE};font-weight:600;font-size:14px;">'
        f"Meta atingida! 🎉</p>"
        if concluida
        else f'<p style="margin:6px 0 0;color:{COR_TEXTO_SEC};font-size:13px;">{pct}%</p>'
    )

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{cfg['assunto']}</title></head>
<body style="font-family: Inter, Arial, sans-serif; background:#0F0D18; color:{COR_TEXTO}; margin:0; padding:0;">
  <div style="max-width:560px; margin:32px auto; padding:0 16px;">
    <div style="display:flex; align-items:center; gap:8px; padding:8px 4px 20px;">
      <span style="font-size:22px; font-weight:800; color:{COR_TEXTO_SEC};">Synapse</span>
      <span style="color:#5B5470;">·</span>
      <span style="font-size:14px; color:#8B80A8;">{empresa_nome}</span>
    </div>

    <h1 style="font-size:22px; font-weight:700; color:{COR_TEXTO}; margin:0 0 20px;">{cfg['titulo']}</h1>

    <div style="background:{card_bg}; border:{borda_card}; border-radius:14px; padding:24px;">
      <h2 style="font-size:18px; font-weight:700; color:{COR_TEXTO}; margin:0 0 4px;">{meta.titulo}</h2>
      <p style="margin:0 0 18px; color:{COR_TEXTO_SEC}; font-size:13px;">
        Tipo: {tipo_label} · Período: {periodo_label}
      </p>

      <table style="width:100%; border-collapse:collapse; margin-bottom:18px;">
        <tr>
          <td style="color:#8B80A8; font-size:13px; padding:2px 0;">Meta</td>
          <td style="color:{COR_TEXTO}; font-size:14px; font-weight:600; text-align:right;">{unidade_meta}</td>
        </tr>
        <tr>
          <td style="color:#8B80A8; font-size:13px; padding:2px 0;">Atual</td>
          <td style="color:{COR_TEXTO}; font-size:14px; font-weight:600; text-align:right;">{unidade_atual}</td>
        </tr>
      </table>

      <p style="margin:0 0 8px; color:#8B80A8; font-size:13px;">Progresso</p>
      {_barra_progresso(pct, concluida)}
      {abaixo_barra}

      <p style="margin:18px 0 0; color:#8B80A8; font-size:13px;">
        Prazo: <span style="color:{COR_TEXTO};">{prazo_txt}</span>
        {f'<span style="color:{COR_TEXTO_SEC};"> ({dias})</span>' if dias else ''}
      </p>
    </div>

    {_bloco_mudancas(meta, campos_alterados)}

    <div style="text-align:center; margin:28px 0 8px;">
      <a href="{link}" style="display:inline-block; background:{COR_PRIMARIA}; color:#fff;
         text-decoration:none; padding:13px 30px; border-radius:9px; font-weight:600; font-size:15px;">
        Ver minha meta →
      </a>
    </div>

    <hr style="border:none; border-top:1px solid #2A2540; margin:28px 0 16px;">
    <p style="color:#5B5470; font-size:12px; text-align:center; line-height:1.6;">
      Synapse · {empresa_nome}<br>
      Você recebeu este e-mail porque faz parte da equipe.
    </p>
  </div>
</body>
</html>"""
    return cfg["assunto"], html


def _enviar(to: str, subject: str, html: str) -> None:
    """
    Boundary de envio. Sem RESEND_API_KEY → loga o e-mail (mesmo padrão dos
    demais e-mails). Nunca levanta: falhas são logadas.
    """
    if not settings.RESEND_API_KEY:
        logger.info(
            "E-mail de meta (RESEND ausente — apenas log)",
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
                "Resend recusou o e-mail de meta",
                extra={"to": to, "error": resposta.get("message") or str(resposta)},
            )
    except Exception as exc:  # nunca quebra o save da meta
        logger.error("Falha ao enviar e-mail de meta", extra={"to": to, "error": str(exc)})


def enviar_email_meta(meta, momento: str, campos_alterados: dict = None) -> None:
    """
    Envia o e-mail da meta ao MEMBRO responsável. Nunca levanta — qualquer erro
    é logado, para não interromper a operação de salvar a meta.
    """
    try:
        membro = meta.membro
        usuario = getattr(membro, "usuario", None)
        to = getattr(usuario, "email", None)
        if not to:
            logger.warning("Meta sem e-mail de membro; e-mail não enviado.",
                           extra={"meta_id": str(meta.id)})
            return
        empresa_nome = getattr(meta.empresa, "nome", "") or ""
        link = f"{_frontend_url()}/equipe/{membro.id}"
        assunto, html = render_email_meta(meta, momento, empresa_nome, link, campos_alterados)
        _enviar(to, assunto, html)
    except Exception as exc:  # defensivo — e-mail nunca derruba o fluxo
        logger.error("Erro ao montar/enviar e-mail de meta",
                     extra={"error": str(exc)})
