"""
Synapse — AI Hub / Análise Financeira: prompts.

O system prompt é rígido de propósito: é dinheiro. Os números-chave NÃO são
pedidos à IA (nós já os temos, exatos) — a IA só produz diagnóstico +
recomendações a partir dos números reais fornecidos.
"""
import json

SYSTEM_PROMPT_FINANCEIRO = (
    "Você é um consultor financeiro para pequenos negócios brasileiros. "
    "Analise APENAS os números fornecidos no contexto — nunca invente números "
    "que não estão lá. Cite os valores reais em reais (R$). "
    "Projeções, se fizer alguma, devem ser marcadas explicitamente como "
    "estimativa — nunca como garantia; não prometa resultados. "
    "Se faltar dado para uma conclusão, diga que falta em vez de supor. "
    "Escreva em português claro, tom de consultor direto, sem jargão.\n\n"
    "Responda ESTRITAMENTE em JSON válido, sem texto fora do JSON, no formato:\n"
    '{\n'
    '  "diagnostico": "2 a 4 frases analisando a saúde financeira do mês '
    'com base nos números reais.",\n'
    '  "recomendacoes": ["1 a 3 recomendações concretas e acionáveis, '
    'específicas para estes números — não conselhos genéricos."]\n'
    "}"
)


def _fmt(v) -> str:
    """Formata número como moeda brasileira simples (R$ 1.234,56)."""
    try:
        return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "R$ 0,00"


def montar_prompt_usuario(ctx: dict) -> str:
    """Monta o prompt do usuário com os números reais do contexto."""
    a = ctx["atual"]
    ant = ctx["anterior"]
    d = ctx["deltas"]
    per = ctx["periodo"]

    def pct(v):
        return f"{v:+.1f}%" if v is not None else "sem base de comparação"

    top = a.get("top_despesas") or []
    top_txt = (
        "; ".join(f"{c['categoria']}: {_fmt(c['total'])}" for c in top)
        if top else "sem despesas categorizadas"
    )

    return (
        f"Empresa: {ctx['empresa']['nome']} (segmento: {ctx['empresa']['segmento']}).\n"
        f"Período analisado: {per['label']} (comparado a {per['label_anterior']}).\n\n"
        f"NÚMEROS REAIS DO MÊS ({per['label']}):\n"
        f"- Receita recebida: {_fmt(a['receita'])} ({pct(d['receita_pct'])} vs mês anterior)\n"
        f"- Despesa paga: {_fmt(a['despesa'])} ({pct(d['despesa_pct'])} vs mês anterior)\n"
        f"- Saldo do mês: {_fmt(a['saldo'])} (variação de {_fmt(d['saldo_abs'])} vs mês anterior)\n"
        f"- Lucro bruto: {_fmt(a['lucro'])} | Margem: {a['margem']:.1f}%\n"
        f"- Pagamentos atrasados: {a['atrasado_qtd']} conta(s), totalizando {_fmt(a['atrasado_valor'])}\n"
        f"- Contas a receber (pendentes): {_fmt(a['a_receber'])}\n"
        f"- Ticket médio dos recebimentos: {_fmt(a['ticket_medio'])} "
        f"({a['qtd_recebimentos']} recebimento(s) no mês)\n"
        f"- Maiores custos por categoria: {top_txt}\n\n"
        f"MÊS ANTERIOR ({per['label_anterior']}): receita {_fmt(ant['receita'])}, "
        f"despesa {_fmt(ant['despesa'])}, saldo {_fmt(ant['saldo'])}.\n\n"
        f"Faça o diagnóstico financeiro e as recomendações no formato JSON pedido."
    )


def parse_resposta(texto: str) -> dict:
    """
    Extrai {diagnostico, recomendacoes} da resposta da IA. Tolera cercas de
    código e texto ao redor do JSON. Fallback: usa o texto todo como
    diagnóstico e recomendações vazias (nunca quebra o fluxo).
    """
    if not texto:
        return {"diagnostico": "", "recomendacoes": []}

    bruto = texto.strip()
    # Remove cercas ```json ... ```
    if bruto.startswith("```"):
        bruto = bruto.strip("`")
        if bruto.lower().startswith("json"):
            bruto = bruto[4:]
    # Isola o primeiro objeto JSON
    ini, fim = bruto.find("{"), bruto.rfind("}")
    if ini != -1 and fim != -1 and fim > ini:
        try:
            obj = json.loads(bruto[ini : fim + 1])
            diag = str(obj.get("diagnostico", "")).strip()
            recs = obj.get("recomendacoes", [])
            if isinstance(recs, str):
                recs = [recs]
            recs = [str(r).strip() for r in recs if str(r).strip()][:3]
            if diag or recs:
                return {"diagnostico": diag, "recomendacoes": recs}
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    return {"diagnostico": texto.strip(), "recomendacoes": []}
