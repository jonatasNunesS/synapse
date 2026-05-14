"""
Synapse — M2 Financeiro: Testes Completos
Cobre: happy path, dados inválidos, acesso negado, multi-tenant, cache.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Categoria, Lancamento
from modules.financeiro.repository import FinanceiroRepository
from modules.financeiro.services import FinanceiroService


# ════════════════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════════════════

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(
        nome="Empresa Alpha",
        cnpj="11.111.111/0001-11",
        plano="basico",
    )


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(
        nome="Empresa Beta",
        cnpj="22.222.222/0001-22",
        plano="basico",
    )


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="user@alpha.com",
        nome="Usuário Alpha",
        senha="Alpha@123456",
        empresa=empresa_a,
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="user@beta.com",
        nome="Usuário Beta",
        senha="Beta@123456",
        empresa=empresa_b,
    )


@pytest.fixture
def categoria_receita(db, empresa_a):
    return Categoria.objects.create(
        empresa=empresa_a,
        nome="Vendas",
        tipo="receita",
        cor="#16a34a",
    )


@pytest.fixture
def categoria_despesa(db, empresa_a):
    return Categoria.objects.create(
        empresa=empresa_a,
        nome="Aluguel",
        tipo="despesa",
        cor="#dc2626",
    )


@pytest.fixture
def lancamento_receita(db, empresa_a, categoria_receita, usuario_a):
    return Lancamento.objects.create(
        empresa=empresa_a,
        tipo="receita",
        descricao="Venda de produto",
        valor=Decimal("5000.00"),
        categoria=categoria_receita,
        data_vencimento=date.today(),
        status="pago",
        data_pagamento=date.today(),
        criado_por=usuario_a,
    )


@pytest.fixture
def lancamento_despesa_pendente(db, empresa_a, categoria_despesa, usuario_a):
    return Lancamento.objects.create(
        empresa=empresa_a,
        tipo="despesa",
        descricao="Aluguel do escritório",
        valor=Decimal("1500.00"),
        categoria=categoria_despesa,
        data_vencimento=date.today() + timedelta(days=5),
        status="pendente",
        criado_por=usuario_a,
    )


@pytest.fixture
def lancamento_atrasado(db, empresa_a, categoria_despesa, usuario_a):
    return Lancamento.objects.create(
        empresa=empresa_a,
        tipo="despesa",
        descricao="Conta de luz atrasada",
        valor=Decimal("800.00"),
        categoria=categoria_despesa,
        data_vencimento=date.today() - timedelta(days=1),
        status="pendente",
        criado_por=usuario_a,
    )


def auth_client(client, usuario):
    """Autentica o client com JWT via cookie."""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(usuario)
    access = str(refresh.access_token)
    client.cookies["access_token"] = access
    return client


# ════════════════════════════════════════════════════════════
# TESTES DE MODELO
# ════════════════════════════════════════════════════════════

class TestCategoriaModel:
    def test_criacao_categoria(self, db, empresa_a):
        cat = Categoria.objects.create(
            empresa=empresa_a, nome="Serviços", tipo="receita"
        )
        assert cat.id is not None
        assert cat.ativo is True
        assert str(cat) == "Serviços (receita)"

    def test_unicidade_nome_tipo_por_empresa(self, db, empresa_a):
        Categoria.objects.create(empresa=empresa_a, nome="Vendas", tipo="receita")
        with pytest.raises(Exception):
            Categoria.objects.create(empresa=empresa_a, nome="Vendas", tipo="receita")

    def test_mesma_categoria_em_empresas_diferentes(self, db, empresa_a, empresa_b):
        Categoria.objects.create(empresa=empresa_a, nome="Vendas", tipo="receita")
        cat_b = Categoria.objects.create(empresa=empresa_b, nome="Vendas", tipo="receita")
        assert cat_b.id is not None


class TestLancamentoModel:
    def test_criacao_lancamento(self, db, empresa_a, categoria_receita, usuario_a):
        l = Lancamento.objects.create(
            empresa=empresa_a,
            tipo="receita",
            descricao="Teste",
            valor=Decimal("100.00"),
            categoria=categoria_receita,
            data_vencimento=date.today(),
            criado_por=usuario_a,
        )
        assert l.id is not None
        assert l.status == "pendente"

    def test_esta_atrasado_true(self, lancamento_atrasado):
        assert lancamento_atrasado.esta_atrasado is True

    def test_esta_atrasado_false_pendente_futuro(self, lancamento_despesa_pendente):
        assert lancamento_despesa_pendente.esta_atrasado is False

    def test_esta_atrasado_false_pago(self, lancamento_receita):
        assert lancamento_receita.esta_atrasado is False


# ════════════════════════════════════════════════════════════
# TESTES DE REPOSITORY
# ════════════════════════════════════════════════════════════

class TestFinanceiroRepository:
    def test_listar_categorias(self, db, empresa_a, categoria_receita, categoria_despesa):
        cats = FinanceiroRepository.listar_categorias(empresa_a.id)
        assert cats.count() == 2

    def test_listar_categorias_multi_tenant(
        self, db, empresa_a, empresa_b, categoria_receita
    ):
        Categoria.objects.create(empresa=empresa_b, nome="Vendas B", tipo="receita")
        cats_a = FinanceiroRepository.listar_categorias(empresa_a.id)
        cats_b = FinanceiroRepository.listar_categorias(empresa_b.id)
        assert cats_a.count() == 1
        assert cats_b.count() == 1

    def test_calcular_resumo(
        self, db, empresa_a, lancamento_receita, lancamento_despesa_pendente
    ):
        hoje = date.today()
        resumo = FinanceiroRepository.calcular_resumo(empresa_a.id, hoje.month, hoje.year)
        assert resumo["total_receitas"] == Decimal("5000.00")
        assert resumo["saldo"] == Decimal("5000.00")  # despesa ainda pendente
        assert resumo["total_pendente"] == Decimal("1500.00")

    def test_calcular_resumo_atrasado(self, db, empresa_a, lancamento_atrasado):
        hoje = date.today()
        resumo = FinanceiroRepository.calcular_resumo(empresa_a.id, hoje.month, hoje.year)
        assert resumo["total_atrasado"] == Decimal("800.00")

    def test_fluxo_caixa(self, db, empresa_a, lancamento_receita):
        hoje = date.today()
        fluxo = FinanceiroRepository.fluxo_caixa(
            empresa_a.id, hoje - timedelta(days=1), hoje + timedelta(days=1)
        )
        assert len(fluxo) == 1
        assert fluxo[0]["receitas"] == Decimal("5000.00")

    def test_dre(self, db, empresa_a, lancamento_receita, categoria_receita):
        hoje = date.today()
        dre = FinanceiroRepository.dre(empresa_a.id, hoje.month, hoje.year)
        assert dre["total_receitas"] == Decimal("5000.00")
        assert len(dre["receitas_por_categoria"]) == 1
        assert dre["receitas_por_categoria"][0]["categoria"] == "Vendas"

    def test_listar_lancamentos_vencidos(self, db, empresa_a, lancamento_atrasado):
        vencidos = FinanceiroRepository.listar_lancamentos_vencidos(empresa_a.id)
        assert vencidos.count() == 1

    def test_marcar_como_pago(
        self, db, empresa_a, lancamento_despesa_pendente
    ):
        pago = FinanceiroRepository.marcar_como_pago(
            lancamento_despesa_pendente, date.today()
        )
        assert pago.status == "pago"
        assert pago.data_pagamento == date.today()


# ════════════════════════════════════════════════════════════
# TESTES DE SERVICE
# ════════════════════════════════════════════════════════════

class TestFinanceiroService:
    def test_criar_lancamento(self, db, empresa_a, categoria_receita, usuario_a):
        dados = {
            "tipo": "receita",
            "descricao": "Novo lançamento",
            "valor": Decimal("1000.00"),
            "categoria": categoria_receita,
            "data_vencimento": date.today(),
        }
        l = FinanceiroService.criar_lancamento(empresa_a.id, usuario_a.id, dados)
        assert l.id is not None
        assert l.empresa_id == empresa_a.id

    def test_marcar_como_pago_ja_pago_levanta_erro(
        self, db, empresa_a, lancamento_receita
    ):
        with pytest.raises(ValueError, match="já está marcado como pago"):
            FinanceiroService.marcar_como_pago(
                empresa_a.id, lancamento_receita.id, date.today()
            )

    def test_marcar_como_pago_cancelado_levanta_erro(
        self, db, empresa_a, usuario_a, categoria_despesa
    ):
        l = Lancamento.objects.create(
            empresa=empresa_a,
            tipo="despesa",
            descricao="Cancelado",
            valor=Decimal("100.00"),
            categoria=categoria_despesa,
            data_vencimento=date.today(),
            status="cancelado",
            criado_por=usuario_a,
        )
        with pytest.raises(ValueError, match="cancelado"):
            FinanceiroService.marcar_como_pago(empresa_a.id, l.id, date.today())

    def test_get_lancamento_nao_encontrado(self, db, empresa_a):
        with pytest.raises(ValueError, match="não encontrado"):
            FinanceiroService.get_lancamento(empresa_a.id, uuid.uuid4())

    def test_obter_resumo_retorna_dict(
        self, db, empresa_a, lancamento_receita
    ):
        hoje = date.today()
        resumo = FinanceiroService.obter_resumo(empresa_a.id, hoje.month, hoje.year)
        assert "total_receitas" in resumo
        assert "saldo" in resumo


# ════════════════════════════════════════════════════════════
# TESTES DE API (Views)
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestCategoriaAPI:
    def test_listar_categorias_autenticado(
        self, client, usuario_a, categoria_receita, categoria_despesa
    ):
        c = auth_client(client, usuario_a)
        resp = c.get("/api/financeiro/categorias/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["data"]) == 2

    def test_listar_categorias_nao_autenticado(self, client):
        resp = client.get("/api/financeiro/categorias/")
        assert resp.status_code == 401

    def test_criar_categoria_happy_path(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            "/api/financeiro/categorias/",
            data={"nome": "Consultoria", "tipo": "receita", "cor": "#6D28D9"},
            content_type="application/json",
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["nome"] == "Consultoria"

    def test_criar_categoria_nome_duplicado(
        self, client, usuario_a, categoria_receita
    ):
        c = auth_client(client, usuario_a)
        resp = c.post(
            "/api/financeiro/categorias/",
            data={"nome": "Vendas", "tipo": "receita"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_criar_categoria_tipo_invalido(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            "/api/financeiro/categorias/",
            data={"nome": "Teste", "tipo": "invalido"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_multi_tenant_categoria(
        self, client, usuario_b, categoria_receita
    ):
        """Empresa B não deve ver categorias da Empresa A."""
        c = auth_client(client, usuario_b)
        resp = c.get("/api/financeiro/categorias/")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 0

    def test_deletar_categoria(self, client, usuario_a, categoria_receita):
        c = auth_client(client, usuario_a)
        resp = c.delete(f"/api/financeiro/categorias/{categoria_receita.id}/")
        assert resp.status_code == 200
        categoria_receita.refresh_from_db()
        assert categoria_receita.ativo is False


@pytest.mark.django_db
class TestLancamentoAPI:
    def test_listar_lancamentos_paginado(
        self, client, usuario_a, lancamento_receita, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        resp = c.get("/api/financeiro/lancamentos/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "pagination" in data

    def test_criar_lancamento_receita(
        self, client, usuario_a, categoria_receita
    ):
        c = auth_client(client, usuario_a)
        resp = c.post(
            "/api/financeiro/lancamentos/",
            data={
                "tipo": "receita",
                "descricao": "Nova venda",
                "valor": "3000.00",
                "categoria": str(categoria_receita.id),
                "data_vencimento": str(date.today()),
            },
            content_type="application/json",
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["descricao"] == "Nova venda"

    def test_criar_lancamento_valor_zero(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            "/api/financeiro/lancamentos/",
            data={
                "tipo": "despesa",
                "descricao": "Teste",
                "valor": "0.00",
                "data_vencimento": str(date.today()),
            },
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_criar_lancamento_valor_negativo(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            "/api/financeiro/lancamentos/",
            data={
                "tipo": "despesa",
                "descricao": "Teste",
                "valor": "-100.00",
                "data_vencimento": str(date.today()),
            },
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_multi_tenant_lancamento(
        self, client, usuario_b, lancamento_receita
    ):
        """Empresa B não deve ver lançamentos da Empresa A."""
        c = auth_client(client, usuario_b)
        resp = c.get("/api/financeiro/lancamentos/")
        assert resp.status_code == 200
        assert resp.json()["pagination"]["count"] == 0

    def test_pagar_lancamento_happy_path(
        self, client, usuario_a, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/financeiro/lancamentos/{lancamento_despesa_pendente.id}/pagar/",
            data={"data_pagamento": str(date.today())},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "pago"

    def test_pagar_lancamento_sem_data(
        self, client, usuario_a, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/financeiro/lancamentos/{lancamento_despesa_pendente.id}/pagar/",
            data={},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_pagar_lancamento_ja_pago(
        self, client, usuario_a, lancamento_receita
    ):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/financeiro/lancamentos/{lancamento_receita.id}/pagar/",
            data={"data_pagamento": str(date.today())},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_filtrar_por_tipo(
        self, client, usuario_a, lancamento_receita, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        resp = c.get("/api/financeiro/lancamentos/?tipo=receita")
        assert resp.status_code == 200
        results = resp.json()["data"]
        assert all(l["tipo"] == "receita" for l in results)

    def test_filtrar_por_status(
        self, client, usuario_a, lancamento_receita, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        resp = c.get("/api/financeiro/lancamentos/?status=pendente")
        assert resp.status_code == 200
        results = resp.json()["data"]
        assert all(l["status"] == "pendente" for l in results)

    def test_acesso_negado_lancamento_outra_empresa(
        self, client, usuario_b, lancamento_receita
    ):
        c = auth_client(client, usuario_b)
        resp = c.get(f"/api/financeiro/lancamentos/{lancamento_receita.id}/")
        assert resp.status_code == 404

    def test_deletar_lancamento(
        self, client, usuario_a, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        resp = c.delete(
            f"/api/financeiro/lancamentos/{lancamento_despesa_pendente.id}/"
        )
        assert resp.status_code == 204


@pytest.mark.django_db
class TestRelatoriosAPI:
    def test_resumo_financeiro(
        self, client, usuario_a, lancamento_receita, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        hoje = date.today()
        resp = c.get(f"/api/financeiro/resumo/?mes={hoje.month}&ano={hoje.year}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert float(data["total_receitas"]) == 5000.0
        assert float(data["total_pendente"]) == 1500.0

    def test_resumo_mes_invalido(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get("/api/financeiro/resumo/?mes=13&ano=2026")
        assert resp.status_code == 400

    def test_fluxo_caixa(self, client, usuario_a, lancamento_receita):
        c = auth_client(client, usuario_a)
        hoje = date.today()
        resp = c.get(
            f"/api/financeiro/fluxo-caixa/"
            f"?data_inicio={hoje - timedelta(days=1)}&data_fim={hoje + timedelta(days=1)}"
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert float(data[0]["receitas"]) == 5000.0

    def test_dre(self, client, usuario_a, lancamento_receita):
        c = auth_client(client, usuario_a)
        hoje = date.today()
        resp = c.get(f"/api/financeiro/dre/?mes={hoje.month}&ano={hoje.year}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert float(data["total_receitas"]) == 5000.0
        assert len(data["receitas_por_categoria"]) == 1

    def test_vencimentos_proximos(
        self, client, usuario_a, lancamento_despesa_pendente
    ):
        c = auth_client(client, usuario_a)
        resp = c.get("/api/financeiro/vencimentos/?dias=10")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    def test_resumo_multi_tenant(
        self, client, usuario_b, lancamento_receita
    ):
        """Empresa B não vê dados da Empresa A no resumo."""
        c = auth_client(client, usuario_b)
        hoje = date.today()
        resp = c.get(f"/api/financeiro/resumo/?mes={hoje.month}&ano={hoje.year}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert float(data["total_receitas"]) == 0.0
