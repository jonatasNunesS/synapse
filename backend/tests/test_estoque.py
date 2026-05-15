"""
Testes do M3 — Controle de Estoque
Cobertura: happy path, dados inválidos, acesso negado, multi-tenant,
movimentações atômicas, alertas de estoque crítico.
"""
import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework.test import APIClient


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    from modules.auth.models import Empresa
    return Empresa.objects.create(nome="Empresa A", plano="basico")


@pytest.fixture
def empresa_b(db):
    from modules.auth.models import Empresa
    return Empresa.objects.create(nome="Empresa B", plano="basico")


@pytest.fixture
def usuario_a(db, empresa_a):
    from modules.auth.models import CustomUser
    return CustomUser.objects.create_user(
        email="admin@empresa-a.com",
        senha="Senha@123",
        nome="Admin A",
        empresa=empresa_a,
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    from modules.auth.models import CustomUser
    return CustomUser.objects.create_user(
        email="admin@empresa-b.com",
        senha="Senha@123",
        nome="Admin B",
        empresa=empresa_b,
    )


@pytest.fixture
def client_a(usuario_a):
    client = APIClient()
    client.force_authenticate(user=usuario_a)
    return client


@pytest.fixture
def client_b(usuario_b):
    client = APIClient()
    client.force_authenticate(user=usuario_b)
    return client


@pytest.fixture
def categoria_a(db, empresa_a):
    from modules.estoque.models import CategoriaEstoque
    return CategoriaEstoque.objects.create(
        empresa=empresa_a,
        nome="Camisas",
        cor="#6D28D9",
    )


@pytest.fixture
def produto_a(db, empresa_a, categoria_a, usuario_a):
    from modules.estoque.models import Produto
    return Produto.objects.create(
        empresa=empresa_a,
        categoria=categoria_a,
        nome="Camisa Preta G",
        sku="CAM-001",
        preco_custo=Decimal("30.00"),
        preco_venda=Decimal("79.90"),
        estoque_atual=Decimal("10"),
        estoque_minimo=Decimal("5"),
        criado_por=usuario_a,
    )


@pytest.fixture
def produto_zerado(db, empresa_a, categoria_a, usuario_a):
    from modules.estoque.models import Produto
    return Produto.objects.create(
        empresa=empresa_a,
        categoria=categoria_a,
        nome="Cinto",
        sku="CIN-001",
        preco_custo=Decimal("20.00"),
        preco_venda=Decimal("49.90"),
        estoque_atual=Decimal("0"),
        estoque_minimo=Decimal("3"),
        criado_por=usuario_a,
    )


# ─── Testes: Categorias ───────────────────────────────────────────────────────

class TestCategoriaEstoque:
    def test_listar_categorias(self, client_a, categoria_a):
        resp = client_a.get("/api/estoque/categorias/")
        assert resp.status_code == 200
        assert resp.data["success"] is True
        assert len(resp.data["data"]) >= 1

    def test_criar_categoria(self, client_a, empresa_a):
        resp = client_a.post("/api/estoque/categorias/", {
            "nome": "Acessórios",
            "cor": "#059669",
        })
        assert resp.status_code == 201
        assert resp.data["data"]["nome"] == "Acessórios"

    def test_criar_categoria_nome_duplicado(self, client_a, categoria_a):
        resp = client_a.post("/api/estoque/categorias/", {
            "nome": "Camisas",  # já existe
        })
        assert resp.status_code == 400
        assert resp.data["success"] is False

    def test_obter_categoria(self, client_a, categoria_a):
        resp = client_a.get(f"/api/estoque/categorias/{categoria_a.id}/")
        assert resp.status_code == 200
        assert resp.data["data"]["nome"] == "Camisas"

    def test_atualizar_categoria(self, client_a, categoria_a):
        resp = client_a.patch(f"/api/estoque/categorias/{categoria_a.id}/", {
            "nome": "Camisas Premium",
        })
        assert resp.status_code == 200
        assert resp.data["data"]["nome"] == "Camisas Premium"

    def test_deletar_categoria(self, client_a, categoria_a):
        resp = client_a.delete(f"/api/estoque/categorias/{categoria_a.id}/")
        assert resp.status_code == 200

    def test_multi_tenant_categoria(self, client_b, categoria_a):
        """Empresa B não pode ver/editar categorias da Empresa A."""
        resp = client_b.get(f"/api/estoque/categorias/{categoria_a.id}/")
        assert resp.status_code == 404

    def test_acesso_negado_sem_auth(self):
        client = APIClient()
        resp = client.get("/api/estoque/categorias/")
        assert resp.status_code == 401


# ─── Testes: Produtos ─────────────────────────────────────────────────────────

class TestProduto:
    def test_listar_produtos(self, client_a, produto_a):
        resp = client_a.get("/api/estoque/produtos/")
        assert resp.status_code == 200
        assert resp.data["success"] is True
        assert len(resp.data["data"]) >= 1

    def test_criar_produto(self, client_a, categoria_a):
        resp = client_a.post("/api/estoque/produtos/", {
            "nome": "Calça Jeans",
            "sku": "CAL-001",
            "preco_custo": "50.00",
            "preco_venda": "129.90",
            "estoque_minimo": "3",
            "categoria": str(categoria_a.id),
        })
        assert resp.status_code == 201
        assert resp.data["data"]["nome"] == "Calça Jeans"

    def test_criar_produto_preco_negativo(self, client_a):
        resp = client_a.post("/api/estoque/produtos/", {
            "nome": "Produto Inválido",
            "preco_custo": "-10.00",
            "preco_venda": "50.00",
        })
        assert resp.status_code == 400

    def test_obter_produto_detalhe(self, client_a, produto_a):
        resp = client_a.get(f"/api/estoque/produtos/{produto_a.id}/")
        assert resp.status_code == 200
        data = resp.data["data"]
        assert data["nome"] == "Camisa Preta G"
        assert "margem_lucro" in data
        assert "status_estoque" in data
        assert "variacoes" in data

    def test_produto_margem_lucro(self, client_a, produto_a):
        resp = client_a.get(f"/api/estoque/produtos/{produto_a.id}/")
        data = resp.data["data"]
        # margem = (79.90 - 30.00) / 30.00 * 100 ≈ 166.33%
        assert data["margem_lucro"] is not None
        assert data["margem_lucro"] > 100

    def test_atualizar_produto(self, client_a, produto_a):
        resp = client_a.patch(f"/api/estoque/produtos/{produto_a.id}/", {
            "preco_venda": "89.90",
        })
        assert resp.status_code == 200
        assert resp.data["data"]["preco_venda"] == "89.90"

    def test_deletar_produto(self, client_a, produto_a):
        resp = client_a.delete(f"/api/estoque/produtos/{produto_a.id}/")
        assert resp.status_code == 200

    def test_multi_tenant_produto(self, client_b, produto_a):
        """Empresa B não pode ver produtos da Empresa A."""
        resp = client_b.get(f"/api/estoque/produtos/{produto_a.id}/")
        assert resp.status_code == 404

    def test_filtrar_por_categoria(self, client_a, produto_a, categoria_a):
        resp = client_a.get(f"/api/estoque/produtos/?categoria_id={categoria_a.id}")
        assert resp.status_code == 200
        assert len(resp.data["data"]) >= 1

    def test_buscar_produto_por_nome(self, client_a, produto_a):
        resp = client_a.get("/api/estoque/produtos/?busca=Camisa")
        assert resp.status_code == 200
        assert len(resp.data["data"]) >= 1

    def test_buscar_produto_por_sku(self, client_a, produto_a):
        resp = client_a.get("/api/estoque/produtos/?busca=CAM-001")
        assert resp.status_code == 200
        assert len(resp.data["data"]) >= 1

    def test_paginacao_produtos(self, client_a, empresa_a, categoria_a, usuario_a):
        from modules.estoque.models import Produto
        # Criar 30 produtos
        for i in range(30):
            Produto.objects.create(
                empresa=empresa_a,
                nome=f"Produto {i:03d}",
                preco_custo=10,
                preco_venda=20,
                criado_por=usuario_a,
            )
        resp = client_a.get("/api/estoque/produtos/")
        assert resp.status_code == 200
        # Paginação máx 25
        assert len(resp.data["data"]) <= 25
        assert "pagination" in resp.data


# ─── Testes: Movimentações ────────────────────────────────────────────────────

class TestMovimentacao:
    def test_entrada_estoque(self, client_a, produto_a):
        """Registrar entrada aumenta o estoque."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "entrada",
            "quantidade": "5",
            "motivo": "compra",
        })
        assert resp.status_code == 201
        assert resp.data["success"] is True
        # Estoque era 10, entrada de 5 → 15
        assert float(resp.data["data"]["produto"]["estoque_atual"]) == 15.0

    def test_saida_estoque(self, client_a, produto_a):
        """Registrar saída diminui o estoque."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "saida",
            "quantidade": "3",
            "motivo": "venda",
        })
        assert resp.status_code == 201
        # Estoque era 10, saída de 3 → 7
        assert float(resp.data["data"]["produto"]["estoque_atual"]) == 7.0

    def test_saida_maior_que_estoque(self, client_a, produto_a):
        """Saída maior que estoque deve retornar erro."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "saida",
            "quantidade": "100",  # estoque é 10
            "motivo": "venda",
        })
        assert resp.status_code == 400
        assert resp.data["success"] is False

    def test_ajuste_estoque(self, client_a, produto_a):
        """Ajuste pode ser positivo."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "ajuste",
            "quantidade": "2",
            "motivo": "inventario",
        })
        assert resp.status_code == 201

    def test_movimentacao_quantidade_zero(self, client_a, produto_a):
        """Quantidade zero deve retornar erro."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "entrada",
            "quantidade": "0",
            "motivo": "compra",
        })
        assert resp.status_code == 400

    def test_movimentacao_quantidade_negativa(self, client_a, produto_a):
        """Quantidade negativa deve retornar erro."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "entrada",
            "quantidade": "-5",
            "motivo": "compra",
        })
        assert resp.status_code == 400

    def test_movimentacao_imutavel_update(self, client_a, produto_a):
        """Movimentação não pode ser editada."""
        # Criar movimentação
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "entrada",
            "quantidade": "1",
            "motivo": "compra",
        })
        assert resp.status_code == 201
        mov_id = resp.data["data"]["movimentacao"]["id"]
        # Tentar editar
        resp2 = client_a.patch(f"/api/estoque/movimentacoes/{mov_id}/", {
            "quantidade": "999",
        })
        assert resp2.status_code == 405

    def test_movimentacao_imutavel_delete(self, client_a, produto_a):
        """Movimentação não pode ser deletada."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "entrada",
            "quantidade": "1",
            "motivo": "compra",
        })
        assert resp.status_code == 201
        mov_id = resp.data["data"]["movimentacao"]["id"]
        resp2 = client_a.delete(f"/api/estoque/movimentacoes/{mov_id}/")
        assert resp2.status_code == 405

    def test_historico_movimentacoes_produto(self, client_a, produto_a):
        """Histórico de movimentações do produto."""
        # Criar algumas movimentações
        client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "entrada",
            "quantidade": "5",
            "motivo": "compra",
        })
        resp = client_a.get(f"/api/estoque/produtos/{produto_a.id}/movimentacoes/")
        assert resp.status_code == 200
        assert len(resp.data["data"]) >= 1

    def test_historico_campos_estoque_antes_depois(self, client_a, produto_a):
        """Histórico deve mostrar estoque antes e depois."""
        resp = client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "saida",
            "quantidade": "2",
            "motivo": "venda",
        })
        assert resp.status_code == 201
        mov = resp.data["data"]["movimentacao"]
        assert "estoque_antes" in mov
        assert "estoque_depois" in mov
        assert float(mov["estoque_antes"]) == 10.0
        assert float(mov["estoque_depois"]) == 8.0

    def test_multi_tenant_movimentacao(self, client_b, produto_a):
        """Empresa B não pode movimentar produto da Empresa A."""
        resp = client_b.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "entrada",
            "quantidade": "5",
            "motivo": "compra",
        })
        # Deve falhar pois o produto não pertence à empresa B
        assert resp.status_code in [400, 404]


# ─── Testes: Alertas e Resumo ─────────────────────────────────────────────────

class TestAlertasResumo:
    def test_resumo_estoque(self, client_a, produto_a, produto_zerado):
        resp = client_a.get("/api/estoque/resumo/")
        assert resp.status_code == 200
        data = resp.data["data"]
        assert "total_produtos" in data
        assert "valor_total_estoque" in data
        assert "produtos_sem_estoque" in data
        assert "produtos_abaixo_minimo" in data

    def test_alertas_estoque_baixo(self, client_a, produto_a):
        """Produto com estoque abaixo do mínimo aparece nos alertas."""
        # Produto tem estoque 10, mínimo 5 — OK
        # Fazer saída para deixar abaixo do mínimo
        client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "saida",
            "quantidade": "8",  # 10 - 8 = 2, abaixo do mínimo 5
            "motivo": "venda",
        })
        resp = client_a.get("/api/estoque/alertas/")
        assert resp.status_code == 200
        ids = [str(p["id"]) for p in resp.data["data"]]
        assert str(produto_a.id) in ids

    def test_alertas_produto_zerado(self, client_a, produto_zerado):
        """Produto com estoque zerado aparece nos alertas."""
        resp = client_a.get("/api/estoque/alertas/")
        assert resp.status_code == 200
        ids = [str(p["id"]) for p in resp.data["data"]]
        assert str(produto_zerado.id) in ids

    def test_multi_tenant_resumo(self, client_b, produto_a):
        """Resumo da Empresa B não inclui dados da Empresa A."""
        resp = client_b.get("/api/estoque/resumo/")
        assert resp.status_code == 200
        assert resp.data["data"]["total_produtos"] == 0

    def test_relatorio_estoque(self, client_a, produto_a):
        resp = client_a.get("/api/estoque/relatorio/")
        assert resp.status_code == 200
        data = resp.data["data"]
        assert "total_produtos" in data
        assert "giro_medio" in data

    def test_status_estoque_ok(self, client_a, produto_a):
        """Produto com estoque acima do mínimo tem status 'ok'."""
        resp = client_a.get(f"/api/estoque/produtos/{produto_a.id}/")
        # estoque_atual=10, estoque_minimo=5 → ok
        assert resp.data["data"]["status_estoque"] == "ok"

    def test_status_estoque_zerado(self, client_a, produto_zerado):
        """Produto com estoque zerado tem status 'zerado'."""
        resp = client_a.get(f"/api/estoque/produtos/{produto_zerado.id}/")
        assert resp.data["data"]["status_estoque"] == "zerado"

    def test_status_estoque_baixo(self, client_a, produto_a):
        """Produto com estoque abaixo do mínimo tem status 'baixo'."""
        # Fazer saída para deixar abaixo do mínimo (10 - 8 = 2, mínimo=5)
        client_a.post("/api/estoque/movimentacoes/", {
            "produto": str(produto_a.id),
            "tipo": "saida",
            "quantidade": "8",
            "motivo": "venda",
        })
        resp = client_a.get(f"/api/estoque/produtos/{produto_a.id}/")
        assert resp.data["data"]["status_estoque"] == "baixo"


# ─── Testes: Cenário Completo (Roteiro do Fundador) ───────────────────────────

class TestCenarioCompleto:
    def test_roteiro_fundador_completo(self, client_a, empresa_a, usuario_a):
        """
        Reproduz o roteiro de teste do Fundador:
        1. Criar categorias
        2. Criar produto com estoque mínimo
        3. Registrar entrada
        4. Registrar saída deixando abaixo do mínimo
        5. Ver alerta
        6. Ver resumo
        7. Ver histórico
        8. Tentar saída maior que estoque → erro
        """
        # 1. Criar categorias
        r1 = client_a.post("/api/estoque/categorias/", {"nome": "Camisas"})
        assert r1.status_code == 201
        r2 = client_a.post("/api/estoque/categorias/", {"nome": "Acessórios"})
        assert r2.status_code == 201

        # 2. Criar produto com estoque mínimo 5
        r3 = client_a.post("/api/estoque/produtos/", {
            "nome": "Camisa Preta G",
            "sku": "CAM-ROTEIRO-001",
            "preco_custo": "30.00",
            "preco_venda": "79.90",
            "estoque_minimo": "5",
            "categoria": str(r1.data["data"]["id"]),
        })
        assert r3.status_code == 201
        produto_id = r3.data["data"]["id"]

        # 3. Registrar entrada de 10 unidades
        r4 = client_a.post("/api/estoque/movimentacoes/", {
            "produto": produto_id,
            "tipo": "entrada",
            "quantidade": "10",
            "motivo": "compra",
        })
        assert r4.status_code == 201
        assert float(r4.data["data"]["produto"]["estoque_atual"]) == 10.0

        # 4. Registrar saída de 8 unidades (estoque fica em 2 — abaixo do mínimo 5)
        r5 = client_a.post("/api/estoque/movimentacoes/", {
            "produto": produto_id,
            "tipo": "saida",
            "quantidade": "8",
            "motivo": "venda",
        })
        assert r5.status_code == 201
        assert float(r5.data["data"]["produto"]["estoque_atual"]) == 2.0

        # 5. Ver alerta de estoque baixo
        r6 = client_a.get("/api/estoque/alertas/")
        assert r6.status_code == 200
        ids = [str(p["id"]) for p in r6.data["data"]]
        assert str(produto_id) in ids

        # 6. Ver resumo
        r7 = client_a.get("/api/estoque/resumo/")
        assert r7.status_code == 200
        assert r7.data["data"]["produtos_abaixo_minimo"] >= 1

        # 7. Ver histórico
        r8 = client_a.get(f"/api/estoque/produtos/{produto_id}/movimentacoes/")
        assert r8.status_code == 200
        assert len(r8.data["data"]) == 2  # entrada + saída

        # 8. Tentar saída maior que estoque → erro claro
        r9 = client_a.post("/api/estoque/movimentacoes/", {
            "produto": produto_id,
            "tipo": "saida",
            "quantidade": "100",
            "motivo": "venda",
        })
        assert r9.status_code == 400
        assert r9.data["success"] is False
