"""
Synapse — M8 Dashboard: Testes Completos
Cobre: happy path, acesso negado, multi-tenant, cache, todos os endpoints.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.clientes.models import Cliente
from modules.documentos.models import Documento
from modules.estoque.models import Produto
from modules.financeiro.models import Lancamento
from modules.projetos.models import Projeto, Tarefa

# ════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════


def auth_client(client, usuario):
    """Autentica o client com JWT via cookie."""
    refresh = RefreshToken.for_user(usuario)
    access = str(refresh.access_token)
    client.cookies["access_token"] = access
    return client


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
def lancamento_a(db, empresa_a, usuario_a):
    return Lancamento.objects.create(
        empresa=empresa_a,
        tipo="receita",
        descricao="Venda de produto",
        valor=Decimal("1500.00"),
        data_vencimento=date.today() + timedelta(days=3),
        status="pendente",
        criado_por=usuario_a,
    )


@pytest.fixture
def lancamento_pago(db, empresa_a, usuario_a):
    return Lancamento.objects.create(
        empresa=empresa_a,
        tipo="receita",
        descricao="Receita paga",
        valor=Decimal("2000.00"),
        data_vencimento=date.today() - timedelta(days=5),
        data_pagamento=date.today() - timedelta(days=5),
        status="pago",
        criado_por=usuario_a,
    )


@pytest.fixture
def produto_a(db, empresa_a, usuario_a):
    return Produto.objects.create(
        empresa=empresa_a,
        nome="Produto Alpha",
        sku="ALPHA-001",
        preco_custo=Decimal("10.00"),
        preco_venda=Decimal("20.00"),
        estoque_atual=Decimal("5.000"),
        estoque_minimo=Decimal("10.000"),
        criado_por=usuario_a,
    )


@pytest.fixture
def cliente_a(db, empresa_a, usuario_a):
    return Cliente.objects.create(
        empresa=empresa_a,
        nome="Cliente Alpha",
        email="cliente@alpha.com",
        telefone="11999999999",
        status_funil="lead",
        proximo_followup=date.today() + timedelta(days=2),
        criado_por=usuario_a,
    )


@pytest.fixture
def projeto_a(db, empresa_a, usuario_a):
    return Projeto.objects.create(
        empresa=empresa_a,
        nome="Projeto Alpha",
        status="em_andamento",
        prioridade="alta",
        responsavel=usuario_a,
        data_prazo=date.today() + timedelta(days=30),
        criado_por=usuario_a,
    )


@pytest.fixture
def tarefa_a(db, empresa_a, usuario_a, projeto_a):
    return Tarefa.objects.create(
        empresa=empresa_a,
        projeto=projeto_a,
        titulo="Tarefa Alpha",
        status="a_fazer",
        prioridade="alta",
        responsavel=usuario_a,
        data_prazo=date.today() + timedelta(days=5),
        criado_por=usuario_a,
    )


@pytest.fixture
def documento_a(db, empresa_a, usuario_a):
    return Documento.objects.create(
        empresa=empresa_a,
        titulo="Documento Alpha",
        tipo="contrato",
        status="ativo",
        criado_por=usuario_a,
    )


# ════════════════════════════════════════════════════════════
# TESTES: RESUMO PRINCIPAL
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardResumo:
    BASE = "/api/dashboard/resumo/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path(self, client, usuario_a, lancamento_a, produto_a, cliente_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        d = data["data"]
        # Verifica estrutura completa
        assert "financeiro" in d
        assert "estoque" in d
        assert "crm" in d
        assert "projetos" in d
        assert "equipe" in d
        assert "notificacoes" in d
        assert "meta" in d
        # Verifica campos financeiros
        assert "total_receitas" in d["financeiro"]
        assert "total_despesas" in d["financeiro"]
        assert "saldo_mes" in d["financeiro"]
        assert "total_pendente" in d["financeiro"]
        # Verifica campos de estoque
        assert "total_produtos" in d["estoque"]
        assert "valor_total_estoque" in d["estoque"]
        assert "produtos_sem_estoque" in d["estoque"]
        # Verifica campos CRM
        assert "total_clientes" in d["crm"]
        assert "clientes_ativos" in d["crm"]
        # Verifica campos de projetos
        assert "total_projetos" in d["projetos"]
        assert "tarefas_minhas" in d["projetos"]
        # Verifica meta
        assert "mes" in d["meta"]
        assert "ano" in d["meta"]

    def test_multi_tenant_isolamento(self, client, usuario_a, usuario_b, lancamento_a):
        """Usuário B não vê dados da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()["data"]
        # Empresa B não tem lançamentos, clientes, etc.
        assert data["financeiro"]["lancamentos_count"] == 0
        assert data["crm"]["total_clientes"] == 0

    def test_cache_redis(self, client, usuario_a):
        """Segunda chamada deve usar cache (mock do cache)."""
        c = auth_client(client, usuario_a)
        with patch("modules.dashboard.services.get_cached") as mock_get, \
             patch("modules.dashboard.services.set_cached") as mock_set:
            mock_get.return_value = None  # Cache miss na primeira chamada
            resp = c.get(self.BASE)
            assert resp.status_code == 200
            # set_cached deve ter sido chamado para salvar no cache
            assert mock_set.called

    def test_cache_hit(self, client, usuario_a):
        """Quando cache tem dados, não deve chamar os repositories."""
        c = auth_client(client, usuario_a)
        dados_cache = {
            "financeiro": {"total_receitas": 999.0, "total_despesas": 0.0, "saldo_mes": 999.0,
                           "total_pendente": 0.0, "total_atrasado": 0.0, "lancamentos_count": 1},
            "estoque": {"total_produtos": 0, "valor_total_estoque": 0.0,
                        "produtos_sem_estoque": 0, "produtos_abaixo_minimo": 0, "giro_medio": 0.0},
            "crm": {"total_clientes": 0, "clientes_ativos": 0, "novos_este_mes": 0,
                    "valor_total_gerado": 0.0, "ticket_medio_geral": 0.0,
                    "followups_atrasados": 0, "clientes_por_status": {}},
            "projetos": {"total_projetos": 0, "projetos_ativos": 0, "projetos_atrasados": 0,
                         "tarefas_pendentes": 0, "tarefas_minhas": 0, "tarefas_atrasadas": 0,
                         "projetos_por_status": {}},
            "equipe": {"total_membros": 0, "membros_ativos": 0, "por_perfil": {}, "por_departamento": []},
            "notificacoes": {"nao_lidas": 0},
            "meta": {"mes": 5, "ano": 2026, "gerado_em": "2026-05-23"},
        }
        with patch("modules.dashboard.services.get_cached", return_value=dados_cache):
            resp = c.get(self.BASE)
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["financeiro"]["total_receitas"] == 999.0


# ════════════════════════════════════════════════════════════
# TESTES: FLUXO DE CAIXA
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardFluxoCaixa:
    BASE = "/api/dashboard/fluxo-caixa/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path_sem_parametros(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "fluxo" in data["data"]
        assert data["data"]["dias"] == 30

    def test_happy_path_com_parametros(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?dias=14")
        assert resp.status_code == 200
        assert resp.json()["data"]["dias"] == 14

    def test_parametro_invalido_dias_minimo(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?dias=3")
        assert resp.status_code == 400

    def test_parametro_invalido_dias_maximo(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?dias=400")
        assert resp.status_code == 400

    def test_multi_tenant(self, client, usuario_a, usuario_b, lancamento_pago):
        """Empresa B não vê fluxo da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        # Fluxo da empresa B deve estar vazio
        assert resp.json()["data"]["fluxo"] == []


# ════════════════════════════════════════════════════════════
# TESTES: FUNIL DE VENDAS
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardFunilVendas:
    BASE = "/api/dashboard/funil-vendas/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path(self, client, usuario_a, cliente_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "etapas" in data["data"]
        etapas = data["data"]["etapas"]
        assert len(etapas) == 6
        # Verifica estrutura de cada etapa
        for etapa in etapas:
            assert "status" in etapa
            assert "label" in etapa
            assert "count" in etapa
        # Verifica que lead tem 1 cliente
        lead = next(e for e in etapas if e["status"] == "lead")
        assert lead["count"] == 1

    def test_multi_tenant(self, client, usuario_b, cliente_a):
        """Empresa B não vê clientes da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        etapas = resp.json()["data"]["etapas"]
        for etapa in etapas:
            assert etapa["count"] == 0


# ════════════════════════════════════════════════════════════
# TESTES: VENCIMENTOS PRÓXIMOS
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardVencimentos:
    BASE = "/api/dashboard/vencimentos/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path(self, client, usuario_a, lancamento_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "vencimentos" in data["data"]
        assert data["data"]["dias"] == 7
        # lancamento_a vence em 3 dias, deve aparecer
        vencimentos = data["data"]["vencimentos"]
        assert len(vencimentos) >= 1
        v = vencimentos[0]
        assert "id" in v
        assert "descricao" in v
        assert "valor" in v
        assert "tipo" in v
        assert "data_vencimento" in v

    def test_parametro_dias_customizado(self, client, usuario_a, lancamento_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?dias=3")
        assert resp.status_code == 200
        assert resp.json()["data"]["dias"] == 3

    def test_parametro_invalido(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?dias=50")
        assert resp.status_code == 400

    def test_multi_tenant(self, client, usuario_b, lancamento_a):
        """Empresa B não vê lançamentos da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        assert resp.json()["data"]["vencimentos"] == []


# ════════════════════════════════════════════════════════════
# TESTES: FOLLOW-UPS
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardFollowUps:
    BASE = "/api/dashboard/followups/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path(self, client, usuario_a, cliente_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "followups" in data["data"]
        assert data["data"]["dias"] == 3
        # cliente_a tem followup em 2 dias
        followups = data["data"]["followups"]
        assert len(followups) >= 1
        f = followups[0]
        assert "id" in f
        assert "nome" in f
        assert "proximo_followup" in f
        assert "status_funil" in f

    def test_parametro_invalido(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?dias=20")
        assert resp.status_code == 400

    def test_multi_tenant(self, client, usuario_b, cliente_a):
        """Empresa B não vê follow-ups da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        assert resp.json()["data"]["followups"] == []


# ════════════════════════════════════════════════════════════
# TESTES: MINHAS TAREFAS
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardMinhasTarefas:
    BASE = "/api/dashboard/minhas-tarefas/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "tarefas" in data["data"]
        tarefas = data["data"]["tarefas"]
        assert len(tarefas) >= 1
        t = tarefas[0]
        assert "id" in t
        assert "titulo" in t
        assert "status" in t
        assert "prioridade" in t
        assert "projeto_nome" in t

    def test_nao_mostra_tarefas_concluidas(self, client, usuario_a, projeto_a):
        """Tarefas concluídas não devem aparecer."""
        Tarefa.objects.create(
            empresa=usuario_a.empresa,
            projeto=projeto_a,
            titulo="Tarefa Concluída",
            status="concluido",
            responsavel=usuario_a,
            criado_por=usuario_a,
        )
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        tarefas = resp.json()["data"]["tarefas"]
        for t in tarefas:
            assert t["status"] != "concluido"

    def test_multi_tenant(self, client, usuario_b, tarefa_a):
        """Usuário B não vê tarefas da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        assert resp.json()["data"]["tarefas"] == []


# ════════════════════════════════════════════════════════════
# TESTES: ALERTAS DE ESTOQUE
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardAlertasEstoque:
    BASE = "/api/dashboard/alertas-estoque/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path(self, client, usuario_a, produto_a):
        """produto_a tem estoque_atual=5 < estoque_minimo=10 → deve aparecer."""
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "alertas" in data["data"]
        alertas = data["data"]["alertas"]
        assert len(alertas) >= 1
        a = alertas[0]
        assert "id" in a
        assert "nome" in a
        assert "estoque_atual" in a
        assert "estoque_minimo" in a
        assert "status_estoque" in a

    def test_produto_estoque_ok_nao_aparece(self, client, usuario_a):
        """Produto com estoque OK não deve aparecer nos alertas."""
        Produto.objects.create(
            empresa=usuario_a.empresa,
            nome="Produto OK",
            sku="OK-001",
            preco_custo=Decimal("10.00"),
            preco_venda=Decimal("20.00"),
            estoque_atual=Decimal("100.000"),
            estoque_minimo=Decimal("10.000"),
            criado_por=usuario_a,
        )
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        alertas = resp.json()["data"]["alertas"]
        nomes = [a["nome"] for a in alertas]
        assert "Produto OK" not in nomes

    def test_multi_tenant(self, client, usuario_b, produto_a):
        """Empresa B não vê alertas da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        assert resp.json()["data"]["alertas"] == []


# ════════════════════════════════════════════════════════════
# TESTES: PROJETOS EM ANDAMENTO
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardProjetos:
    BASE = "/api/dashboard/projetos/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path(self, client, usuario_a, projeto_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "projetos" in data["data"]
        projetos = data["data"]["projetos"]
        assert len(projetos) >= 1
        p = projetos[0]
        assert "id" in p
        assert "nome" in p
        assert "status" in p
        assert "progresso" in p
        assert "cor" in p

    def test_nao_mostra_projetos_concluidos(self, client, usuario_a):
        """Projetos concluídos não devem aparecer no widget."""
        Projeto.objects.create(
            empresa=usuario_a.empresa,
            nome="Projeto Concluído",
            status="concluido",
            criado_por=usuario_a,
        )
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        projetos = resp.json()["data"]["projetos"]
        for p in projetos:
            assert p["status"] not in ["concluido", "cancelado"]

    def test_multi_tenant(self, client, usuario_b, projeto_a):
        """Empresa B não vê projetos da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        assert resp.json()["data"]["projetos"] == []


# ════════════════════════════════════════════════════════════
# TESTES: ATIVIDADE RECENTE
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardAtividade:
    BASE = "/api/dashboard/atividade/"

    def test_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_happy_path_vazio(self, client, usuario_a):
        """Empresa sem dados recentes retorna lista vazia."""
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "eventos" in data["data"]
        assert isinstance(data["data"]["eventos"], list)

    def test_happy_path_com_dados(self, client, usuario_a, lancamento_a, documento_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        eventos = resp.json()["data"]["eventos"]
        # Deve ter pelo menos o lançamento e o documento
        assert len(eventos) >= 1
        # Verifica estrutura de cada evento
        for evento in eventos:
            assert "tipo" in evento
            assert "titulo" in evento
            assert "data" in evento

    def test_parametro_limit(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?limit=5")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_parametro_invalido(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE + "?limit=30")
        assert resp.status_code == 400

    def test_multi_tenant(self, client, usuario_b, lancamento_a, documento_a):
        """Empresa B não vê atividade da empresa A."""
        c_b = auth_client(client, usuario_b)
        resp = c_b.get(self.BASE)
        assert resp.status_code == 200
        # Eventos da empresa B devem estar vazios (sem dados criados para ela)
        eventos = resp.json()["data"]["eventos"]
        assert isinstance(eventos, list)
        assert len(eventos) == 0


# ════════════════════════════════════════════════════════════
# TESTES: DASHBOARD SERVICE (Unitários)
# ════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestDashboardService:
    def test_obter_resumo_principal_estrutura(self, usuario_a):
        from modules.dashboard.services import DashboardService
        resumo = DashboardService.obter_resumo_principal(
            usuario_a.empresa_id, usuario_a.id
        )
        assert "financeiro" in resumo
        assert "estoque" in resumo
        assert "crm" in resumo
        assert "projetos" in resumo
        assert "equipe" in resumo
        assert "notificacoes" in resumo
        assert "meta" in resumo

    def test_obter_fluxo_caixa_lista(self, usuario_a):
        from modules.dashboard.services import DashboardService
        fluxo = DashboardService.obter_fluxo_caixa(usuario_a.empresa_id, 30)
        assert isinstance(fluxo, list)

    def test_obter_funil_vendas_estrutura(self, usuario_a):
        from modules.dashboard.services import DashboardService
        funil = DashboardService.obter_funil_vendas(usuario_a.empresa_id)
        assert "etapas" in funil
        assert len(funil["etapas"]) == 6

    def test_obter_vencimentos_lista(self, usuario_a, lancamento_a):
        from modules.dashboard.services import DashboardService
        vencimentos = DashboardService.obter_vencimentos_proximos(
            usuario_a.empresa_id, 7
        )
        assert isinstance(vencimentos, list)
        assert len(vencimentos) >= 1

    def test_obter_followups_lista(self, usuario_a, cliente_a):
        from modules.dashboard.services import DashboardService
        followups = DashboardService.obter_followups_proximos(
            usuario_a.empresa_id, 3
        )
        assert isinstance(followups, list)
        assert len(followups) >= 1

    def test_obter_minhas_tarefas_lista(self, usuario_a, tarefa_a):
        from modules.dashboard.services import DashboardService
        tarefas = DashboardService.obter_minhas_tarefas(
            usuario_a.empresa_id, usuario_a.id
        )
        assert isinstance(tarefas, list)
        assert len(tarefas) >= 1
        assert tarefas[0]["titulo"] == "Tarefa Alpha"

    def test_obter_alertas_estoque_lista(self, usuario_a, produto_a):
        from modules.dashboard.services import DashboardService
        alertas = DashboardService.obter_alertas_estoque(usuario_a.empresa_id)
        assert isinstance(alertas, list)
        assert len(alertas) >= 1

    def test_obter_projetos_em_andamento_lista(self, usuario_a, projeto_a):
        from modules.dashboard.services import DashboardService
        projetos = DashboardService.obter_projetos_em_andamento(usuario_a.empresa_id)
        assert isinstance(projetos, list)
        assert len(projetos) >= 1
        assert projetos[0]["nome"] == "Projeto Alpha"

    def test_obter_atividade_recente_lista(self, usuario_a, lancamento_a):
        from modules.dashboard.services import DashboardService
        atividade = DashboardService.obter_atividade_recente(usuario_a.empresa_id)
        assert isinstance(atividade, list)

    def test_resiliencia_modulo_com_erro(self, usuario_a):
        """Service deve ser resiliente a erros de módulos individuais."""
        from modules.dashboard.services import DashboardService
        with patch(
            "modules.financeiro.services.FinanceiroService.obter_resumo",
            side_effect=Exception("Erro simulado"),
        ):
            resumo = DashboardService.obter_resumo_principal(
                usuario_a.empresa_id, usuario_a.id
            )
            # Mesmo com erro no financeiro, deve retornar dados padrão
            assert resumo["financeiro"]["total_receitas"] == 0
            assert "estoque" in resumo
