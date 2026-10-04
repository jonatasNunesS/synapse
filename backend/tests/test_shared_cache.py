"""
Synapse — Invalidação de cache (CODE_HEALTH_AUDIT, ERR-02 e ESC-04).

O defeito que estes testes existem para não deixar voltar: o fallback montava
o padrão de chave À MÃO, sem o `KEY_PREFIX` que o django-redis aplica. A chave
real é `synapse:1:synapse:{empresa}:{modulo}:...` e o padrão procurava
`synapse:{empresa}:{modulo}:*` — não casava com nada. Resultado: invalidava
ZERO chaves, não logava (o log estava dentro de um `if keys:`) e retornava
como se tivesse funcionado. O sistema seguia servindo dado velho.

A suíte roda em LocMemCache, então o caminho 1 (`delete_pattern`) não existe e
o código cai no fallback — que é justamente o que precisa de teste.
"""
import logging
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from shared.cache import (
    _e_cache_local,
    build_cache_key,
    get_cached,
    invalidate_cache,
    set_cached,
)


@pytest.fixture(autouse=True)
def cache_limpo():
    cache.clear()
    yield
    cache.clear()


# ═══════════════════════════════════════════════════════════════════════════
# O padrão precisa casar com a chave REAL
# ═══════════════════════════════════════════════════════════════════════════

def test_make_key_prefixa_a_chave(settings):
    """
    O fato que o defeito ignorava: a chave guardada não é a chave lógica.

    Se este teste falhar, é porque a configuração de cache mudou — e o resto
    desta suíte precisa ser relido antes de confiar nela.
    """
    logica = "synapse:7:financeiro:resumo"

    real = cache.make_key(logica)

    assert real != logica, "sem prefixo, o bug do ERR-02 não existiria"
    assert real.endswith(logica)


def test_fallback_usa_o_padrao_prefixado():
    """
    O coração da correção: o padrão que vai ao Redis passa por `make_key`.

    Com o padrão cru (o defeito), `scan_iter` receberia
    `synapse:7:financeiro:*` e não casaria com a chave real.
    """
    conn = MagicMock()
    conn.scan_iter.return_value = iter([])

    with patch("django_redis.get_redis_connection", return_value=conn):
        invalidate_cache(7, "financeiro")

    assert conn.scan_iter.called, "o fallback não chegou ao Redis"
    padrao_usado = conn.scan_iter.call_args.kwargs["match"]
    assert padrao_usado == cache.make_key("synapse:7:financeiro:*")


def test_fallback_apaga_as_chaves_que_encontra():
    conn = MagicMock()
    chaves = [
        cache.make_key("synapse:7:financeiro:resumo"),
        cache.make_key("synapse:7:financeiro:lista:abc123"),
    ]
    conn.scan_iter.return_value = iter(chaves)

    with patch("django_redis.get_redis_connection", return_value=conn):
        invalidate_cache(7, "financeiro")

    assert conn.delete.call_count == 2


# ═══════════════════════════════════════════════════════════════════════════
# ESC-04: scan_iter, não keys
# ═══════════════════════════════════════════════════════════════════════════

def test_nao_usa_o_comando_keys():
    """
    `KEYS` é O(N) sobre o keyspace inteiro e BLOQUEIA o Redis, que é
    single-threaded. Com muitas empresas, toda escrita pagaria a varredura.
    """
    conn = MagicMock()
    conn.scan_iter.return_value = iter([])

    with patch("django_redis.get_redis_connection", return_value=conn):
        invalidate_cache(7, "financeiro")

    assert not conn.keys.called, "voltou a usar KEYS, que bloqueia o Redis"
    assert conn.scan_iter.called


# ═══════════════════════════════════════════════════════════════════════════
# Zero chaves deixa de ser silêncio
# ═══════════════════════════════════════════════════════════════════════════

def test_zero_chaves_e_logado(caplog):
    """
    Antes, nada era logado quando o padrão não casava — o caso de falha era
    indistinguível do de sucesso. É o que fazia o defeito ser invisível.
    """
    conn = MagicMock()
    conn.scan_iter.return_value = iter([])

    with caplog.at_level(logging.INFO, logger="synapse"):
        with patch("django_redis.get_redis_connection", return_value=conn):
            invalidate_cache(7, "financeiro")

    assert any(
        "nenhuma chave" in r.message.lower() for r in caplog.records
    ), "zero chaves passou calado"


# ═══════════════════════════════════════════════════════════════════════════
# O cache.clear() global não pode acontecer em produção
# ═══════════════════════════════════════════════════════════════════════════

def test_em_cache_local_o_clear_final_e_aceitavel():
    """LocMemCache de teste: limpar tudo não tem custo cross-tenant."""
    assert _e_cache_local() is True

    set_cached(build_cache_key(7, "financeiro", "resumo"), {"total": 1}, 60)

    # Sem django_redis disponível, cai no último fallback e não levanta.
    with patch("django_redis.get_redis_connection", side_effect=RuntimeError("sem redis")):
        invalidate_cache(7, "financeiro")

    assert get_cached(build_cache_key(7, "financeiro", "resumo")) is None


def test_em_producao_o_clear_global_e_recusado():
    """
    `cache.clear()` apaga o cache de TODAS as empresas. Em produção, a escrita
    de uma empresa derrubando o cache das outras é raio de alcance
    cross-tenant vindo de um fallback. Melhor o erro subir.
    """
    with patch("shared.cache._e_cache_local", return_value=False):
        with patch(
            "django_redis.get_redis_connection", side_effect=RuntimeError("sem redis")
        ):
            with patch.object(cache, "clear") as clear_mock:
                with pytest.raises(RuntimeError, match="invalidar o cache"):
                    invalidate_cache(7, "financeiro")

    assert not clear_mock.called, "apagou o cache de todas as empresas"


# ═══════════════════════════════════════════════════════════════════════════
# O caminho preferido continua sendo o primeiro
# ═══════════════════════════════════════════════════════════════════════════

def test_delete_pattern_quando_existe_vence():
    """
    `delete_pattern` do django-redis já aplica o prefixo e usa SCAN por
    dentro — quando existe, nem se chega ao fallback.
    """
    with patch.object(cache, "delete_pattern", create=True) as dp:
        with patch("django_redis.get_redis_connection") as conn_factory:
            invalidate_cache(7, "financeiro")

    dp.assert_called_once_with("synapse:7:financeiro:*")
    assert not conn_factory.called


def test_invalidar_um_modulo_nao_mexe_no_outro():
    """O recorte por módulo e empresa continua valendo depois da correção."""
    k_fin = build_cache_key(7, "financeiro", "resumo")
    k_est = build_cache_key(7, "estoque", "resumo")
    k_outra = build_cache_key(99, "financeiro", "resumo")
    for k in (k_fin, k_est, k_outra):
        set_cached(k, {"v": 1}, 60)

    conn = MagicMock()
    conn.scan_iter.return_value = iter([cache.make_key(k_fin)])
    with patch("django_redis.get_redis_connection", return_value=conn):
        invalidate_cache(7, "financeiro")

    # O scan só recebeu o padrão do módulo/empresa pedidos.
    padrao = conn.scan_iter.call_args.kwargs["match"]
    assert padrao == cache.make_key("synapse:7:financeiro:*")
    assert "estoque" not in padrao
    assert ":99:" not in padrao
