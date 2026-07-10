"""
Synapse — Regressão dos deletes que "clicavam e nada acontecia".

Foca no que é verificável no servidor:
- Happy path: DELETE retorna 204 (lançamento, fornecedor, compra).
- Multi-tenant: empresa A não deleta dado de B → 404 (e o dado continua lá).
- Regressão da compra: a rota correta é aninhada
  (/fornecedores/{fornecedor}/compras/{compra}/); a rota "plana" que o
  frontend usava por engano (/fornecedores/compras/{compra}/) dá 404.
"""
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Lancamento
from modules.fornecedores.models import Fornecedor, CompraFornecedor


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="A", segmento="eventos", plano="pro")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="B", segmento="eventos", plano="pro")


@pytest.fixture
def user_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@a.com", nome="A", senha="Senha@12345", empresa=empresa_a, perfil="admin"
    )


@pytest.fixture
def user_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="b@b.com", nome="B", senha="Senha@12345", empresa=empresa_b, perfil="admin"
    )


def _cli(u):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(u).access_token)
    return c


def _lanc(emp):
    return Lancamento.objects.create(
        empresa=emp, tipo="despesa", descricao="x", valor=Decimal("10"),
        data_vencimento=date.today(), status="pendente",
    )


def _forn(emp, nome="F"):
    return Fornecedor.objects.create(empresa=emp, nome=nome)


def _compra(emp, forn):
    return CompraFornecedor.objects.create(
        empresa=emp, fornecedor=forn, valor=Decimal("50"), data_compra=date.today()
    )


# ── Happy path: 204 ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_delete_lancamento_204(user_a, empresa_a):
    l = _lanc(empresa_a)
    r = _cli(user_a).delete(f"/api/financeiro/lancamentos/{l.id}/")
    assert r.status_code == 204
    assert not Lancamento.objects.filter(id=l.id).exists()


@pytest.mark.django_db
def test_delete_fornecedor_204_soft_delete(user_a, empresa_a):
    """Fornecedor é soft delete: 204 e o registro fica inativo (ativo=False)."""
    f = _forn(empresa_a)
    r = _cli(user_a).delete(f"/api/fornecedores/{f.id}/")
    assert r.status_code == 204
    f.refresh_from_db()
    assert f.ativo is False


@pytest.mark.django_db
def test_delete_lancamento_pago_bloqueado_com_mensagem(user_a, empresa_a):
    """
    Deletar lançamento PAGO retorna erro COM mensagem real (não silêncio).
    Era exatamente o "clica e nada acontece": o front engolia esse retorno.
    """
    l = Lancamento.objects.create(
        empresa=empresa_a, tipo="receita", descricao="pago", valor=Decimal("100"),
        data_vencimento=date.today(), data_pagamento=date.today(), status="pago",
    )
    r = _cli(user_a).delete(f"/api/financeiro/lancamentos/{l.id}/")
    assert r.status_code == 404
    assert "imutáveis" in r.json()["error"]["message"]
    assert Lancamento.objects.filter(id=l.id).exists()  # não foi excluído


@pytest.mark.django_db
def test_delete_compra_204_rota_aninhada(user_a, empresa_a):
    f = _forn(empresa_a)
    c = _compra(empresa_a, f)
    r = _cli(user_a).delete(f"/api/fornecedores/{f.id}/compras/{c.id}/")
    assert r.status_code == 204
    assert not CompraFornecedor.objects.filter(id=c.id).exists()


# ── Regressão: a rota "plana" antiga (bug do frontend) NÃO existe ───────────

@pytest.mark.django_db
def test_delete_compra_rota_plana_antiga_404(user_a, empresa_a):
    """A URL que o frontend usava (sem o fornecedor_pk) não resolve → 404."""
    f = _forn(empresa_a)
    c = _compra(empresa_a, f)
    r = _cli(user_a).delete(f"/api/fornecedores/compras/{c.id}/")
    assert r.status_code == 404
    # A compra continua intacta (a rota nem chegou na view)
    assert CompraFornecedor.objects.filter(id=c.id).exists()


# ── Multi-tenant: A não deleta dado de B → 404 e o dado permanece ──────────

@pytest.mark.django_db
def test_lancamento_multitenant_404(user_a, empresa_b):
    l = _lanc(empresa_b)
    r = _cli(user_a).delete(f"/api/financeiro/lancamentos/{l.id}/")
    assert r.status_code == 404
    assert Lancamento.objects.filter(id=l.id).exists()


@pytest.mark.django_db
def test_fornecedor_multitenant_404(user_a, empresa_b):
    f = _forn(empresa_b)
    r = _cli(user_a).delete(f"/api/fornecedores/{f.id}/")
    assert r.status_code == 404
    assert Fornecedor.objects.filter(id=f.id).exists()


@pytest.mark.django_db
def test_compra_multitenant_404(user_a, empresa_b):
    f = _forn(empresa_b)
    c = _compra(empresa_b, f)
    r = _cli(user_a).delete(f"/api/fornecedores/{f.id}/compras/{c.id}/")
    assert r.status_code == 404
    assert CompraFornecedor.objects.filter(id=c.id).exists()
