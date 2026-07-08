"""
Synapse — AI Hub: Testes do Chat Financeiro.

Cobre: pergunta válida → resposta com números; pergunta fora de escopo →
recusa educada (a IA recebe a regra); sem créditos → 402 antes do Groq;
falha na IA → crédito devolvido; multi-tenant (contexto de A ≠ B); histórico
> 5 mensagens truncado.
"""
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Lancamento
from modules.ai_hub.creditos import CreditosService
from modules.ai_hub.chat.prompts import SYSTEM_PROMPT_CHAT, montar_prompt_pergunta
from modules.ai_hub.chat.service import ChatFinanceiroService, MAX_HISTORICO
from modules.ai_hub.analise.context import montar_contexto_financeiro
from modules.ai_hub.models import TaskIA


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Loja A", segmento="varejo", plano="pro")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Loja B", segmento="varejo", plano="pro")


@pytest.fixture
def user_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@loja.com", nome="Admin A", senha="Senha@12345", empresa=empresa_a, perfil="admin"
    )


@pytest.fixture
def user_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="b@loja.com", nome="Admin B", senha="Senha@12345", empresa=empresa_b, perfil="admin"
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def _lanc(empresa, tipo, valor, *, status="pago"):
    hoje = date.today()
    return Lancamento.objects.create(
        empresa=empresa,
        tipo=tipo,
        descricao=f"{tipo} {valor}",
        valor=Decimal(str(valor)),
        data_vencimento=hoje,
        data_pagamento=hoje if status == "pago" else None,
        status=status,
    )


URL = "/api/ai/chat-financeiro/pergunta/"


# Fake Groq que ecoa a pergunta e prova que os números do contexto chegaram
# no prompt (resposta determinística, sem rede).
class _GroqComNumeros:
    MODELOS = {"simples": "m", "avancado": "llama-3.3-70b-versatile"}

    def gerar(self, prompt="", sistema="", **kw):
        # O consultor "responde" citando a receita que veio no contexto.
        assert "PERÍODO PRINCIPAL" in prompt
        return "Seu saldo caiu porque a despesa subiu. Receita recebida: R$ 10.000,00."


class _GroqRecusa:
    MODELOS = {"simples": "m", "avancado": "llama-3.3-70b-versatile"}

    def gerar(self, prompt="", sistema="", **kw):
        # Com a regra de escopo no system prompt, o 70B recusa fora do tema.
        assert "Só posso te ajudar com o financeiro do seu negócio." in sistema
        return "Só posso te ajudar com o financeiro do seu negócio."


class _GroqFalha:
    MODELOS = {"simples": "m", "avancado": "m"}

    def gerar(self, **kw):
        raise RuntimeError("Groq indisponível")


def _resultado_via_polling(client, resp):
    """Resolve o task_id retornado até concluir (Celery eager já rodou)."""
    data = resp.json()["data"]
    task_id = data["task_id"]
    status_resp = client.get(f"/api/ai/status/{task_id}/")
    return status_resp.json()["data"]


# ── System prompt: regras rígidas presentes ─────────────────────────────────

@pytest.mark.django_db
def test_system_prompt_tem_regras_rigidas():
    assert "APENAS perguntas sobre o financeiro" in SYSTEM_PROMPT_CHAT
    assert "NUNCA invente valores" in SYSTEM_PROMPT_CHAT
    assert "Só posso te ajudar com o financeiro do seu negócio." in SYSTEM_PROMPT_CHAT
    assert "máximo 3 parágrafos" in SYSTEM_PROMPT_CHAT
    assert "estimativa" in SYSTEM_PROMPT_CHAT


# ── Pergunta válida → resposta com números ──────────────────────────────────

@pytest.mark.django_db
def test_pergunta_valida_responde_com_numeros(user_a, empresa_a):
    _lanc(empresa_a, "receita", 10000)
    _lanc(empresa_a, "despesa", 7000)
    client = _client(user_a)

    with patch("infrastructure.ia.groq_client.GroqClient", _GroqComNumeros):
        resp = client.post(URL, {"pergunta": "Por que meu saldo caiu?"}, format="json")

    assert resp.status_code == 202
    task = _resultado_via_polling(client, resp)
    assert task["status"] == "concluido"
    assert "R$ 10.000,00" in task["resultado"]
    # Custou 2 créditos (chat_financeiro) e o sucesso os manteve
    assert CreditosService.saldo(empresa_a.id)["usado"] == 2


# ── Pergunta fora de escopo → recusa educada ────────────────────────────────

@pytest.mark.django_db
def test_pergunta_fora_de_escopo_recusa(user_a, empresa_a):
    _lanc(empresa_a, "receita", 5000)
    client = _client(user_a)

    with patch("infrastructure.ia.groq_client.GroqClient", _GroqRecusa):
        resp = client.post(URL, {"pergunta": "Qual a capital do Peru?"}, format="json")

    assert resp.status_code == 202
    task = _resultado_via_polling(client, resp)
    assert task["status"] == "concluido"
    assert task["resultado"] == "Só posso te ajudar com o financeiro do seu negócio."


# ── Sem créditos → 402 ANTES de chamar o Groq ───────────────────────────────

@pytest.mark.django_db
def test_sem_creditos_402_antes_do_groq(empresa_a, user_a):
    _lanc(empresa_a, "receita", 5000)
    # Zera o saldo do plano pro (15) antes da pergunta.
    for _ in range(15):
        CreditosService.reservar(empresa_a.id, "conteudo")
    client = _client(user_a)

    # Se chegasse a instanciar o Groq, o teste quebraria (não deve chegar lá).
    with patch("infrastructure.ia.groq_client.GroqClient", _GroqFalha):
        resp = client.post(URL, {"pergunta": "Como está meu caixa?"}, format="json")

    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "SEM_CREDITOS"


# ── Falha na IA → crédito devolvido ─────────────────────────────────────────

@pytest.mark.django_db
def test_falha_ia_devolve_credito(empresa_a, user_a):
    _lanc(empresa_a, "receita", 5000)
    client = _client(user_a)

    with patch("infrastructure.ia.groq_client.GroqClient", _GroqFalha):
        resp = client.post(URL, {"pergunta": "Como está meu caixa?"}, format="json")

    assert resp.status_code == 202
    task = _resultado_via_polling(client, resp)
    assert task["status"] == "erro"
    # 2 créditos reservados foram devolvidos (sem sucesso, sem cobrança)
    assert CreditosService.saldo(empresa_a.id)["usado"] == 0


# ── Multi-tenant: B não recebe contexto de A ────────────────────────────────

@pytest.mark.django_db
def test_multitenant_contexto_nao_mistura(empresa_a, empresa_b):
    _lanc(empresa_a, "receita", 99999)
    _lanc(empresa_b, "receita", 1111)
    ctx_b = montar_contexto_financeiro(empresa_b.id)
    prompt_b = montar_prompt_pergunta(ctx_b, "Como está meu caixa?", [])
    assert "1.111,00" in prompt_b
    assert "99.999,00" not in prompt_b  # não vaza a receita de A


@pytest.mark.django_db
def test_multitenant_status_task_nao_vaza(user_a, user_b, empresa_a):
    _lanc(empresa_a, "receita", 5000)
    with patch("infrastructure.ia.groq_client.GroqClient", _GroqComNumeros):
        resp = _client(user_a).post(URL, {"pergunta": "Por que meu saldo caiu?"}, format="json")
    task_id = resp.json()["data"]["task_id"]
    # B não pode ler a task de A
    r = _client(user_b).get(f"/api/ai/status/{task_id}/")
    assert r.status_code == 404


# ── Histórico > 5 mensagens é truncado ──────────────────────────────────────

@pytest.mark.django_db
def test_historico_truncado_a_5_mensagens():
    historico = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg {i}"}
        for i in range(10)
    ]
    saneado = ChatFinanceiroService._sanear_historico(historico)
    assert len(saneado) == MAX_HISTORICO
    # Mantém as ÚLTIMAS mensagens (memória curta), não as primeiras
    assert saneado[0]["content"] == "msg 5"
    assert saneado[-1]["content"] == "msg 9"


@pytest.mark.django_db
def test_historico_descarta_mensagens_invalidas():
    historico = [
        {"role": "user", "content": "válida"},
        {"role": "system", "content": "role inválido"},
        {"role": "assistant", "content": "   "},  # vazia
        {"content": "sem role"},
        "não é dict",
    ]
    saneado = ChatFinanceiroService._sanear_historico(historico)
    assert saneado == [{"role": "user", "content": "válida"}]


# ── Validação de entrada ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_pergunta_vazia_400(user_a, empresa_a):
    _lanc(empresa_a, "receita", 5000)
    resp = _client(user_a).post(URL, {"pergunta": "   "}, format="json")
    assert resp.status_code == 400
    # Nada foi cobrado (rejeitado na validação, antes da reserva)
    assert CreditosService.saldo(empresa_a.id)["usado"] == 0


@pytest.mark.django_db
def test_nao_autenticado_401():
    assert APIClient().post(URL, {"pergunta": "oi"}, format="json").status_code == 401
