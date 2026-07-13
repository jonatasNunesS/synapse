"""
Synapse — Recorrências: dias úteis e feriados nacionais (BR).

v1: apenas feriados NACIONAIS (fixos + móveis baseados na Páscoa). Sem
feriados municipais/estaduais. Cálculo da Páscoa por Anonymous Gregorian
(Meeus/Butcher), sem dependências externas.
"""
from datetime import date, timedelta
from functools import lru_cache


def _pascoa(ano: int) -> date:
    """Domingo de Páscoa (algoritmo de Meeus/Butcher)."""
    a = ano % 19
    b = ano // 100
    c = ano % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = ((h + l - 7 * m + 114) % 31) + 1
    return date(ano, mes, dia)


@lru_cache(maxsize=32)
def feriados_nacionais(ano: int) -> frozenset:
    """Conjunto de feriados nacionais brasileiros do ano (fixos + móveis)."""
    pascoa = _pascoa(ano)
    fixos = {
        date(ano, 1, 1),    # Confraternização Universal
        date(ano, 4, 21),   # Tiradentes
        date(ano, 5, 1),    # Dia do Trabalho
        date(ano, 9, 7),    # Independência
        date(ano, 10, 12),  # Nossa Senhora Aparecida
        date(ano, 11, 2),   # Finados
        date(ano, 11, 15),  # Proclamação da República
        date(ano, 12, 25),  # Natal
    }
    moveis = {
        pascoa - timedelta(days=48),  # Segunda de Carnaval
        pascoa - timedelta(days=47),  # Terça de Carnaval
        pascoa - timedelta(days=2),   # Sexta-feira Santa
        pascoa + timedelta(days=60),  # Corpus Christi
    }
    return frozenset(fixos | moveis)


def eh_dia_util(d: date) -> bool:
    """Dia útil = não é sábado/domingo nem feriado nacional."""
    if d.weekday() >= 5:  # 5=sábado, 6=domingo
        return False
    return d not in feriados_nacionais(d.year)


def proximo_dia_util(d: date) -> date:
    """Se `d` não for dia útil, empurra para o próximo dia útil."""
    atual = d
    while not eh_dia_util(atual):
        atual += timedelta(days=1)
    return atual
