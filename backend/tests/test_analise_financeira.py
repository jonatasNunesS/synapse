"""
Synapse — AI Hub 2.0: Testes da Análise Financeira.
Cobre: contexto com números certos, fluxo (mock Groq), multi-tenant,
sem dados → estado tratado, cache.
"""
import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Categoria, Lancamento
from modules.ai_hub.analise.context import montar_contexto_financeiro
from modules.ai_hub.analise.service import AnaliseFinanceiraService


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Impactar A", segmento="eventos", plano="pro")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Rival B", segmento="eventos", plano="pro")


@pytest.fixture
def user_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@imp.com", nome="Admin A", senha="Senha@12345", empresa=empresa_a, perfil="admin"
    )


@pytest.fixture
def user_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="b@riv.com", nome="Admin B", senha="Senha@12345", empresa=empresa_b, perfil="admin"
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def _lanc(empresa, tipo, valor, *, status="pago", venc=None, pgto=None, cat=None):
    hoje = date.today()
    return Lancamento.objects.create(
        empresa=empresa,
        tipo=tipo,
        descricao=f"{tipo} {valor}",
        valor=Decimal(str(valor)),
        categoria=cat,
        data_vencimento=venc or hoje,
        data_pagamento=pgto if pgto is not None else (hoje if status == "pago" else None),
        status=status,
    )


# Resposta simulada do Groq (JSON no formato do system prompt)
GROQ_JSON = json.dumps({
    "diagnostico": "A empresa fechou o mês com saldo positivo e margem saudável.",
    "recomendacoes": ["Renegociar os atrasados", "Reduzir o maior custo"],
}, ensure_ascii=False)


class _FakeGroq:
    MODELOS = {"simples": "llama-3.1-8b-instant", "avancado": "llama-3.3-70b-versatile"}

    def gerar(self, **kwargs):
        return GROQ_JSON


# ── Contexto: números certos do período ─────────────────────────────────────

@pytest.mark.django_db
def test_contexto_numeros_certos(empresa_a):
    cat = Categoria.objects.create(empresa=empresa_a, nome="Fornecedores", tipo="despesa")
    _lanc(empresa_a, "receita", 10000)
    _lanc(empresa_a, "receita", 5000)
    _lanc(empresa_a, "despesa", 3000, cat=cat)
    # Pendente atrasado
    _lanc(empresa_a, "despesa", 800, status="pendente", venc=date(2020, 1, 1))
    # Conta a receber (receita pendente)
    _lanc(empresa_a, "receita", 2000, status="pendente")

    ctx = montar_contexto_financeiro(empresa_a.id)
    a = ctx["atual"]
    assert a["receita"] == 15000.0
    assert a["despesa"] == 3000.0
    assert a["saldo"] == 12000.0
    assert a["atrasado_qtd"] == 1
    assert a["atrasado_valor"] == 800.0
    assert a["a_receber"] == 2000.0
    assert a["ticket_medio"] == 7500.0  # 15000 / 2 recebimentos
    assert ctx["tem_dados"] is True


# ── Fluxo completo (mock Groq) ──────────────────────────────────────────────

@pytest.mark.django_db
def test_fluxo_analise_solicitar_status_resultado(user_a, empresa_a):
    _lanc(empresa_a, "receita", 10000)
    _lanc(empresa_a, "despesa", 4000)
    client = _client(user_a)

    with patch("infrastructure.ia.groq_client.GroqClient", _FakeGroq):
        # Celery eager nos testes → a task roda durante o .delay()
        resp = client.post("/api/ai/analise-financeira/", {}, format="json")

    assert resp.status_code in (200, 202)
    data = resp.json()["data"]
    assert data["status"] in ("processando", "concluido")

    if data["status"] == "processando":
        status_resp = client.get(f"/api/ai/status/{data['task_id']}/")
        assert status_resp.status_code == 200
        task = status_resp.json()["data"]
        assert task["status"] == "concluido"
        analise = json.loads(task["resultado"])
    else:
        analise = data["analise"]

    assert "diagnostico" in analise and analise["diagnostico"]
    assert isinstance(analise["recomendacoes"], list) and len(analise["recomendacoes"]) >= 1
    # Números-chave computados por nós (não pela IA)
    labels = [n["label"] for n in analise["numeros_chave"]]
    assert "Receita" in labels and "Saldo do mês" in labels


# ── Sem dados → estado tratado (não erro) ───────────────────────────────────

@pytest.mark.django_db
def test_sem_dados_estado_tratado(user_a):
    resp = _client(user_a).post("/api/ai/analise-financeira/", {}, format="json")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "sem_dados"
    assert "message" in data


# ── Multi-tenant ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_multitenant_contexto_nao_mistura(empresa_a, empresa_b):
    _lanc(empresa_a, "receita", 9999)
    _lanc(empresa_b, "receita", 1111)
    ctx_b = montar_contexto_financeiro(empresa_b.id)
    assert ctx_b["atual"]["receita"] == 1111.0  # não soma a receita de A


@pytest.mark.django_db
def test_multitenant_status_task_nao_vaza(user_a, user_b, empresa_a):
    _lanc(empresa_a, "receita", 5000)
    with patch("infrastructure.ia.groq_client.GroqClient", _FakeGroq):
        resp = _client(user_a).post("/api/ai/analise-financeira/", {}, format="json")
    data = resp.json()["data"]
    if data.get("task_id"):
        # B não pode ler a task de A
        r = _client(user_b).get(f"/api/ai/status/{data['task_id']}/")
        assert r.status_code == 404


# ── Cache: 2ª solicitação não chama o Groq de novo ──────────────────────────

@pytest.mark.django_db
def test_cache_evita_segunda_chamada_groq(user_a, empresa_a):
    _lanc(empresa_a, "receita", 8000)
    _lanc(empresa_a, "despesa", 2000)
    client = _client(user_a)

    with patch("infrastructure.ia.groq_client.GroqClient") as mock_groq:
        mock_groq.return_value = _FakeGroq()
        client.post("/api/ai/analise-financeira/", {}, format="json")
        chamadas_1 = mock_groq.call_count
        assert chamadas_1 >= 1  # 1ª análise chamou o Groq
        # 2ª vez: deve vir do cache, sem instanciar o Groq
        resp2 = client.post("/api/ai/analise-financeira/", {}, format="json")

    assert resp2.status_code == 200
    data2 = resp2.json()["data"]
    assert data2["status"] == "concluido"
    assert "analise" in data2
    assert mock_groq.call_count == chamadas_1  # não chamou o Groq de novo


# ── Não autenticado → 401 ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_nao_autenticado_401():
    assert APIClient().post("/api/ai/analise-financeira/", {}, format="json").status_code == 401
