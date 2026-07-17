"""
Synapse — Empréstimos no Financeiro.

Empréstimo é um TIPO de lançamento (não entidade separada). Direção define o
efeito no caixa: "emprestei" = dinheiro saiu (a receber); "peguei_emprestado"
= dinheiro entrou (a devolver). O saldo acumulado já reflete o efeito; a
quitação normal cria lançamento de retorno; perdão/cancelamento não retornam.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Lancamento
from modules.notificacoes.models import Notificacao


# ── Fixtures ─────────────────────────────────────────────────────────────────

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


def _cli(usuario):
    client = APIClient()
    client.cookies["access_token"] = str(RefreshToken.for_user(usuario).access_token)
    return client


def _amanha():
    return (date.today() + timedelta(days=1)).isoformat()


def _criar_receita_paga(empresa, valor):
    return Lancamento.objects.create(
        empresa=empresa, tipo="receita", descricao="Venda", valor=Decimal(valor),
        data_vencimento=date.today(), data_pagamento=date.today(), status="pago",
    )


PAYLOAD_EMPRESTEI = {
    "tipo": "emprestimo",
    "descricao": "Empréstimo pro João",
    "valor": "500.00",
    "direcao_emprestimo": "emprestei",
    "pessoa_emprestimo": "João da padaria",
    "data_retorno_esperado": None,  # preenchido nos testes
}


# ── Criação e validação ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCriarEmprestimo:

    def test_criar_emprestei(self, usuario_a):
        payload = {**PAYLOAD_EMPRESTEI, "data_retorno_esperado": _amanha()}
        r = _cli(usuario_a).post("/api/financeiro/lancamentos/", payload, format="json")
        assert r.status_code == 201
        data = r.data["data"]
        assert data["tipo"] == "emprestimo"
        assert data["direcao_emprestimo"] == "emprestei"
        assert data["pessoa_emprestimo"] == "João da padaria"
        assert data["status_emprestimo"] == "aberto"
        # vencimento espelha o retorno; caixa realizado
        assert data["data_vencimento"] == _amanha()
        assert data["status"] == "pago"

    def test_criar_peguei_emprestado(self, usuario_a):
        r = _cli(usuario_a).post("/api/financeiro/lancamentos/", {
            "tipo": "emprestimo", "descricao": "Peguei do João", "valor": "300.00",
            "direcao_emprestimo": "peguei_emprestado", "pessoa_emprestimo": "João",
            "data_retorno_esperado": _amanha(),
        }, format="json")
        assert r.status_code == 201
        assert r.data["data"]["direcao_emprestimo"] == "peguei_emprestado"

    def test_sem_direcao_400(self, usuario_a):
        payload = {**PAYLOAD_EMPRESTEI, "data_retorno_esperado": _amanha()}
        del payload["direcao_emprestimo"]
        r = _cli(usuario_a).post("/api/financeiro/lancamentos/", payload, format="json")
        assert r.status_code == 400
        assert "direcao_emprestimo" in str(r.data)

    def test_sem_pessoa_400(self, usuario_a):
        payload = {**PAYLOAD_EMPRESTEI, "data_retorno_esperado": _amanha()}
        del payload["pessoa_emprestimo"]
        r = _cli(usuario_a).post("/api/financeiro/lancamentos/", payload, format="json")
        assert r.status_code == 400
        assert "pessoa_emprestimo" in str(r.data)

    def test_sem_data_retorno_400(self, usuario_a):
        payload = {**PAYLOAD_EMPRESTEI, "data_retorno_esperado": None}
        r = _cli(usuario_a).post("/api/financeiro/lancamentos/", payload, format="json")
        assert r.status_code == 400
        assert "data_retorno_esperado" in str(r.data)

    def test_receita_ignora_campos_de_emprestimo(self, usuario_a):
        r = _cli(usuario_a).post("/api/financeiro/lancamentos/", {
            "tipo": "receita", "descricao": "Venda", "valor": "100.00",
            "data_vencimento": date.today().isoformat(),
            "direcao_emprestimo": "emprestei", "pessoa_emprestimo": "João",
            "data_retorno_esperado": _amanha(),
        }, format="json")
        assert r.status_code == 201
        data = r.data["data"]
        assert data["tipo"] == "receita"
        assert data["direcao_emprestimo"] is None
        assert data["pessoa_emprestimo"] is None
        assert data["data_retorno_esperado"] is None


# ── Impacto no saldo ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSaldoEmprestimos:

    def _criar_emprestimo(self, cli, direcao, valor):
        r = cli.post("/api/financeiro/lancamentos/", {
            "tipo": "emprestimo", "descricao": f"Emp {direcao}", "valor": valor,
            "direcao_emprestimo": direcao, "pessoa_emprestimo": "João",
            "data_retorno_esperado": _amanha(),
        }, format="json")
        assert r.status_code == 201
        return r.data["data"]["id"]

    def test_emprestar_diminui_saldo_e_quitar_devolve(self, usuario_a, empresa_a):
        """Exemplo da spec: emprestar R$ 500 → saldo −500; quitar → saldo volta."""
        _criar_receita_paga(empresa_a, "10000.00")
        cli = _cli(usuario_a)

        saldo0 = cli.get("/api/financeiro/saldo/").data["data"]["acumulado"]["saldo"]
        assert saldo0 == 10000.0

        emp_id = self._criar_emprestimo(cli, "emprestei", "500.00")
        d = cli.get("/api/financeiro/saldo/").data["data"]
        assert d["acumulado"]["saldo"] == 9500.0           # diminuiu 500
        assert d["emprestimos"]["a_receber"] == 500.0
        assert d["emprestimos"]["quantidade"] == 1

        # Quitar (recebeu) → cria receita de retorno → saldo volta a 10.000
        r = cli.post(f"/api/financeiro/lancamentos/{emp_id}/quitar-emprestimo/", {}, format="json")
        assert r.status_code == 200
        d2 = cli.get("/api/financeiro/saldo/").data["data"]
        assert d2["acumulado"]["saldo"] == 10000.0          # voltou
        assert d2["emprestimos"]["a_receber"] == 0
        assert d2["emprestimos"]["quantidade"] == 0

    def test_peguei_emprestado_aumenta_saldo(self, usuario_a, empresa_a):
        _criar_receita_paga(empresa_a, "1000.00")
        cli = _cli(usuario_a)
        self._criar_emprestimo(cli, "peguei_emprestado", "500.00")
        d = cli.get("/api/financeiro/saldo/").data["data"]
        assert d["acumulado"]["saldo"] == 1500.0            # aumentou 500
        assert d["emprestimos"]["a_devolver"] == 500.0

    def test_perdoar_nao_devolve_ao_saldo(self, usuario_a, empresa_a):
        _criar_receita_paga(empresa_a, "10000.00")
        cli = _cli(usuario_a)
        emp_id = self._criar_emprestimo(cli, "emprestei", "500.00")
        cli.post(f"/api/financeiro/lancamentos/{emp_id}/quitar-emprestimo/",
                 {"perdoar": True}, format="json")
        d = cli.get("/api/financeiro/saldo/").data["data"]
        assert d["acumulado"]["saldo"] == 9500.0            # permanece −500
        assert d["emprestimos"]["a_receber"] == 0           # não está mais aberto

    def test_saldo_sem_emprestimos_zera_campos(self, usuario_a, empresa_a):
        _criar_receita_paga(empresa_a, "5000.00")
        d = _cli(usuario_a).get("/api/financeiro/saldo/").data["data"]
        assert d["emprestimos"] == {"a_receber": 0, "a_devolver": 0, "quantidade": 0}


# ── Quitar / Adiar ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestQuitarAdiar:

    @pytest.fixture
    def emprestimo(self, db, empresa_a, usuario_a):
        return Lancamento.objects.create(
            empresa=empresa_a, tipo="emprestimo", descricao="Emp", valor=Decimal("500"),
            direcao_emprestimo="emprestei", pessoa_emprestimo="João",
            data_retorno_esperado=date.today(), data_vencimento=date.today(),
            status="pago", data_pagamento=date.today(), criado_por=usuario_a,
        )

    def test_quitar_marca_quitado(self, usuario_a, emprestimo):
        r = _cli(usuario_a).post(
            f"/api/financeiro/lancamentos/{emprestimo.id}/quitar-emprestimo/", {}, format="json"
        )
        assert r.status_code == 200
        emprestimo.refresh_from_db()
        assert emprestimo.emprestimo_quitado is True
        assert emprestimo.data_quitacao == date.today()
        assert emprestimo.emprestimo_perdoado is False
        # criou o lançamento de retorno (receita)
        assert Lancamento.objects.filter(
            empresa=emprestimo.empresa, tipo="receita",
            observacoes__contains=str(emprestimo.id),
        ).exists()

    def test_quitar_ja_quitado_400(self, usuario_a, emprestimo):
        cli = _cli(usuario_a)
        cli.post(f"/api/financeiro/lancamentos/{emprestimo.id}/quitar-emprestimo/", {}, format="json")
        r = cli.post(f"/api/financeiro/lancamentos/{emprestimo.id}/quitar-emprestimo/", {}, format="json")
        assert r.status_code == 400

    def test_adiar_atualiza_data(self, usuario_a, emprestimo):
        r = _cli(usuario_a).post(
            f"/api/financeiro/lancamentos/{emprestimo.id}/adiar-emprestimo/",
            {"dias": 7}, format="json"
        )
        assert r.status_code == 200
        emprestimo.refresh_from_db()
        assert emprestimo.data_retorno_esperado == date.today() + timedelta(days=7)

    def test_adiar_zero_dias_400(self, usuario_a, emprestimo):
        r = _cli(usuario_a).post(
            f"/api/financeiro/lancamentos/{emprestimo.id}/adiar-emprestimo/",
            {"dias": 0}, format="json"
        )
        assert r.status_code == 400

    def test_quitar_nao_emprestimo_400(self, usuario_a, empresa_a):
        receita = _criar_receita_paga(empresa_a, "100")
        r = _cli(usuario_a).post(
            f"/api/financeiro/lancamentos/{receita.id}/quitar-emprestimo/", {}, format="json"
        )
        assert r.status_code == 400


# ── Lista e resumo ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestListaResumo:

    def _emp(self, empresa, usuario, direcao="emprestei", valor="500", quitado=False, retorno=None):
        return Lancamento.objects.create(
            empresa=empresa, tipo="emprestimo", descricao="Emp", valor=Decimal(valor),
            direcao_emprestimo=direcao, pessoa_emprestimo="João",
            data_retorno_esperado=retorno or date.today(),
            data_vencimento=retorno or date.today(),
            status="pago", data_pagamento=date.today(),
            emprestimo_quitado=quitado, criado_por=usuario,
        )

    def test_listar_todos(self, usuario_a, empresa_a):
        self._emp(empresa_a, usuario_a)
        self._emp(empresa_a, usuario_a, quitado=True)
        r = _cli(usuario_a).get("/api/financeiro/emprestimos/")
        assert r.status_code == 200
        assert len(r.data["data"]) == 2

    def test_filtro_aberto(self, usuario_a, empresa_a):
        self._emp(empresa_a, usuario_a)
        self._emp(empresa_a, usuario_a, quitado=True)
        r = _cli(usuario_a).get("/api/financeiro/emprestimos/?filtro=aberto")
        assert len(r.data["data"]) == 1
        assert r.data["data"][0]["emprestimo_quitado"] is False

    def test_filtro_atrasado(self, usuario_a, empresa_a):
        ontem = date.today() - timedelta(days=1)
        self._emp(empresa_a, usuario_a, retorno=ontem)          # atrasado
        self._emp(empresa_a, usuario_a, retorno=date.today() + timedelta(days=5))
        r = _cli(usuario_a).get("/api/financeiro/emprestimos/?filtro=atrasado")
        assert len(r.data["data"]) == 1
        assert r.data["data"][0]["status_emprestimo"] == "atrasado"

    def test_resumo(self, usuario_a, empresa_a):
        self._emp(empresa_a, usuario_a, direcao="emprestei", valor="500")
        self._emp(empresa_a, usuario_a, direcao="peguei_emprestado", valor="300")
        self._emp(empresa_a, usuario_a, direcao="emprestei", valor="200", quitado=True)
        r = _cli(usuario_a).get("/api/financeiro/emprestimos/resumo/")
        assert r.status_code == 200
        d = r.data["data"]
        assert Decimal(d["a_receber"]) == Decimal("500.00")   # só o aberto
        assert Decimal(d["a_devolver"]) == Decimal("300.00")
        assert d["quantidade"] == 2


# ── Multi-tenant ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMultiTenant:

    def test_empresa_b_nao_ve_emprestimo_de_a(self, usuario_a, usuario_b, empresa_a):
        Lancamento.objects.create(
            empresa=empresa_a, tipo="emprestimo", descricao="Emp", valor=Decimal("500"),
            direcao_emprestimo="emprestei", pessoa_emprestimo="João",
            data_retorno_esperado=date.today(), data_vencimento=date.today(),
            status="pago", data_pagamento=date.today(),
        )
        r = _cli(usuario_b).get("/api/financeiro/emprestimos/")
        assert r.status_code == 200
        assert r.data["data"] == []

    def test_empresa_b_nao_quita_emprestimo_de_a(self, usuario_a, usuario_b, empresa_a):
        emp = Lancamento.objects.create(
            empresa=empresa_a, tipo="emprestimo", descricao="Emp", valor=Decimal("500"),
            direcao_emprestimo="emprestei", pessoa_emprestimo="João",
            data_retorno_esperado=date.today(), data_vencimento=date.today(),
            status="pago", data_pagamento=date.today(),
        )
        r = _cli(usuario_b).post(
            f"/api/financeiro/lancamentos/{emp.id}/quitar-emprestimo/", {}, format="json"
        )
        assert r.status_code in (400, 404)
        emp.refresh_from_db()
        assert emp.emprestimo_quitado is False


# ── Task de notificação ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskNotificacao:

    def _emp_vencido(self, empresa, usuario, direcao="emprestei"):
        return Lancamento.objects.create(
            empresa=empresa, tipo="emprestimo", descricao="Emp", valor=Decimal("500"),
            direcao_emprestimo=direcao, pessoa_emprestimo="João",
            data_retorno_esperado=date.today(), data_vencimento=date.today(),
            status="pago", data_pagamento=date.today(), criado_por=usuario,
        )

    def test_task_cria_notificacao(self, usuario_a, empresa_a):
        from modules.financeiro.tasks import verificar_emprestimos
        self._emp_vencido(empresa_a, usuario_a, "emprestei")
        verificar_emprestimos()
        notifs = Notificacao.objects.filter(usuario=usuario_a, tipo="financeiro")
        assert notifs.count() == 1
        assert "devolver" in notifs.first().mensagem.lower()

    def test_task_idempotente(self, usuario_a, empresa_a):
        from modules.financeiro.tasks import verificar_emprestimos
        self._emp_vencido(empresa_a, usuario_a)
        verificar_emprestimos()
        verificar_emprestimos()  # segunda rodada não duplica
        assert Notificacao.objects.filter(usuario=usuario_a).count() == 1

    def test_task_nao_notifica_futuro(self, usuario_a, empresa_a):
        from modules.financeiro.tasks import verificar_emprestimos
        Lancamento.objects.create(
            empresa=empresa_a, tipo="emprestimo", descricao="Emp", valor=Decimal("500"),
            direcao_emprestimo="emprestei", pessoa_emprestimo="João",
            data_retorno_esperado=date.today() + timedelta(days=10),
            data_vencimento=date.today() + timedelta(days=10),
            status="pago", data_pagamento=date.today(), criado_por=usuario_a,
        )
        verificar_emprestimos()
        assert Notificacao.objects.filter(usuario=usuario_a).count() == 0

    def test_task_peguei_mensagem(self, usuario_a, empresa_a):
        from modules.financeiro.tasks import verificar_emprestimos
        self._emp_vencido(empresa_a, usuario_a, "peguei_emprestado")
        verificar_emprestimos()
        n = Notificacao.objects.get(usuario=usuario_a)
        assert "você ficou de devolver" in n.mensagem.lower()
