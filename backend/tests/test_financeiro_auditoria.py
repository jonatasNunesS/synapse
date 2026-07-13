"""
Synapse — Editar/Excluir lançamentos PAGOS com auditoria.

DECISÃO DE PRODUTO (feedback do piloto): lançamentos pagos deixaram de ser
imutáveis. Admin da empresa pode editar/excluir com motivo obrigatório;
toda operação gera LogEdicaoLancamento com snapshot antes/depois.
Pendentes continuam livres (regra anterior mantida).
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Categoria, Lancamento, LogEdicaoLancamento
from shared.cache import build_cache_key, get_cached, set_cached


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
def admin_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="admin@alpha.com", nome="Patrícia Admin", senha="Alpha@123456",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def colaborador_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="colab@alpha.com", nome="Carlos Colab", senha="Alpha@123456",
        empresa=empresa_a, perfil="colaborador",
    )


@pytest.fixture
def admin_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="admin@beta.com", nome="Bruno Admin", senha="Beta@123456",
        empresa=empresa_b, perfil="admin",
    )


@pytest.fixture
def categoria_a(db, empresa_a):
    return Categoria.objects.create(
        empresa=empresa_a, nome="Vendas", tipo="receita", cor="#16a34a"
    )


@pytest.fixture
def lancamento_pago(db, empresa_a, categoria_a, admin_a):
    return Lancamento.objects.create(
        empresa=empresa_a,
        tipo="receita",
        descricao="Venda equipamento X",
        valor=Decimal("5000.00"),
        categoria=categoria_a,
        data_vencimento=date.today() - timedelta(days=3),
        data_pagamento=date.today() - timedelta(days=1),
        status="pago",
        criado_por=admin_a,
    )


@pytest.fixture
def lancamento_pendente(db, empresa_a, admin_a):
    return Lancamento.objects.create(
        empresa=empresa_a,
        tipo="despesa",
        descricao="Aluguel",
        valor=Decimal("1500.00"),
        data_vencimento=date.today() + timedelta(days=5),
        status="pendente",
        criado_por=admin_a,
    )


@pytest.fixture
def lancamento_pago_b(db, empresa_b, admin_b):
    return Lancamento.objects.create(
        empresa=empresa_b,
        tipo="receita",
        descricao="Venda da empresa B",
        valor=Decimal("900.00"),
        data_vencimento=date.today(),
        data_pagamento=date.today(),
        status="pago",
        criado_por=admin_b,
    )


def _cli(usuario):
    client = APIClient()
    client.cookies["access_token"] = str(RefreshToken.for_user(usuario).access_token)
    return client


MOTIVO_OK = "Corrigi valor digitado errado na conciliação bancária."


# ════════════════════════════════════════════════════════════
# EDIÇÃO DE PAGO
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestEditarPago:

    def test_admin_edita_pago_com_motivo(self, admin_a, lancamento_pago):
        """Admin + motivo → 200, campo alterado, log criado."""
        r = _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "500.00", "motivo": MOTIVO_OK},
            format="json",
        )
        assert r.status_code == 200
        lancamento_pago.refresh_from_db()
        assert lancamento_pago.valor == Decimal("500.00")

        log = LogEdicaoLancamento.objects.get(lancamento=lancamento_pago)
        assert log.acao == "editado"
        assert log.motivo == MOTIVO_OK
        assert log.editado_por == admin_a
        assert str(log.empresa_id) == str(lancamento_pago.empresa_id)

    def test_admin_edita_pago_sem_motivo_400(self, admin_a, lancamento_pago):
        r = _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "500.00"},
            format="json",
        )
        assert r.status_code == 400
        assert "motivo" in r.json()["error"]["message"].lower()
        lancamento_pago.refresh_from_db()
        assert lancamento_pago.valor == Decimal("5000.00")  # intocado
        assert LogEdicaoLancamento.objects.count() == 0

    def test_motivo_curto_400(self, admin_a, lancamento_pago):
        r = _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "500.00", "motivo": "erro"},  # 4 chars
            format="json",
        )
        assert r.status_code == 400
        assert LogEdicaoLancamento.objects.count() == 0

    def test_motivo_longo_400(self, admin_a, lancamento_pago):
        r = _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "500.00", "motivo": "x" * 501},
            format="json",
        )
        assert r.status_code == 400

    def test_nao_admin_edita_pago_403(self, colaborador_a, lancamento_pago):
        r = _cli(colaborador_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "500.00", "motivo": MOTIVO_OK},
            format="json",
        )
        assert r.status_code == 403
        lancamento_pago.refresh_from_db()
        assert lancamento_pago.valor == Decimal("5000.00")
        assert LogEdicaoLancamento.objects.count() == 0

    def test_editar_pendente_sem_motivo_mantido(self, colaborador_a, lancamento_pendente):
        """Pendente: qualquer usuário edita livremente, sem motivo e sem log."""
        r = _cli(colaborador_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pendente.id}/",
            {"valor": "1600.00"},
            format="json",
        )
        assert r.status_code == 200
        lancamento_pendente.refresh_from_db()
        assert lancamento_pendente.valor == Decimal("1600.00")
        assert LogEdicaoLancamento.objects.count() == 0

    def test_snapshot_antes_depois_completo(self, admin_a, lancamento_pago, categoria_a):
        _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "500.00", "descricao": "Venda corrigida", "motivo": MOTIVO_OK},
            format="json",
        )
        log = LogEdicaoLancamento.objects.get()
        antes, depois = log.snapshot_antes, log.snapshot_depois

        # todos os campos relevantes presentes nos dois snapshots
        campos = {
            "id", "tipo", "descricao", "valor", "categoria_id", "categoria_nome",
            "data_vencimento", "data_pagamento", "status", "recorrente",
            "recorrencia", "observacoes",
        }
        assert campos.issubset(antes.keys())
        assert campos.issubset(depois.keys())

        assert antes["valor"] == "5000.00"
        assert depois["valor"] == "500.00"
        assert antes["descricao"] == "Venda equipamento X"
        assert depois["descricao"] == "Venda corrigida"
        assert antes["categoria_nome"] == "Vendas"
        assert antes["status"] == "pago" and depois["status"] == "pago"

    def test_multitenant_admin_a_nao_edita_lancamento_b(self, admin_a, lancamento_pago_b):
        r = _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago_b.id}/",
            {"valor": "1.00", "motivo": MOTIVO_OK},
            format="json",
        )
        assert r.status_code == 404
        lancamento_pago_b.refresh_from_db()
        assert lancamento_pago_b.valor == Decimal("900.00")

    def test_cache_saldo_invalidado_apos_edicao(self, admin_a, empresa_a, lancamento_pago):
        chave_saldo = build_cache_key(empresa_a.id, "financeiro", "saldo")
        chave_dash = build_cache_key(empresa_a.id, "dashboard", "kpis")
        set_cached(chave_saldo, {"saldo": "stale"}, ttl=600)
        set_cached(chave_dash, {"kpi": "stale"}, ttl=600)

        r = _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "500.00", "motivo": MOTIVO_OK},
            format="json",
        )
        assert r.status_code == 200
        assert get_cached(chave_saldo) is None
        assert get_cached(chave_dash) is None


# ════════════════════════════════════════════════════════════
# EXCLUSÃO DE PAGO (POST /excluir/ com motivo)
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestExcluirPago:

    def test_admin_exclui_pago_com_motivo(self, admin_a, lancamento_pago):
        lanc_id = lancamento_pago.id
        r = _cli(admin_a).post(
            f"/api/financeiro/lancamentos/{lanc_id}/excluir/",
            {"motivo": "Lançamento duplicado, pago uma única vez."},
            format="json",
        )
        assert r.status_code == 204
        assert not Lancamento.objects.filter(id=lanc_id).exists()

        log = LogEdicaoLancamento.objects.get()
        assert log.acao == "excluido"
        assert log.snapshot_antes["descricao"] == "Venda equipamento X"
        assert log.snapshot_antes["valor"] == "5000.00"
        assert log.snapshot_depois is None
        assert log.lancamento is None  # FK nula: o lançamento não existe mais

    def test_excluir_pago_sem_motivo_400(self, admin_a, lancamento_pago):
        r = _cli(admin_a).post(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/excluir/",
            {},
            format="json",
        )
        assert r.status_code == 400
        assert Lancamento.objects.filter(id=lancamento_pago.id).exists()

    def test_nao_admin_exclui_pago_403(self, colaborador_a, lancamento_pago):
        r = _cli(colaborador_a).post(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/excluir/",
            {"motivo": MOTIVO_OK},
            format="json",
        )
        assert r.status_code == 403
        assert Lancamento.objects.filter(id=lancamento_pago.id).exists()

    def test_delete_simples_de_pago_bloqueado(self, admin_a, lancamento_pago):
        """DELETE sem motivo é bloqueado, direcionando ao fluxo auditado."""
        r = _cli(admin_a).delete(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/"
        )
        assert r.status_code == 400
        assert "excluir/" in r.json()["error"]["message"]
        assert Lancamento.objects.filter(id=lancamento_pago.id).exists()

    def test_delete_pendente_continua_livre(self, colaborador_a, lancamento_pendente):
        """Pendente: DELETE simples segue funcionando para qualquer usuário."""
        r = _cli(colaborador_a).delete(
            f"/api/financeiro/lancamentos/{lancamento_pendente.id}/"
        )
        assert r.status_code == 204
        assert not Lancamento.objects.filter(id=lancamento_pendente.id).exists()

    def test_multitenant_admin_a_nao_exclui_lancamento_b(self, admin_a, lancamento_pago_b):
        r = _cli(admin_a).post(
            f"/api/financeiro/lancamentos/{lancamento_pago_b.id}/excluir/",
            {"motivo": MOTIVO_OK},
            format="json",
        )
        assert r.status_code == 404
        assert Lancamento.objects.filter(id=lancamento_pago_b.id).exists()

    def test_cache_invalidado_apos_exclusao(self, admin_a, empresa_a, lancamento_pago):
        chave_saldo = build_cache_key(empresa_a.id, "financeiro", "saldo")
        set_cached(chave_saldo, {"saldo": "stale"}, ttl=600)
        r = _cli(admin_a).post(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/excluir/",
            {"motivo": MOTIVO_OK},
            format="json",
        )
        assert r.status_code == 204
        assert get_cached(chave_saldo) is None


# ════════════════════════════════════════════════════════════
# HISTÓRICO (GET /historico/)
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestHistorico:

    def test_historico_vazio_para_lancamento_nunca_editado(self, admin_a, lancamento_pago):
        r = _cli(admin_a).get(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/historico/"
        )
        assert r.status_code == 200
        assert r.json()["data"] == []

    def test_historico_lista_em_ordem_desc(self, admin_a, lancamento_pago):
        cli = _cli(admin_a)
        cli.patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "400.00", "motivo": "Primeira correção de valor."},
            format="json",
        )
        cli.patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "300.00", "motivo": "Segunda correção de valor."},
            format="json",
        )
        r = cli.get(f"/api/financeiro/lancamentos/{lancamento_pago.id}/historico/")
        assert r.status_code == 200
        logs = r.json()["data"]
        assert len(logs) == 2
        # mais recente primeiro
        assert logs[0]["motivo"] == "Segunda correção de valor."
        assert logs[1]["motivo"] == "Primeira correção de valor."
        assert logs[0]["acao"] == "editado"
        assert logs[0]["editado_por_nome"] == "Patrícia Admin"
        assert logs[0]["snapshot_antes"]["valor"] == "400.00"
        assert logs[0]["snapshot_depois"]["valor"] == "300.00"

    def test_qualquer_usuario_da_empresa_consulta_historico(
        self, admin_a, colaborador_a, lancamento_pago
    ):
        _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "400.00", "motivo": MOTIVO_OK},
            format="json",
        )
        r = _cli(colaborador_a).get(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/historico/"
        )
        assert r.status_code == 200
        assert len(r.json()["data"]) == 1

    def test_multitenant_historico_de_outra_empresa_vazio(
        self, admin_a, admin_b, lancamento_pago
    ):
        _cli(admin_a).patch(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/",
            {"valor": "400.00", "motivo": MOTIVO_OK},
            format="json",
        )
        r = _cli(admin_b).get(
            f"/api/financeiro/lancamentos/{lancamento_pago.id}/historico/"
        )
        assert r.status_code == 200
        assert r.json()["data"] == []  # empresa B não enxerga logs da A
