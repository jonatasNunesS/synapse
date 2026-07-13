"""
Synapse — Recorrências: cálculo da próxima data esperada.

Dado o template e a última ocorrência (ou None, para a primeira), calcula a
próxima data esperada. Convenção semanal: 0=segunda … 6=domingo (Python).
"""
from calendar import monthrange
from datetime import date, timedelta

from .dias_uteis import proximo_dia_util


def _clamp_dia(ano: int, mes: int, dia: int) -> date:
    ultimo = monthrange(ano, mes)[1]
    return date(ano, mes, min(max(dia, 1), ultimo))


def _add_mes(ano: int, mes: int) -> tuple[int, int]:
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def _ajusta(rec, d: date) -> date:
    return proximo_dia_util(d) if rec.usa_dia_util else d


def proxima_data_esperada(rec, ultima_data: date | None, hoje: date) -> date:
    """
    Próxima data esperada da recorrência `rec`.
    - `ultima_data`: data_esperada da última ocorrência (None → primeira).
    - `hoje`: âncora para a primeira ocorrência.
    """
    freq = rec.frequencia_tipo

    if freq == "diario":
        base = hoje if ultima_data is None else ultima_data + timedelta(days=1)
        return _ajusta(rec, base)

    if freq == "semanal":
        alvo = rec.dia_referencia % 7  # 0=segunda … 6=domingo
        if ultima_data is None:
            delta = (alvo - hoje.weekday()) % 7
            base = hoje + timedelta(days=delta)
        else:
            base = ultima_data + timedelta(days=7)
        return _ajusta(rec, base)

    # mensal
    if ultima_data is None:
        cand = _clamp_dia(hoje.year, hoje.month, rec.dia_referencia)
        if _ajusta(rec, cand) < hoje:
            ano, mes = _add_mes(hoje.year, hoje.month)
            cand = _clamp_dia(ano, mes, rec.dia_referencia)
    else:
        ano, mes = _add_mes(ultima_data.year, ultima_data.month)
        cand = _clamp_dia(ano, mes, rec.dia_referencia)
    return _ajusta(rec, cand)
