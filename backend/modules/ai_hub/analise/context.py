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


def listar_meses_com_dados(empresa_id) -> list[dict]:
    """
    Meses que têm lançamentos (por pagamento ou vencimento), do mais recente
    para o mais antigo. Alimenta os seletores da Análise — o usuário só escolhe
    períodos que existem no banco. Cada item: {mes, ano, label}.
    """
    from django.db.models.functions import TruncMonth
    from modules.financeiro.models import Lancamento

    qs = Lancamento.objects.filter(empresa_id=empresa_id)
    meses: set[tuple[int, int]] = set()
    for campo in ("data_pagamento", "data_vencimento"):
        datas = (
            qs.exclude(**{f"{campo}__isnull": True})
            .annotate(m=TruncMonth(campo))
            .values_list("m", flat=True)
            .distinct()
        )
        for d in datas:
            if d:
                meses.add((d.year, d.month))

    ordenados = sorted(meses, reverse=True)
    return [
        {"mes": m, "ano": a, "label": f"{MESES_PT[m]}/{a}"}
        for (a, m) in ordenados
    ]


def _tem_movimento(resumo: dict) -> bool:
    """Há movimento suficiente no período para analisar?"""
    return any([
        resumo["receita"], resumo["despesa"], resumo["a_receber"], resumo["atrasado_valor"],
    ])


def montar_contexto_financeiro(
    empresa_id,
    mes: int = None,
    ano: int = None,
    comparar_mes: int = None,
    comparar_ano: int = None,
) -> dict:
    """
    Monta o contexto financeiro real da empresa para DOIS períodos: o período
    principal (mes/ano) e um período de comparação.

    - Sem comparar_mes/comparar_ano → comparação é o mês anterior
      (comportamento retrocompatível).
    - Com comparar_mes/comparar_ano → compara com o período escolhido.

    `tem_dados` indica movimento no período principal; `tem_dados_comparacao`,
    no período de comparação. `comparativo` diz se a comparação foi explícita.
    """
    from modules.auth.models import Empresa

    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year

    comparativo = comparar_mes is not None and comparar_ano is not None
    if comparativo:
        pmes, pano = comparar_mes, comparar_ano
    else:
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

    return {
        "empresa": {"nome": nome, "segmento": segmento},
        "periodo": {
            "mes": mes,
            "ano": ano,
            "label": f"{MESES_PT[mes]}/{ano}",
            "label_anterior": f"{MESES_PT[pmes]}/{pano}",
        },
        "comparacao": {
            "mes": pmes,
            "ano": pano,
            "label": f"{MESES_PT[pmes]}/{pano}",
        },
        "atual": atual,
        "anterior": anterior,
        "deltas": deltas,
        "comparativo": comparativo,
        "tem_dados": _tem_movimento(atual),
        "tem_dados_comparacao": _tem_movimento(anterior),
    }
