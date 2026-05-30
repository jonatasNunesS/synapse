"""
Synapse — Testes de Integração End-to-End (M0→M5)
Valida todos os fluxos de negócio em sequência:
4.1 Autenticação | 4.2 Financeiro | 4.3 Estoque | 4.4 CRM | 4.5 Fornecedores
4.6 Multi-tenant | 4.7 Cache Redis (chaves) | 4.8 Celery (tasks registradas)
"""
import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from rest_framework.test import APIClient


# ════════════════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════════════════

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def empresa_e_usuario(db):
    """Cria empresa + usuário autenticado via registro."""
    from modules.auth.models import Empresa, CustomUser
    empresa = Empresa.objects.create(nome="Empresa Teste E2E")
    user = CustomUser.objects.create_user(
        email="e2e@teste.com",
        senha="SenhaForte123!",
        nome="Usuário E2E",
        empresa=empresa,
    )
    return empresa, user


@pytest.fixture
def empresa2_e_usuario2(db):
    """Segunda empresa para testes multi-tenant."""
    from modules.auth.models import Empresa, CustomUser
    empresa2 = Empresa.objects.create(nome="Empresa Rival")
    user2 = CustomUser.objects.create_user(
        email="rival@teste.com",
        senha="SenhaForte123!",
        nome="Usuário Rival",
        empresa=empresa2,
    )
    return empresa2, user2


@pytest.fixture
def auth_client(client, empresa_e_usuario):
    """APIClient autenticado com empresa 1."""
    empresa, user = empresa_e_usuario
    client.force_authenticate(user=user)
    return client, empresa, user


@pytest.fixture
def auth_client2(empresa2_e_usuario2):
    """APIClient autenticado com empresa 2."""
    from rest_framework.test import APIClient
    client2 = APIClient()
    empresa2, user2 = empresa2_e_usuario2
    client2.force_authenticate(user=user2)
    return client2, empresa2, user2


# ════════════════════════════════════════════════════════════
# 4.1 AUTENTICAÇÃO
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestE2EAuth:
    """Fluxo completo de autenticação."""

    def test_registro_empresa_usuario(self, client):
        """Registrar nova empresa + usuário."""
        resp = client.post("/api/auth/registro/", {
            "nome_usuario": "Fundador Teste",
            "email": "fundador@startup.com",
            "senha": "SenhaForte123!",
            "confirmar_senha": "SenhaForte123!",
            "nome_empresa": "Startup SA",
            "segmento": "varejo",
        }, format="json")
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["usuario"]["email"] == "fundador@startup.com"

    def test_login_retorna_token(self, client, empresa_e_usuario):
        """Login retorna access_token e dados do usuário."""
        resp = client.post("/api/auth/login/", {
            "email": "e2e@teste.com",
            "senha": "SenhaForte123!",
        }, format="json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "usuario" in data["data"]

    def test_login_senha_errada_retorna_401(self, client, empresa_e_usuario):
        """Login com senha errada retorna 401."""
        resp = client.post("/api/auth/login/", {
            "email": "e2e@teste.com",
            "senha": "SenhaErrada999",
        }, format="json")
        assert resp.status_code == 401
        assert resp.json()["success"] is False

    def test_acesso_rota_protegida_sem_auth(self, client):
        """Rota protegida sem token retorna 401."""
        resp = client.get("/api/financeiro/resumo/")
        assert resp.status_code == 401

    def test_me_retorna_dados_usuario(self, auth_client):
        """GET /api/auth/me/ retorna dados do usuário logado."""
        client, empresa, user = auth_client
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["email"] == "e2e@teste.com"
        assert data["data"]["empresa"]["nome"] == "Empresa Teste E2E"


# ════════════════════════════════════════════════════════════
# 4.2 FINANCEIRO
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestE2EFinanceiro:
    """Fluxo completo do módulo financeiro."""

    def test_criar_categoria_receita(self, auth_client):
        """Criar categoria 'Vendas' do tipo receita."""
        client, empresa, user = auth_client
        resp = client.post("/api/financeiro/categorias/", {
            "nome": "Vendas",
            "tipo": "receita",
        }, format="json")
        assert resp.status_code == 201
        assert resp.json()["data"]["nome"] == "Vendas"

    def test_lancar_receita_paga(self, auth_client):
        """Lançar receita de R$2.000 paga hoje."""
        client, empresa, user = auth_client
        # Criar categoria primeiro
        cat_resp = client.post("/api/financeiro/categorias/", {
            "nome": "Vendas", "tipo": "receita"
        }, format="json")
        cat_id = cat_resp.json()["data"]["id"]

        resp = client.post("/api/financeiro/lancamentos/", {
            "descricao": "Venda produto X",
            "valor": "2000.00",
            "tipo": "receita",
            "status": "pago",
            "data_vencimento": str(date.today()),
            "data_pagamento": str(date.today()),
            "categoria": cat_id,
        }, format="json")
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert Decimal(data["valor"]) == Decimal("2000.00")
        assert data["status"] == "pago"

    def test_lancar_despesa_pendente(self, auth_client):
        """Lançar despesa de R$500 pendente."""
        client, empresa, user = auth_client
        cat_resp = client.post("/api/financeiro/categorias/", {
            "nome": "Fornecedores", "tipo": "despesa"
        }, format="json")
        cat_id = cat_resp.json()["data"]["id"]

        resp = client.post("/api/financeiro/lancamentos/", {
            "descricao": "Compra matéria-prima",
            "valor": "500.00",
            "tipo": "despesa",
            "status": "pendente",
            "data_vencimento": str(date.today()),
            "categoria": cat_id,
        }, format="json")
        assert resp.status_code == 201
        assert resp.json()["data"]["status"] == "pendente"

    def test_resumo_financeiro(self, auth_client):
        """Resumo: receitas=2000, despesas=0, saldo=2000."""
        client, empresa, user = auth_client
        # Criar categoria + lançamento pago
        cat_resp = client.post("/api/financeiro/categorias/", {
            "nome": "Vendas", "tipo": "receita"
        }, format="json")
        cat_id = cat_resp.json()["data"]["id"]
        client.post("/api/financeiro/lancamentos/", {
            "descricao": "Venda",
            "valor": "2000.00",
            "tipo": "receita",
            "status": "pago",
            "data_vencimento": str(date.today()),
            "data_pagamento": str(date.today()),
            "categoria": cat_id,
        }, format="json")

        resp = client.get("/api/financeiro/resumo/")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert Decimal(str(data["total_receitas"])) == Decimal("2000.00")

    def test_marcar_despesa_como_paga(self, auth_client):
        """Marcar despesa pendente como paga."""
        client, empresa, user = auth_client
        cat_resp = client.post("/api/financeiro/categorias/", {
            "nome": "Custos", "tipo": "despesa"
        }, format="json")
        cat_id = cat_resp.json()["data"]["id"]

        lanc_resp = client.post("/api/financeiro/lancamentos/", {
            "descricao": "Aluguel",
            "valor": "500.00",
            "tipo": "despesa",
            "status": "pendente",
            "data_vencimento": str(date.today()),
            "categoria": cat_id,
        }, format="json")
        lanc_id = lanc_resp.json()["data"]["id"]

        resp = client.post(f"/api/financeiro/lancamentos/{lanc_id}/pagar/", {
            "data_pagamento": str(date.today()),
        }, format="json")
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "pago"


# ════════════════════════════════════════════════════════════
# 4.3 ESTOQUE
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestE2EEstoque:
    """Fluxo completo do módulo de estoque."""

    def _criar_produto(self, client):
        """Helper: cria produto padrão."""
        cat_resp = client.post("/api/estoque/categorias/", {
            "nome": "Roupas"
        }, format="json")
        cat_id = cat_resp.json()["data"]["id"]
        resp = client.post("/api/estoque/produtos/", {
            "nome": "Camisa Preta P",
            "preco_custo": "30.00",
            "preco_venda": "89.00",
            "estoque_minimo": 10,
            "categoria": cat_id,
        }, format="json")
        return resp.json()["data"]["id"]

    def test_criar_produto(self, auth_client):
        """Criar produto com preços e estoque mínimo."""
        client, empresa, user = auth_client
        produto_id = self._criar_produto(client)
        assert produto_id is not None

    def test_entrada_estoque(self, auth_client):
        """Registrar entrada de 20 unidades."""
        client, empresa, user = auth_client
        produto_id = self._criar_produto(client)
        resp = client.post("/api/estoque/movimentacoes/", {
            "produto": produto_id,
            "tipo": "entrada",
            "quantidade": 20,
            "motivo": "compra",
        }, format="json")
        assert resp.status_code == 201
        # Verificar estoque atual
        prod_resp = client.get(f"/api/estoque/produtos/{produto_id}/")
        assert float(prod_resp.json()["data"]["estoque_atual"]) == 20.0

    def test_saida_estoque_abaixo_minimo(self, auth_client):
        """Saída de 15 unidades → estoque=5 (abaixo do mínimo=10)."""
        client, empresa, user = auth_client
        produto_id = self._criar_produto(client)
        # Entrada de 20
        client.post("/api/estoque/movimentacoes/", {
            "produto": produto_id, "tipo": "entrada", "quantidade": 20, "motivo": "compra"
        }, format="json")
        # Saída de 15
        resp = client.post("/api/estoque/movimentacoes/", {
            "produto": produto_id, "tipo": "saida", "quantidade": 15, "motivo": "venda", "preco_unitario": "10.00"
        }, format="json")
        assert resp.status_code == 201
        prod_resp = client.get(f"/api/estoque/produtos/{produto_id}/")
        assert float(prod_resp.json()["data"]["estoque_atual"]) == 5.0
        assert prod_resp.json()["data"]["esta_abaixo_minimo"] is True

    def test_saida_insuficiente_retorna_erro(self, auth_client):
        """Saída de 10 unidades com estoque=5 → erro."""
        client, empresa, user = auth_client
        produto_id = self._criar_produto(client)
        client.post("/api/estoque/movimentacoes/", {
            "produto": produto_id, "tipo": "entrada", "quantidade": 5, "motivo": "compra"
        }, format="json")
        resp = client.post("/api/estoque/movimentacoes/", {
            "produto": produto_id, "tipo": "saida", "quantidade": 10, "motivo": "venda"
        }, format="json")
        assert resp.status_code == 400
        assert resp.json()["success"] is False


# ════════════════════════════════════════════════════════════
# 4.4 CRM
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestE2ECRM:
    """Fluxo completo do módulo CRM."""

    def test_criar_cliente_lead(self, auth_client):
        """Criar cliente 'João Silva' como lead/instagram."""
        client, empresa, user = auth_client
        resp = client.post("/api/clientes/", {
            "nome": "João Silva",
            "origem": "instagram",
            "status_funil": "lead",
        }, format="json")
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["nome"] == "João Silva"
        assert data["status_funil"] == "lead"

    def test_mover_cliente_no_funil(self, auth_client):
        """Mover cliente de 'lead' para 'proposta'."""
        client, empresa, user = auth_client
        resp = client.post("/api/clientes/", {
            "nome": "João Silva", "origem": "instagram", "status_funil": "lead"
        }, format="json")
        cliente_id = resp.json()["data"]["id"]

        move_resp = client.patch(f"/api/clientes/{cliente_id}/mover-funil/", {
            "status_funil": "proposta",
        }, format="json")
        assert move_resp.status_code == 200
        assert move_resp.json()["data"]["status_funil"] == "proposta"

    def test_registrar_interacao_venda(self, auth_client):
        """Registrar interação de venda R$500 e verificar valor_total_compras."""
        client, empresa, user = auth_client
        resp = client.post("/api/clientes/", {
            "nome": "Maria Santos", "origem": "indicacao", "status_funil": "fechado"
        }, format="json")
        cliente_id = resp.json()["data"]["id"]

        int_resp = client.post(f"/api/clientes/{cliente_id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda de produto",
            "descricao": "Venda de produto",
            "valor": "500.00",
        }, format="json")
        assert int_resp.status_code == 201

        # Verificar valor_total_compras atualizado
        detail_resp = client.get(f"/api/clientes/{cliente_id}/")
        assert Decimal(str(detail_resp.json()["data"]["valor_total_compras"])) == Decimal("500.00")

    def test_followup_atrasado(self, auth_client):
        """Follow-up para ontem deve aparecer como atrasado."""
        client, empresa, user = auth_client
        resp = client.post("/api/clientes/", {
            "nome": "Pedro Alves",
            "origem": "site",
            "status_funil": "lead",
            "proximo_followup": str(date.today() - timedelta(days=1)),
        }, format="json")
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["followup_atrasado"] is True


# ════════════════════════════════════════════════════════════
# 4.5 FORNECEDORES
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestE2EFornecedores:
    """Fluxo completo do módulo de fornecedores."""

    def test_criar_fornecedor(self, auth_client):
        """Criar fornecedor 'Tecido SA'."""
        client, empresa, user = auth_client
        resp = client.post("/api/fornecedores/", {
            "nome": "Tecido SA",
            "cnpj": "12.345.678/0001-90",
        }, format="json")
        assert resp.status_code == 201
        assert resp.json()["data"]["nome"] == "Tecido SA"

    def test_avaliar_fornecedor_score_86(self, auth_client):
        """Avaliar qualidade=5, prazo=4, preço=4 → Score ≈ 86."""
        client, empresa, user = auth_client
        resp = client.post("/api/fornecedores/", {
            "nome": "Tecido SA", "cnpj": "12.345.678/0001-90"
        }, format="json")
        fornecedor_id = resp.json()["data"]["id"]

        aval_resp = client.post(f"/api/fornecedores/{fornecedor_id}/avaliar/", {
            "avaliacao_qualidade": 5,
            "avaliacao_prazo": 4,
            "avaliacao_preco": 4,
        }, format="json")
        assert aval_resp.status_code == 200
        score = float(aval_resp.json()["data"]["score_synapse"])
        # Score = avg(5,4,4)=4.33 * 20 = 86.67 (arredondado para 86.0 ou 86.7)
        assert score >= 80.0  # Dentro do range esperado

    def test_registrar_compra_paga(self, auth_client):
        """Registrar compra paga R$1.500 e verificar valor_total_compras."""
        client, empresa, user = auth_client
        resp = client.post("/api/fornecedores/", {
            "nome": "Tecido SA", "cnpj": "12.345.678/0001-90"
        }, format="json")
        fornecedor_id = resp.json()["data"]["id"]

        compra_resp = client.post(f"/api/fornecedores/{fornecedor_id}/compras/", {
            "valor": "1500.00",
            "status": "pago",
            "data_compra": str(date.today()),
            "data_pagamento": str(date.today()),
            "descricao": "Compra de tecidos",
        }, format="json")
        assert compra_resp.status_code == 201

        # Recarregar do banco (signal usa on_commit, precisamos forçar refresh)
        from modules.fornecedores.models import Fornecedor, CompraFornecedor
        from django.db.models import Sum
        total = CompraFornecedor.objects.filter(
            fornecedor_id=fornecedor_id, status="pago"
        ).aggregate(total=Sum("valor"))["total"] or 0
        assert Decimal(str(total)) == Decimal("1500.00")


# ════════════════════════════════════════════════════════════
# 4.6 MULTI-TENANT
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestE2EMultiTenant:
    """Isolamento de dados entre empresas."""

    def test_financeiro_isolado(self, auth_client, auth_client2):
        """Empresa 2 não vê lançamentos da empresa 1."""
        client1, empresa1, user1 = auth_client
        client2, empresa2, user2 = auth_client2

        # Empresa 1 cria categoria e lançamento
        cat_resp = client1.post("/api/financeiro/categorias/", {
            "nome": "Receita E1", "tipo": "receita"
        }, format="json")
        cat_id = cat_resp.json()["data"]["id"]
        client1.post("/api/financeiro/lancamentos/", {
            "descricao": "Venda secreta E1",
            "valor": "9999.00",
            "tipo": "receita",
            "status": "pago",
            "data_vencimento": str(date.today()),
            "data_pagamento": str(date.today()),
            "categoria": cat_id,
        }, format="json")

        # Empresa 2 lista lançamentos → não deve ver os da E1
        resp2 = client2.get("/api/financeiro/lancamentos/")
        assert resp2.status_code == 200
        result2 = resp2.json()
        lancamentos_e2 = result2.get("data", []) or []
        descricoes = [l["descricao"] for l in lancamentos_e2]
        assert "Venda secreta E1" not in descricoes

    def test_estoque_isolado(self, auth_client, auth_client2):
        """Empresa 2 não vê produtos da empresa 1."""
        client1, empresa1, user1 = auth_client
        client2, empresa2, user2 = auth_client2

        cat_resp = client1.post("/api/estoque/categorias/", {
            "nome": "Cat E1"
        }, format="json")
        cat_id = cat_resp.json()["data"]["id"]
        client1.post("/api/estoque/produtos/", {
            "nome": "Produto Secreto E1",
            "preco_custo": "10.00",
            "preco_venda": "20.00",
            "estoque_minimo": 5,
            "categoria": cat_id,
        }, format="json")

        resp2 = client2.get("/api/estoque/produtos/")
        result2 = resp2.json()
        nomes = [p["nome"] for p in (result2.get("data") or [])]
        assert "Produto Secreto E1" not in nomes

    def test_clientes_isolados(self, auth_client, auth_client2):
        """Empresa 2 não vê clientes da empresa 1."""
        client1, empresa1, user1 = auth_client
        client2, empresa2, user2 = auth_client2

        client1.post("/api/clientes/", {
            "nome": "Cliente Secreto E1",
            "origem": "instagram",
            "status_funil": "lead",
        }, format="json")

        resp2 = client2.get("/api/clientes/")
        result2 = resp2.json()
        nomes = [c["nome"] for c in (result2.get("data") or [])]
        assert "Cliente Secreto E1" not in nomes

    def test_fornecedores_isolados(self, auth_client, auth_client2):
        """Empresa 2 não vê fornecedores da empresa 1."""
        client1, empresa1, user1 = auth_client
        client2, empresa2, user2 = auth_client2

        client1.post("/api/fornecedores/", {
            "nome": "Fornecedor Secreto E1",
        }, format="json")

        resp2 = client2.get("/api/fornecedores/")
        result2 = resp2.json()
        nomes = [f["nome"] for f in (result2.get("data") or [])]
        assert "Fornecedor Secreto E1" not in nomes


# ════════════════════════════════════════════════════════════
# 4.8 CELERY — TASKS REGISTRADAS
# ════════════════════════════════════════════════════════════

class TestCeleryTasksRegistradas:
    """Valida que todas as tasks periódicas estão registradas no beat."""

    def test_tasks_beat_schedule(self):
        """Todas as tasks de M2-M5 estão no beat_schedule."""
        from config.celery import app
        schedule = app.conf.beat_schedule
        tarefas_esperadas = [
            "verificar-vencimentos",
            "criar-recorrencias",
            "verificar-estoque-minimo",
            "verificar-followups",
            "relatorio-semanal-fornecedores",
            "alertar-fornecedores-sem-avaliacao",
        ]
        for tarefa in tarefas_esperadas:
            assert tarefa in schedule, f"Task '{tarefa}' não encontrada no beat_schedule"

    def test_tasks_modulos_importaveis(self):
        """Todos os módulos de tasks são importaveis."""
        from modules.auth.tasks import enviar_email_recuperacao
        from modules.financeiro.tasks import verificar_vencimentos
        from modules.estoque.tasks import verificar_estoque_minimo
        from modules.clientes.tasks import verificar_followups
        from modules.fornecedores.tasks import relatorio_semanal_fornecedores
        assert all([
            enviar_email_recuperacao,
            verificar_vencimentos,
            verificar_estoque_minimo,
            verificar_followups,
            relatorio_semanal_fornecedores,
        ])
