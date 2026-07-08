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
    "Você recebe DOIS períodos: um período principal e um período de comparação. "
    "Compare os dois períodos, aponte as diferenças significativas, identifique "
    "o que MELHOROU e o que PIOROU entre eles, sempre citando os valores em R$. "
    "Projeções, se fizer alguma, devem ser marcadas explicitamente como "
    "estimativa — nunca como garantia; não prometa resultados. "
    "Se faltar dado para uma conclusão, diga que falta em vez de supor. "
    "Escreva em português claro, tom de consultor direto, sem jargão.\n\n"
    "Responda ESTRITAMENTE em JSON válido, sem texto fora do JSON, no formato:\n"
    '{\n'
    '  "diagnostico": "2 a 4 frases comparando a saúde financeira dos dois '
    'períodos com base nos números reais — o que mudou, melhorou ou piorou.",\n'
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


def _bloco_periodo(titulo: str, label: str, r: dict) -> str:
    """
    Bloco com os números REAIS e específicos de um período (baseados nos
    pagamentos daquele mês: receita, despesa, saldo, lucro, ticket, custos).
    """
    top = r.get("top_despesas") or []
    top_txt = (
        "; ".join(f"{c['categoria']}: {_fmt(c['total'])}" for c in top)
        if top else "sem despesas categorizadas"
    )
    return (
        f"{titulo} — {label}:\n"
        f"- Receita recebida: {_fmt(r['receita'])}\n"
        f"- Despesa paga: {_fmt(r['despesa'])}\n"
        f"- Saldo do mês: {_fmt(r['saldo'])}\n"
        f"- Lucro bruto: {_fmt(r['lucro'])} | Margem: {r['margem']:.1f}%\n"
        f"- Ticket médio dos recebimentos: {_fmt(r['ticket_medio'])} "
        f"({r['qtd_recebimentos']} recebimento(s))\n"
        f"- Maiores custos por categoria: {top_txt}"
    )


def montar_bloco_numeros(ctx: dict) -> str:
    """
    Bloco de texto com os NÚMEROS REAIS dos DOIS períodos (principal +
    comparação) + as variações entre eles + a situação atual de atrasados/a
    receber (que é um retrato de hoje, não do período).

    Reutilizável: a Análise Financeira e o Chat Financeiro compartilham este
    mesmo contexto — não duplicam a montagem. Retrocompatível: quando não há
    comparação explícita, o período de comparação é o mês anterior.
    """
    a = ctx["atual"]
    ant = ctx["anterior"]
    d = ctx["deltas"]
    per = ctx["periodo"]
    label_princ = per["label"]
    label_comp = per["label_anterior"]

    def pct(v):
        return f"{v:+.1f}%" if v is not None else "sem base de comparação"

    return (
        f"Empresa: {ctx['empresa']['nome']} (segmento: {ctx['empresa']['segmento']}).\n"
        f"Comparação de dois períodos: {label_princ} (principal) × "
        f"{label_comp} (comparação).\n\n"
        f"{_bloco_periodo('PERÍODO PRINCIPAL', label_princ, a)}\n\n"
        f"{_bloco_periodo('PERÍODO DE COMPARAÇÃO', label_comp, ant)}\n\n"
        f"VARIAÇÕES (principal vs comparação):\n"
        f"- Receita: {pct(d['receita_pct'])}\n"
        f"- Despesa: {pct(d['despesa_pct'])}\n"
        f"- Saldo: variação de {_fmt(d['saldo_abs'])}\n\n"
        f"SITUAÇÃO ATUAL (retrato de hoje, não do período): "
        f"{a['atrasado_qtd']} pagamento(s) atrasado(s) totalizando "
        f"{_fmt(a['atrasado_valor'])}; contas a receber pendentes de "
        f"{_fmt(a['a_receber'])}."
    )


def montar_prompt_usuario(ctx: dict) -> str:
    """Monta o prompt do usuário com os números reais dos dois períodos."""
    return (
        f"{montar_bloco_numeros(ctx)}\n\n"
        f"Compare os dois períodos e faça o diagnóstico financeiro e as "
        f"recomendações no formato JSON pedido."
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
