"""
Synapse — AI Hub / Análise Financeira: montagem do contexto REAL.

Reaproveita FinanceiroService (resumo, DRE, métricas). NÃO recalcula do zero.
Retorna um dict com números do mês atual, do mês anterior e as variações —
tudo em float (JSON-safe), pronto para virar prompt e números-chave.
"""
from calendar import monthrange
from datetime import date

MESES_PT = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def _f(v) -> float:
    """Converte Decimal/None para float de forma segura."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _mes_anterior(mes: int, ano: int) -> tuple[int, int]:
    return (12, ano - 1) if mes == 1 else (mes - 1, ano)


def _resumo_mes(empresa_id, mes: int, ano: int) -> dict:
    """Resumo + DRE + métricas de um mês, tudo em float."""
    from modules.financeiro.services import FinanceiroService

    resumo = FinanceiroService.obter_resumo(empresa_id, mes, ano)
    dre = FinanceiroService.obter_dre(empresa_id, mes, ano)
    metr = FinanceiroService.obter_metricas_analise(empresa_id, mes, ano)

    top_despesas = [
        {"categoria": c["categoria"], "total": _f(c["total"])}
        for c in (dre.get("despesas_por_categoria") or [])[:3]
    ]

    return {
        "receita": _f(resumo.get("total_receitas")),
        "despesa": _f(resumo.get("total_despesas")),
        "saldo": _f(resumo.get("saldo")),
        "lucro": _f(dre.get("lucro_bruto")),
        "margem": _f(dre.get("margem")),
        "atrasado_valor": _f(metr.get("valor_atrasado")),
        "atrasado_qtd": int(metr.get("qtd_atrasados") or 0),
        "a_receber": _f(metr.get("contas_a_receber")),
        "ticket_medio": _f(metr.get("ticket_medio")),
        "qtd_recebimentos": int(metr.get("qtd_recebimentos") or 0),
        "top_despesas": top_despesas,
    }


def _variacao_pct(atual: float, anterior: float) -> float | None:
    """Variação percentual; None quando não há base de comparação."""
    if anterior == 0:
        return None
    return round((atual - anterior) / anterior * 100, 1)


def montar_contexto_financeiro(empresa_id, mes: int = None, ano: int = None) -> dict:
    """
    Monta o contexto financeiro real da empresa (mês atual + comparação com o
    anterior). `tem_dados` indica se há movimento suficiente para analisar.
    """
    from modules.auth.models import Empresa

    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year
    pmes, pano = _mes_anterior(mes, ano)

    try:
        empresa = Empresa.objects.get(pk=empresa_id)
        nome, segmento = empresa.nome, (empresa.segmento or "Não informado")
    except Empresa.DoesNotExist:
        nome, segmento = "Empresa", "Não informado"

    atual = _resumo_mes(empresa_id, mes, ano)
    anterior = _resumo_mes(empresa_id, pmes, pano)

    deltas = {
        "receita_pct": _variacao_pct(atual["receita"], anterior["receita"]),
        "despesa_pct": _variacao_pct(atual["despesa"], anterior["despesa"]),
        "saldo_abs": round(atual["saldo"] - anterior["saldo"], 2),
    }

    tem_dados = any([
        atual["receita"], atual["despesa"], atual["a_receber"], atual["atrasado_valor"],
    ])

    return {
        "empresa": {"nome": nome, "segmento": segmento},
        "periodo": {
            "mes": mes,
            "ano": ano,
            "label": f"{MESES_PT[mes]}/{ano}",
            "label_anterior": f"{MESES_PT[pmes]}/{pano}",
        },
        "atual": atual,
        "anterior": anterior,
        "deltas": deltas,
        "tem_dados": tem_dados,
    }
