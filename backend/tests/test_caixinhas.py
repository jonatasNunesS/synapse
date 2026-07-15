"""
Synapse — Caixinhas (reservas financeiras).

Modelo Nubank: depósito tira do saldo disponível e vai pra caixinha;
retirada volta pro saldo. Saldo da caixinha NUNCA negativo (lock pessimista).
saldo_disponivel = saldo_acumulado − total_em_caixinhas.
"""
import threading

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.caixinhas.models import Caixinha, MovimentoCaixinha
from modules.financeiro.models import Lancamento


# ════════════════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════════════════

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Alpha", cnpj="11.111.111/0001-11", plano="pro")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Beta", cnpj="22.222.222/0001-22", plano="pro")


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="a@alpha.com", nome="Ana", senha="Alpha@123456", empresa=empresa_a
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="b@beta.com", nome="Bia", senha="Beta@123456", empresa=empresa_b
    )


@pytest.fixture
def caixinha_a(db, empresa_a, usuario_a):
    return Caixinha.objects.create(
        empresa=empresa_a,
        nome="Reserva de emergência",
        cor="#22c55e",
        icone="🎯",
        meta=Decimal("2000.00"),
        criado_por=usuario_a,
    )


def _cli(usuario):
    client = APIClient()
    client.cookies["access_token"] = str(RefreshToken.for_user(usuario).access_token)
    return client


# ════════════════════════════════════════════════════════════
# CRUD
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestCaixinhaCRUD:

    def test_criar_caixinha(self, usuario_a):
        r = _cli(usuario_a).post("/api/caixinhas/", {
            "nome": "13º salário", "cor": "#8b5cf6", "icone": "🎄",
            "meta": "1200.00",
        }, format="json")
        assert r.status_code == 201
        assert r.data["data"]["nome"] == "13º salário"
        assert Decimal(r.data["data"]["saldo"]) == Decimal("0")
        assert r.data["data"]["meta_atingida"] is False

    def test_criar_sem_meta(self, usuario_a):
        r = _cli(usuario_a).post("/api/caixinhas/", {"nome": "Livre"}, format="json")
        assert r.status_code == 201
        assert r.data["data"]["meta"] is None
        assert r.data["data"]["progresso"] is None

    def test_meta_zero_invalida(self, usuario_a):
        r = _cli(usuario_a).post("/api/caixinhas/", {
            "nome": "X", "meta": "0",
        }, format="json")
        assert r.status_code == 400

    def test_listar(self, usuario_a, caixinha_a):
        r = _cli(usuario_a).get("/api/caixinhas/")
        assert r.status_code == 200
        assert len(r.data["data"]) == 1

    def test_editar_nome_cor_meta(self, usuario_a, caixinha_a):
        r = _cli(usuario_a).patch(f"/api/caixinhas/{caixinha_a.id}/", {
            "nome": "Emergência 2.0", "meta": "3000.00",
        }, format="json")
        assert r.status_code == 200
        assert r.data["data"]["nome"] == "Emergência 2.0"

    def test_saldo_nao_editavel_via_patch(self, usuario_a, caixinha_a):
        """Saldo só muda via depósito/retirada — PATCH ignora o campo."""
        r = _cli(usuario_a).patch(f"/api/caixinhas/{caixinha_a.id}/", {
            "saldo": "9999.00",
        }, format="json")
        assert r.status_code == 200
        caixinha_a.refresh_from_db()
        assert caixinha_a.saldo == Decimal("0")

    def test_excluir_caixinha_vazia(self, usuario_a, caixinha_a):
        r = _cli(usuario_a).delete(f"/api/caixinhas/{caixinha_a.id}/")
        assert r.status_code == 204
        assert not Caixinha.objects.filter(id=caixinha_a.id).exists()

    def test_excluir_com_saldo_400(self, usuario_a, caixinha_a):
        """Dinheiro não some: excluir com saldo > 0 é bloqueado."""
        Caixinha.objects.filter(pk=caixinha_a.pk).update(saldo=Decimal("100.00"))
        r = _cli(usuario_a).delete(f"/api/caixinhas/{caixinha_a.id}/")
        assert r.status_code == 400
        assert "Retire o saldo" in r.json()["error"]["message"]
        assert Caixinha.objects.filter(id=caixinha_a.id).exists()


# ════════════════════════════════════════════════════════════
# DEPÓSITO / RETIRADA
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestOperacoes:

    def test_deposito_sobe_saldo(self, usuario_a, caixinha_a):
        r = _cli(usuario_a).post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {
            "valor": "500.00", "descricao": "Reserva pro evento X",
        }, format="json")
        assert r.status_code == 201
        assert Decimal(r.data["data"]["caixinha"]["saldo"]) == Decimal("500.00")
        caixinha_a.refresh_from_db()
        assert caixinha_a.saldo == Decimal("500.00")

        mov = MovimentoCaixinha.objects.get()
        assert mov.tipo == "deposito"
        assert mov.valor == Decimal("500.00")
        assert mov.descricao == "Reserva pro evento X"

    def test_deposito_nao_cria_lancamento_financeiro(self, usuario_a, caixinha_a):
        """Transferência interna: NÃO vira receita nem despesa."""
        _cli(usuario_a).post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {
            "valor": "500.00",
        }, format="json")
        assert Lancamento.objects.count() == 0

    def test_retirada_desce_saldo(self, usuario_a, caixinha_a):
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "500.00"}, format="json")
        r = cli.post(f"/api/caixinhas/{caixinha_a.id}/retirar/", {"valor": "200.00"}, format="json")
        assert r.status_code == 201
        caixinha_a.refresh_from_db()
        assert caixinha_a.saldo == Decimal("300.00")

    def test_retirada_maior_que_saldo_400_com_saldo_informado(self, usuario_a, caixinha_a):
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "100.00"}, format="json")
        r = cli.post(f"/api/caixinhas/{caixinha_a.id}/retirar/", {"valor": "150.00"}, format="json")
        assert r.status_code == 400
        body = r.json()["error"]
        assert body["code"] == "SALDO_INSUFICIENTE"
        assert body["details"]["saldo_atual"] == "100.00"  # frontend oferece o máximo
        caixinha_a.refresh_from_db()
        assert caixinha_a.saldo == Decimal("100.00")  # intocado

    def test_valor_zero_ou_negativo_400(self, usuario_a, caixinha_a):
        cli = _cli(usuario_a)
        for valor in ["0", "-10"]:
            r = cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": valor}, format="json")
            assert r.status_code == 400

    def test_historico_de_movimentos(self, usuario_a, caixinha_a):
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "500.00"}, format="json")
        cli.post(f"/api/caixinhas/{caixinha_a.id}/retirar/", {"valor": "100.00"}, format="json")
        r = cli.get(f"/api/caixinhas/{caixinha_a.id}/movimentos/")
        assert r.status_code == 200
        movs = r.data["data"]
        assert len(movs) == 2
        assert movs[0]["tipo"] == "retirada"  # mais recente primeiro
        assert movs[1]["tipo"] == "deposito"


# ════════════════════════════════════════════════════════════
# META
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestMeta:

    def test_meta_atingida(self, usuario_a, caixinha_a):
        """saldo >= meta → meta_atingida=True e progresso 100%."""
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "2000.00"}, format="json")
        r = cli.get(f"/api/caixinhas/{caixinha_a.id}/")
        assert r.data["data"]["meta_atingida"] is True
        assert r.data["data"]["progresso"] == 100.0

    def test_progresso_parcial(self, usuario_a, caixinha_a):
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "500.00"}, format="json")
        r = cli.get(f"/api/caixinhas/{caixinha_a.id}/")
        assert r.data["data"]["meta_atingida"] is False
        assert r.data["data"]["progresso"] == 25.0  # 500/2000

    def test_progresso_acima_da_meta_capado_em_100(self, usuario_a, caixinha_a):
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "3000.00"}, format="json")
        r = cli.get(f"/api/caixinhas/{caixinha_a.id}/")
        assert r.data["data"]["progresso"] == 100.0


# ════════════════════════════════════════════════════════════
# MULTI-TENANT
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestMultiTenant:

    def test_empresa_b_nao_ve_caixinha_de_a(self, usuario_b, caixinha_a):
        r = _cli(usuario_b).get("/api/caixinhas/")
        assert r.status_code == 200
        assert r.data["data"] == []

    def test_empresa_b_nao_acessa_detalhe_de_a(self, usuario_b, caixinha_a):
        r = _cli(usuario_b).get(f"/api/caixinhas/{caixinha_a.id}/")
        assert r.status_code == 404

    def test_empresa_b_nao_deposita_em_caixinha_de_a(self, usuario_b, caixinha_a):
        r = _cli(usuario_b).post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {
            "valor": "100.00",
        }, format="json")
        assert r.status_code == 404
        caixinha_a.refresh_from_db()
        assert caixinha_a.saldo == Decimal("0")


# ════════════════════════════════════════════════════════════
# INTEGRAÇÃO COM O SALDO FINANCEIRO
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestIntegracaoSaldo:

    def _criar_receita_paga(self, empresa, valor):
        return Lancamento.objects.create(
            empresa=empresa, tipo="receita", descricao="Venda",
            valor=Decimal(valor), data_vencimento=date.today(),
            data_pagamento=date.today(), status="pago",
        )

    def test_saldo_retorna_caixinhas_e_disponivel(self, usuario_a, empresa_a, caixinha_a):
        """Exemplo da spec: acumulado 10.000, caixinha 2.000 → disponível 8.000."""
        self._criar_receita_paga(empresa_a, "10000.00")
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "2000.00"}, format="json")

        r = cli.get("/api/financeiro/saldo/")
        assert r.status_code == 200
        data = r.data["data"]
        assert data["acumulado"]["saldo"] == 10000.0
        assert data["caixinhas"]["total"] == 2000.0
        assert data["caixinhas"]["quantidade"] == 1
        assert data["saldo_disponivel"] == 8000.0
        assert data["patrimonio_total"] == 10000.0  # não muda

    def test_empresa_sem_caixinhas_retrocompativel(self, usuario_a, empresa_a):
        """Sem caixinhas: disponível = acumulado, caixinhas.total = 0."""
        self._criar_receita_paga(empresa_a, "5000.00")
        r = _cli(usuario_a).get("/api/financeiro/saldo/")
        data = r.data["data"]
        assert data["caixinhas"]["total"] == 0
        assert data["caixinhas"]["quantidade"] == 0
        assert data["saldo_disponivel"] == data["acumulado"]["saldo"] == 5000.0

    def test_retirada_devolve_ao_disponivel(self, usuario_a, empresa_a, caixinha_a):
        self._criar_receita_paga(empresa_a, "10000.00")
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "2000.00"}, format="json")
        cli.post(f"/api/caixinhas/{caixinha_a.id}/retirar/", {"valor": "500.00"}, format="json")

        r = cli.get("/api/financeiro/saldo/")
        data = r.data["data"]
        assert data["caixinhas"]["total"] == 1500.0
        assert data["saldo_disponivel"] == 8500.0

    def test_resumo_endpoint(self, usuario_a, caixinha_a):
        cli = _cli(usuario_a)
        cli.post(f"/api/caixinhas/{caixinha_a.id}/depositar/", {"valor": "300.00"}, format="json")
        r = cli.get("/api/caixinhas/resumo/")
        assert r.status_code == 200
        assert r.data["data"]["total"] == 300.0
        assert r.data["data"]["quantidade"] == 1


# ════════════════════════════════════════════════════════════
# RACE CONDITION
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db(transaction=True)
class TestRaceCondition:
    """
    Duas retiradas simultâneas de uma caixinha com saldo pra apenas uma:
    o select_for_update deve serializar — uma passa, a outra recebe
    SALDO_INSUFICIENTE. Saldo final nunca negativo.

    O teste com threads reais só roda em PostgreSQL: SQLite (usado no CI)
    trava a tabela inteira em vez de lock de linha, produzindo
    "database table is locked" em vez de serializar. Em SQLite, a guarda
    estrutural abaixo garante que o lock não seja removido do código.
    """

    def test_guarda_estrutural_lock_pessimista(self):
        """
        Falha se alguém remover o select_for_update/atomic do movimentar.
        Guarda barata para o invariante que o teste de threads (só PG) cobre.
        """
        import inspect
        from modules.caixinhas.repository import CaixinhaRepository

        fonte = inspect.getsource(CaixinhaRepository.movimentar)
        assert "select_for_update" in fonte, (
            "CaixinhaRepository.movimentar deve usar select_for_update "
            "(proteção contra race condition — ver docstring do módulo)."
        )
        # o decorator transaction.atomic precisa estar na função
        assert getattr(
            CaixinhaRepository.movimentar, "__wrapped__", None
        ) is not None or "atomic" in fonte, (
            "movimentar deve rodar dentro de transaction.atomic."
        )

    @pytest.mark.skipif(
        __import__("django.db", fromlist=["connection"]).connection.vendor
        == "sqlite",
        reason="SQLite trava a tabela inteira; lock de linha real só em PostgreSQL.",
    )
    def test_retiradas_concorrentes_sem_saldo_negativo(self, usuario_a, empresa_a):
        from modules.caixinhas.services import CaixinhaService
        from shared.exceptions import BusinessRuleViolation
        from django.db import connection

        caixinha = Caixinha.objects.create(
            empresa=empresa_a, nome="Corrida", criado_por=usuario_a,
            saldo=Decimal("100.00"),
        )

        resultados = []
        barreira = threading.Barrier(2)

        def retirar():
            barreira.wait()  # larga as duas juntas
            try:
                CaixinhaService.retirar(
                    empresa_a.id, caixinha.id, Decimal("100.00"), "", usuario_a.id
                )
                resultados.append("ok")
            except BusinessRuleViolation:
                resultados.append("bloqueado")
            finally:
                connection.close()

        t1 = threading.Thread(target=retirar)
        t2 = threading.Thread(target=retirar)
        t1.start(); t2.start()
        t1.join(timeout=10); t2.join(timeout=10)

        caixinha.refresh_from_db()
        assert caixinha.saldo >= Decimal("0")  # NUNCA negativo
        assert sorted(resultados) == ["bloqueado", "ok"]  # só uma passou
        assert caixinha.saldo == Decimal("0")
