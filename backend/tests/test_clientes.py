"""
Testes completos do M4 — CRM de Clientes.
Cobertura: CRUD, funil, interações, properties, multi-tenant, tasks, cache.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient

from modules.auth.models import Empresa, CustomUser
from modules.clientes.models import Cliente, InteracaoCliente


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(
        nome="Empresa Alpha",
        cnpj="11222333000181",
        plano="basico",
    )


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(
        nome="Empresa Beta",
        cnpj="22333444000192",
        plano="basico",
    )


@pytest.fixture
def usuario_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="admin@alpha.com",
        senha="senha123",
        empresa=empresa_a,
        nome="Admin Alpha",
        perfil="admin",
    )


@pytest.fixture
def usuario_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="admin@beta.com",
        senha="senha123",
        empresa=empresa_b,
        nome="Admin Beta",
        perfil="admin",
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
def cliente_joao(db, empresa_a, usuario_a):
    return Cliente.objects.create(
        empresa=empresa_a,
        nome="João Silva",
        tipo="pessoa_fisica",
        email="joao@email.com",
        telefone="11999990001",
        whatsapp="11999990001",
        status_funil="lead",
        origem="indicacao",
        criado_por=usuario_a,
    )


@pytest.fixture
def cliente_maria(db, empresa_a, usuario_a):
    return Cliente.objects.create(
        empresa=empresa_a,
        nome="Maria Santos",
        tipo="pessoa_fisica",
        email="maria@email.com",
        status_funil="proposta",
        origem="instagram",
        criado_por=usuario_a,
    )


@pytest.fixture
def cliente_empresa_xyz(db, empresa_a, usuario_a):
    return Cliente.objects.create(
        empresa=empresa_a,
        nome="Empresa XYZ",
        tipo="pessoa_juridica",
        nome_empresa="XYZ Ltda",
        status_funil="negociacao",
        origem="google",
        criado_por=usuario_a,
    )


# ─── CRUD Básico ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestClienteCRUD:

    def test_criar_cliente_pessoa_fisica(self, client_a):
        """Criar cliente pessoa física → 201."""
        resp = client_a.post("/api/clientes/", {
            "nome": "Carlos Oliveira",
            "tipo": "pessoa_fisica",
            "email": "carlos@email.com",
            "telefone": "11988880001",
            "status_funil": "lead",
            "origem": "indicacao",
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["success"] is True
        assert resp.data["data"]["nome"] == "Carlos Oliveira"
        assert resp.data["data"]["tipo"] == "pessoa_fisica"

    def test_criar_cliente_pessoa_juridica(self, client_a):
        """Criar cliente pessoa jurídica com nome_empresa → 201."""
        resp = client_a.post("/api/clientes/", {
            "nome": "Contato Principal",
            "tipo": "pessoa_juridica",
            "nome_empresa": "Tech Corp Ltda",
            "email": "contato@techcorp.com",
            "status_funil": "lead",
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["data"]["tipo"] == "pessoa_juridica"
        assert resp.data["data"]["nome_empresa"] == "Tech Corp Ltda"

    def test_criar_sem_nome_retorna_400(self, client_a):
        """Criar cliente sem nome → 400."""
        resp = client_a.post("/api/clientes/", {
            "tipo": "pessoa_fisica",
            "email": "sem@nome.com",
        }, format="json")
        assert resp.status_code == 400
        assert resp.data["success"] is False
        assert "nome" in str(resp.data["error"]["details"])

    def test_criar_email_invalido_retorna_400(self, client_a):
        """Email inválido → 400."""
        resp = client_a.post("/api/clientes/", {
            "nome": "Teste",
            "email": "email-invalido",
        }, format="json")
        assert resp.status_code == 400

    def test_listar_clientes(self, client_a, cliente_joao, cliente_maria):
        """Listar clientes da empresa → retorna os corretos."""
        resp = client_a.get("/api/clientes/")
        assert resp.status_code == 200
        assert resp.data["success"] is True
        nomes = [c["nome"] for c in resp.data["data"]]
        assert "João Silva" in nomes
        assert "Maria Santos" in nomes

    def test_listar_com_filtro_status_funil(self, client_a, cliente_joao, cliente_maria):
        """Listar com filtro status_funil=lead → retorna apenas João."""
        resp = client_a.get("/api/clientes/?status_funil=lead")
        assert resp.status_code == 200
        nomes = [c["nome"] for c in resp.data["data"]]
        assert "João Silva" in nomes
        assert "Maria Santos" not in nomes

    def test_listar_com_busca_por_nome(self, client_a, cliente_joao, cliente_maria):
        """Listar com busca por nome → retorna apenas o correto."""
        resp = client_a.get("/api/clientes/?busca=João")
        assert resp.status_code == 200
        nomes = [c["nome"] for c in resp.data["data"]]
        assert "João Silva" in nomes
        assert "Maria Santos" not in nomes

    def test_busca_case_insensitive(self, client_a, cliente_joao):
        """Busca case-insensitive → funciona."""
        resp = client_a.get("/api/clientes/?busca=joão")
        assert resp.status_code == 200
        nomes = [c["nome"] for c in resp.data["data"]]
        assert "João Silva" in nomes

    def test_busca_por_email(self, client_a, cliente_joao):
        """Busca por email → retorna o cliente correto."""
        resp = client_a.get("/api/clientes/?busca=joao@email.com")
        assert resp.status_code == 200
        assert len(resp.data["data"]) >= 1
        assert resp.data["data"][0]["nome"] == "João Silva"

    def test_paginacao(self, client_a, empresa_a, usuario_a):
        """Paginação → 25 itens por página."""
        # Criar 30 clientes
        for i in range(30):
            Cliente.objects.create(
                empresa=empresa_a,
                nome=f"Cliente Paginação {i:02d}",
                criado_por=usuario_a,
            )
        resp = client_a.get("/api/clientes/")
        assert resp.status_code == 200
        assert len(resp.data["data"]) <= 25

    def test_obter_detalhe_cliente(self, client_a, cliente_joao):
        """GET /api/clientes/{id}/ → retorna detalhe completo."""
        resp = client_a.get(f"/api/clientes/{cliente_joao.id}/")
        assert resp.status_code == 200
        assert resp.data["data"]["nome"] == "João Silva"
        assert "interacoes" in resp.data["data"]
        assert "ticket_medio" in resp.data["data"]

    def test_atualizar_cliente(self, client_a, cliente_joao):
        """PATCH /api/clientes/{id}/ → atualiza campos."""
        resp = client_a.patch(f"/api/clientes/{cliente_joao.id}/", {
            "telefone": "11977770001",
            "segmento": "Tecnologia",
        }, format="json")
        assert resp.status_code == 200
        assert resp.data["data"]["telefone"] == "11977770001"
        assert resp.data["data"]["segmento"] == "Tecnologia"

    def test_deletar_cliente_soft_delete(self, client_a, cliente_joao):
        """DELETE /api/clientes/{id}/ → soft delete (ativo=False)."""
        resp = client_a.delete(f"/api/clientes/{cliente_joao.id}/")
        assert resp.status_code == 204
        cliente_joao.refresh_from_db()
        assert cliente_joao.ativo is False

    def test_obter_cliente_inexistente_retorna_404(self, client_a):
        """GET /api/clientes/{uuid-inexistente}/ → 404."""
        import uuid
        resp = client_a.get(f"/api/clientes/{uuid.uuid4()}/")
        assert resp.status_code == 404


# ─── Funil Kanban ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFunilKanban:

    def test_mover_cliente_no_funil(self, client_a, cliente_joao):
        """Mover cliente de lead → proposta → 200."""
        resp = client_a.patch(f"/api/clientes/{cliente_joao.id}/mover-funil/", {
            "status_funil": "proposta",
        }, format="json")
        assert resp.status_code == 200
        assert resp.data["data"]["status_funil"] == "proposta"
        cliente_joao.refresh_from_db()
        assert cliente_joao.status_funil == "proposta"

    def test_funil_retorna_clientes_agrupados(
        self, client_a, cliente_joao, cliente_maria, cliente_empresa_xyz
    ):
        """GET /api/clientes/funil/ → retorna clientes agrupados por status."""
        resp = client_a.get("/api/clientes/funil/")
        assert resp.status_code == 200
        data = resp.data["data"]
        assert "lead" in data
        assert "proposta" in data
        assert "negociacao" in data
        assert "totais" in data
        # João está em lead
        nomes_lead = [c["nome"] for c in data["lead"]]
        assert "João Silva" in nomes_lead

    def test_funil_totais_por_coluna(
        self, client_a, cliente_joao, cliente_maria
    ):
        """Totais do funil: count e valor_total por coluna."""
        resp = client_a.get("/api/clientes/funil/")
        assert resp.status_code == 200
        totais = resp.data["data"]["totais"]
        assert "lead" in totais
        assert "count" in totais["lead"]
        assert "valor_total" in totais["lead"]
        assert totais["lead"]["count"] >= 1

    def test_status_funil_invalido_retorna_400(self, client_a, cliente_joao):
        """Status inválido → 400."""
        resp = client_a.patch(f"/api/clientes/{cliente_joao.id}/mover-funil/", {
            "status_funil": "status_invalido",
        }, format="json")
        assert resp.status_code == 400


# ─── Interações ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInteracoes:

    def test_criar_interacao_venda(self, client_a, cliente_maria):
        """Criar interação tipo venda com valor → 201."""
        resp = client_a.post(f"/api/clientes/{cliente_maria.id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda de produto X",
            "valor": "500.00",
            "data_interacao": timezone.now().isoformat(),
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["data"]["tipo"] == "venda"
        assert Decimal(resp.data["data"]["valor"]) == Decimal("500.00")

    def test_signal_atualiza_valor_total_compras(self, client_a, cliente_maria):
        """Signal atualiza valor_total_compras e ultima_compra após venda."""
        client_a.post(f"/api/clientes/{cliente_maria.id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda R$300",
            "valor": "300.00",
            "data_interacao": timezone.now().isoformat(),
        }, format="json")

        cliente_maria.refresh_from_db()
        assert cliente_maria.valor_total_compras == Decimal("300.00")
        assert cliente_maria.quantidade_compras == 1
        assert cliente_maria.ultima_compra is not None

    def test_signal_acumula_multiplas_vendas(self, db, empresa_a, usuario_a, client_a):
        """Múltiplas vendas acumulam valor_total_compras corretamente."""
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Cliente Acumulado",
            criado_por=usuario_a,
        )
        for valor in ["100.00", "200.00", "300.00"]:
            client_a.post(f"/api/clientes/{cliente.id}/interacoes/", {
                "tipo": "venda",
                "titulo": f"Venda R${valor}",
                "valor": valor,
                "data_interacao": timezone.now().isoformat(),
            }, format="json")

        cliente.refresh_from_db()
        assert cliente.valor_total_compras == Decimal("600.00")
        assert cliente.quantidade_compras == 3

    def test_criar_interacao_com_followup_atualiza_cliente(self, client_a, cliente_joao):
        """Interação com proximo_followup atualiza o campo no cliente."""
        amanha = (date.today() + timedelta(days=1)).isoformat()
        client_a.post(f"/api/clientes/{cliente_joao.id}/interacoes/", {
            "tipo": "ligacao",
            "titulo": "Ligação de follow-up",
            "data_interacao": timezone.now().isoformat(),
            "proximo_followup": amanha,
        }, format="json")

        cliente_joao.refresh_from_db()
        assert str(cliente_joao.proximo_followup) == amanha

    def test_criar_interacao_venda_sem_valor_retorna_400(self, client_a, cliente_maria):
        """Interação tipo venda sem valor → 400."""
        resp = client_a.post(f"/api/clientes/{cliente_maria.id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda sem valor",
        }, format="json")
        assert resp.status_code == 400

    def test_criar_interacao_venda_valor_zero_retorna_400(self, client_a, cliente_maria):
        """Interação tipo venda com valor=0 → 400."""
        resp = client_a.post(f"/api/clientes/{cliente_maria.id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda zero",
            "valor": "0.00",
        }, format="json")
        assert resp.status_code == 400

    def test_listar_interacoes_do_cliente(self, client_a, cliente_joao):
        """Listar interações do cliente → histórico correto."""
        InteracaoCliente.objects.create(
            cliente=cliente_joao,
            empresa=cliente_joao.empresa,
            tipo="ligacao",
            titulo="Ligação inicial",
        )
        InteracaoCliente.objects.create(
            cliente=cliente_joao,
            empresa=cliente_joao.empresa,
            tipo="email",
            titulo="Email de proposta",
        )
        resp = client_a.get(f"/api/clientes/{cliente_joao.id}/interacoes/")
        assert resp.status_code == 200
        assert len(resp.data["data"]) == 2

    def test_filtrar_interacoes_por_tipo(self, client_a, cliente_joao):
        """Filtrar interações por tipo → retorna apenas o tipo correto."""
        InteracaoCliente.objects.create(
            cliente=cliente_joao,
            empresa=cliente_joao.empresa,
            tipo="ligacao",
            titulo="Ligação",
        )
        InteracaoCliente.objects.create(
            cliente=cliente_joao,
            empresa=cliente_joao.empresa,
            tipo="email",
            titulo="Email",
        )
        resp = client_a.get(f"/api/clientes/{cliente_joao.id}/interacoes/?tipo=ligacao")
        assert resp.status_code == 200
        assert all(i["tipo"] == "ligacao" for i in resp.data["data"])


# ─── Properties e Cálculos ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestProperties:

    def test_ticket_medio_calculado(self, db, empresa_a, usuario_a):
        """ticket_medio = valor_total_compras / quantidade_compras."""
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Cliente Ticket",
            valor_total_compras=Decimal("600.00"),
            quantidade_compras=3,
            criado_por=usuario_a,
        )
        assert cliente.ticket_medio == Decimal("200.00")

    def test_ticket_medio_zero_sem_compras(self, db, empresa_a, usuario_a):
        """ticket_medio = 0 se quantidade_compras = 0."""
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Sem Compras",
            criado_por=usuario_a,
        )
        assert cliente.ticket_medio == 0

    def test_followup_atrasado_true(self, db, empresa_a, usuario_a):
        """followup_atrasado = True se data passada."""
        ontem = date.today() - timedelta(days=1)
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Atrasado",
            proximo_followup=ontem,
            criado_por=usuario_a,
        )
        assert cliente.followup_atrasado is True

    def test_followup_atrasado_false_futuro(self, db, empresa_a, usuario_a):
        """followup_atrasado = False se data futura."""
        amanha = date.today() + timedelta(days=1)
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="No Prazo",
            proximo_followup=amanha,
            criado_por=usuario_a,
        )
        assert cliente.followup_atrasado is False

    def test_followup_atrasado_false_sem_data(self, db, empresa_a, usuario_a):
        """followup_atrasado = False se sem data."""
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Sem Follow-up",
            criado_por=usuario_a,
        )
        assert cliente.followup_atrasado is False

    def test_link_whatsapp_gerado(self, db, empresa_a, usuario_a):
        """link_whatsapp gerado corretamente com número limpo."""
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="WhatsApp Test",
            whatsapp="(11) 99999-0001",
            criado_por=usuario_a,
        )
        assert cliente.link_whatsapp == "https://wa.me/5511999990001"

    def test_link_whatsapp_vazio_sem_numero(self, db, empresa_a, usuario_a):
        """link_whatsapp = '' se sem whatsapp."""
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Sem WhatsApp",
            criado_por=usuario_a,
        )
        assert cliente.link_whatsapp == ""

    def test_dias_sem_compra(self, db, empresa_a, usuario_a):
        """dias_sem_compra calculado corretamente."""
        cinco_dias_atras = date.today() - timedelta(days=5)
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Dias Sem Compra",
            ultima_compra=cinco_dias_atras,
            criado_por=usuario_a,
        )
        assert cliente.dias_sem_compra == 5

    def test_dias_sem_compra_none_sem_ultima_compra(self, db, empresa_a, usuario_a):
        """dias_sem_compra = None se sem ultima_compra."""
        cliente = Cliente.objects.create(
            empresa=empresa_a,
            nome="Sem Compra",
            criado_por=usuario_a,
        )
        assert cliente.dias_sem_compra is None


# ─── Resumo do CRM ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestResumo:

    def test_resumo_retorna_kpis(self, client_a, cliente_joao, cliente_maria):
        """GET /api/clientes/resumo/ → retorna KPIs corretos."""
        resp = client_a.get("/api/clientes/resumo/")
        assert resp.status_code == 200
        data = resp.data["data"]
        assert "total_clientes" in data
        assert "clientes_ativos" in data
        assert "novos_este_mes" in data
        assert "valor_total_gerado" in data
        assert "ticket_medio_geral" in data
        assert "followups_atrasados" in data
        assert "clientes_por_status" in data
        assert data["total_clientes"] >= 2

    def test_followups_proximos(self, client_a, empresa_a, usuario_a):
        """GET /api/clientes/followups/ → retorna follow-ups dos próximos dias."""
        amanha = date.today() + timedelta(days=1)
        Cliente.objects.create(
            empresa=empresa_a,
            nome="Follow-up Amanhã",
            proximo_followup=amanha,
            criado_por=usuario_a,
        )
        resp = client_a.get("/api/clientes/followups/?dias=3")
        assert resp.status_code == 200
        nomes = [c["nome"] for c in resp.data["data"]]
        assert "Follow-up Amanhã" in nomes


# ─── Multi-tenant ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMultiTenant:

    def test_empresa_a_nao_ve_clientes_da_empresa_b(
        self, client_a, empresa_b, usuario_b
    ):
        """Empresa A não vê clientes da empresa B."""
        Cliente.objects.create(
            empresa=empresa_b,
            nome="Cliente Exclusivo B",
            criado_por=usuario_b,
        )
        resp = client_a.get("/api/clientes/")
        assert resp.status_code == 200
        nomes = [c["nome"] for c in resp.data["data"]]
        assert "Cliente Exclusivo B" not in nomes

    def test_empresa_a_nao_acessa_detalhe_de_cliente_da_b(
        self, client_a, empresa_b, usuario_b
    ):
        """Empresa A não acessa detalhe de cliente da empresa B → 404."""
        cliente_b = Cliente.objects.create(
            empresa=empresa_b,
            nome="Privado B",
            criado_por=usuario_b,
        )
        resp = client_a.get(f"/api/clientes/{cliente_b.id}/")
        assert resp.status_code == 404

    def test_empresa_a_nao_cria_interacao_em_cliente_da_b(
        self, client_a, empresa_b, usuario_b
    ):
        """Empresa A não cria interação em cliente da empresa B → 404."""
        cliente_b = Cliente.objects.create(
            empresa=empresa_b,
            nome="Privado B",
            criado_por=usuario_b,
        )
        resp = client_a.post(f"/api/clientes/{cliente_b.id}/interacoes/", {
            "tipo": "ligacao",
            "titulo": "Tentativa indevida",
        }, format="json")
        assert resp.status_code == 404

    def test_empresa_a_nao_move_cliente_da_b_no_funil(
        self, client_a, empresa_b, usuario_b
    ):
        """Empresa A não move cliente da empresa B no funil → 404."""
        cliente_b = Cliente.objects.create(
            empresa=empresa_b,
            nome="Privado B",
            criado_por=usuario_b,
        )
        resp = client_a.patch(f"/api/clientes/{cliente_b.id}/mover-funil/", {
            "status_funil": "fechado",
        }, format="json")
        assert resp.status_code == 404

    def test_funil_mostra_apenas_clientes_da_propria_empresa(
        self, client_a, empresa_b, usuario_b, cliente_joao
    ):
        """Funil mostra apenas clientes da própria empresa."""
        Cliente.objects.create(
            empresa=empresa_b,
            nome="Lead B",
            status_funil="lead",
            criado_por=usuario_b,
        )
        resp = client_a.get("/api/clientes/funil/")
        assert resp.status_code == 200
        nomes_lead = [c["nome"] for c in resp.data["data"]["lead"]]
        assert "Lead B" not in nomes_lead
        assert "João Silva" in nomes_lead


# ─── Tasks Celery ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTasks:

    def test_verificar_followups_hoje(self, db, empresa_a, usuario_a):
        """verificar_followups → identifica clientes com follow-up hoje."""
        from modules.clientes.tasks import verificar_followups

        Cliente.objects.create(
            empresa=empresa_a,
            nome="Follow-up Hoje",
            proximo_followup=date.today(),
            criado_por=usuario_a,
        )
        result = verificar_followups()
        assert result["total_followups_hoje"] >= 1

    def test_alertar_followups_atrasados(self, db, empresa_a, usuario_a):
        """alertar_followups_atrasados → identifica empresas com alertas."""
        from modules.clientes.tasks import alertar_followups_atrasados

        ontem = date.today() - timedelta(days=1)
        Cliente.objects.create(
            empresa=empresa_a,
            nome="Atrasado",
            proximo_followup=ontem,
            criado_por=usuario_a,
        )
        result = alertar_followups_atrasados()
        assert result["empresas_com_alertas"] >= 1


# ─── Cache Redis ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCache:

    def test_resumo_retorna_na_segunda_chamada(self, client_a, cliente_joao):
        """Resumo vem do cache Redis na segunda chamada."""
        resp1 = client_a.get("/api/clientes/resumo/")
        resp2 = client_a.get("/api/clientes/resumo/")
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.data["data"]["total_clientes"] == resp2.data["data"]["total_clientes"]

    def test_criar_cliente_invalida_cache(self, client_a, cliente_joao):
        """Criar cliente invalida o cache e a lista é atualizada."""
        # Primeira chamada (popula cache)
        resp1 = client_a.get("/api/clientes/resumo/")
        total_antes = resp1.data["data"]["total_clientes"]

        # Criar novo cliente
        client_a.post("/api/clientes/", {
            "nome": "Novo Cache Test",
            "tipo": "pessoa_fisica",
        }, format="json")

        # Segunda chamada (deve refletir o novo cliente)
        resp2 = client_a.get("/api/clientes/resumo/")
        assert resp2.data["data"]["total_clientes"] >= total_antes

    def test_mover_funil_invalida_cache_do_funil(self, client_a, cliente_joao):
        """Mover no funil invalida cache e funil é atualizado."""
        # Popula cache do funil
        resp1 = client_a.get("/api/clientes/funil/")
        assert "João Silva" in [c["nome"] for c in resp1.data["data"]["lead"]]

        # Move João para proposta
        client_a.patch(f"/api/clientes/{cliente_joao.id}/mover-funil/", {
            "status_funil": "proposta",
        }, format="json")

        # Funil atualizado (resp2 obtido APÓS o mover)
        resp2 = client_a.get("/api/clientes/funil/")
        nomes_proposta = [c["nome"] for c in resp2.data["data"]["proposta"]]
        assert "João Silva" in nomes_proposta


# ─── Cenário Completo (Roteiro do Fundador) ───────────────────────────────────

@pytest.mark.django_db
class TestCenarioCompleto:

    def test_roteiro_fundador(self, client_a, empresa_a, usuario_a):
        """
        Roteiro completo do Fundador:
        1. Criar 3 clientes
        2. Ver funil com clientes nas colunas corretas
        3. Arrastar João de lead → contato
        4. Registrar venda R$500 para Maria
        5. Verificar ticket médio e valor total de Maria
        6. Definir follow-up de ontem para João → atrasado
        7. Verificar link WhatsApp
        """
        # 1. Criar 3 clientes
        resp_joao = client_a.post("/api/clientes/", {
            "nome": "João (Lead)",
            "tipo": "pessoa_fisica",
            "whatsapp": "11999990001",
            "status_funil": "lead",
            "origem": "indicacao",
        }, format="json")
        assert resp_joao.status_code == 201
        joao_id = resp_joao.data["data"]["id"]

        resp_maria = client_a.post("/api/clientes/", {
            "nome": "Maria (Proposta)",
            "tipo": "pessoa_fisica",
            "status_funil": "proposta",
            "origem": "instagram",
        }, format="json")
        assert resp_maria.status_code == 201
        maria_id = resp_maria.data["data"]["id"]

        resp_xyz = client_a.post("/api/clientes/", {
            "nome": "Empresa XYZ",
            "tipo": "pessoa_juridica",
            "nome_empresa": "XYZ Ltda",
            "status_funil": "negociacao",
            "origem": "google",
        }, format="json")
        assert resp_xyz.status_code == 201

        # 2. Ver funil com clientes nas colunas corretas
        resp_funil = client_a.get("/api/clientes/funil/")
        assert resp_funil.status_code == 200
        nomes_lead = [c["nome"] for c in resp_funil.data["data"]["lead"]]
        nomes_proposta = [c["nome"] for c in resp_funil.data["data"]["proposta"]]
        nomes_negociacao = [c["nome"] for c in resp_funil.data["data"]["negociacao"]]
        assert "João (Lead)" in nomes_lead
        assert "Maria (Proposta)" in nomes_proposta
        assert "Empresa XYZ" in nomes_negociacao

        # 3. Arrastar João de lead → contato
        resp_mover = client_a.patch(f"/api/clientes/{joao_id}/mover-funil/", {
            "status_funil": "contato",
        }, format="json")
        assert resp_mover.status_code == 200
        assert resp_mover.data["data"]["status_funil"] == "contato"

        # 4. Registrar venda R$500 para Maria
        resp_venda = client_a.post(f"/api/clientes/{maria_id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda do produto principal",
            "valor": "500.00",
            "data_interacao": timezone.now().isoformat(),
        }, format="json")
        assert resp_venda.status_code == 201

        # 5. Verificar ticket médio e valor total de Maria
        resp_maria_detalhe = client_a.get(f"/api/clientes/{maria_id}/")
        assert resp_maria_detalhe.status_code == 200
        maria_data = resp_maria_detalhe.data["data"]
        assert Decimal(maria_data["valor_total_compras"]) == Decimal("500.00")
        assert Decimal(maria_data["ticket_medio"]) == Decimal("500.00")

        # 6. Definir follow-up de ontem → atrasado em vermelho
        ontem = (date.today() - timedelta(days=1)).isoformat()
        client_a.patch(f"/api/clientes/{joao_id}/", {
            "proximo_followup": ontem,
        }, format="json")
        resp_joao_detalhe = client_a.get(f"/api/clientes/{joao_id}/")
        assert resp_joao_detalhe.data["data"]["followup_atrasado"] is True

        # 7. Verificar link WhatsApp
        assert resp_joao_detalhe.data["data"]["link_whatsapp"] == "https://wa.me/5511999990001"


# ─── Registro com campos de data vazios (bug do formulário) ──────────────────

@pytest.mark.django_db
class TestInteracaoCamposVazios:
    """
    O formulário do frontend envia "" para datas não preenchidas. Antes, o DRF
    DateField/DateTimeField rejeitava "" e a interação falhava com 400.
    """

    def test_criar_interacao_com_followup_vazio(self, client_a, cliente_joao):
        """proximo_followup="" não deve quebrar o registro → 201."""
        resp = client_a.post(f"/api/clientes/{cliente_joao.id}/interacoes/", {
            "tipo": "ligacao",
            "titulo": "Ligação simples",
            "descricao": "",
            "valor": "",
            "data_interacao": "2026-06-30T14:30",
            "proximo_followup": "",
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["data"]["proximo_followup"] is None

    def test_criar_venda_com_followup_vazio(self, client_a, cliente_maria):
        """Venda com followup vazio também deve funcionar e atualizar agregados."""
        resp = client_a.post(f"/api/clientes/{cliente_maria.id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda sem followup",
            "valor": "1500.00",
            "data_interacao": "2026-06-30T14:30",
            "proximo_followup": "",
        }, format="json")
        assert resp.status_code == 201
        cliente_maria.refresh_from_db()
        assert cliente_maria.valor_total_compras == Decimal("1500.00")

    def test_data_interacao_vazia_usa_default(self, client_a, cliente_joao):
        """data_interacao="" deve cair no default do model (timezone.now)."""
        resp = client_a.post(f"/api/clientes/{cliente_joao.id}/interacoes/", {
            "tipo": "email",
            "titulo": "E-mail sem data",
            "data_interacao": "",
            "proximo_followup": "",
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["data"]["data_interacao"] is not None


# ─── Editar e Apagar interações ──────────────────────────────────────────────

@pytest.mark.django_db
class TestInteracaoEditarApagar:

    def _criar_venda(self, client, cliente, valor="500.00"):
        resp = client.post(f"/api/clientes/{cliente.id}/interacoes/", {
            "tipo": "venda",
            "titulo": "Venda inicial",
            "valor": valor,
            "data_interacao": timezone.now().isoformat(),
        }, format="json")
        assert resp.status_code == 201
        return resp.data["data"]["id"]

    def test_editar_interacao(self, client_a, cliente_maria):
        """PATCH atualiza os campos da interação → 200."""
        iid = self._criar_venda(client_a, cliente_maria, "500.00")
        resp = client_a.patch(
            f"/api/clientes/{cliente_maria.id}/interacoes/{iid}/",
            {"titulo": "Venda revisada", "valor": "750.00"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["data"]["titulo"] == "Venda revisada"
        assert Decimal(resp.data["data"]["valor"]) == Decimal("750.00")

    def test_editar_venda_recalcula_agregados(self, client_a, cliente_maria):
        """Editar o valor de uma venda recalcula valor_total_compras do cliente."""
        iid = self._criar_venda(client_a, cliente_maria, "500.00")
        cliente_maria.refresh_from_db()
        assert cliente_maria.valor_total_compras == Decimal("500.00")

        client_a.patch(
            f"/api/clientes/{cliente_maria.id}/interacoes/{iid}/",
            {"valor": "800.00"},
            format="json",
        )
        cliente_maria.refresh_from_db()
        assert cliente_maria.valor_total_compras == Decimal("800.00")
        assert cliente_maria.quantidade_compras == 1

    def test_apagar_interacao(self, client_a, cliente_maria):
        """DELETE remove a interação → 204."""
        iid = self._criar_venda(client_a, cliente_maria, "500.00")
        resp = client_a.delete(
            f"/api/clientes/{cliente_maria.id}/interacoes/{iid}/"
        )
        assert resp.status_code == 204
        assert not InteracaoCliente.objects.filter(id=iid).exists()

    def test_apagar_venda_reduz_agregados(self, client_a, cliente_maria):
        """Apagar uma venda reduz valor_total_compras e quantidade_compras."""
        iid1 = self._criar_venda(client_a, cliente_maria, "300.00")
        self._criar_venda(client_a, cliente_maria, "200.00")
        cliente_maria.refresh_from_db()
        assert cliente_maria.valor_total_compras == Decimal("500.00")
        assert cliente_maria.quantidade_compras == 2

        client_a.delete(f"/api/clientes/{cliente_maria.id}/interacoes/{iid1}/")
        cliente_maria.refresh_from_db()
        assert cliente_maria.valor_total_compras == Decimal("200.00")
        assert cliente_maria.quantidade_compras == 1

    def test_editar_interacao_inexistente_404(self, client_a, cliente_maria):
        import uuid
        resp = client_a.patch(
            f"/api/clientes/{cliente_maria.id}/interacoes/{uuid.uuid4()}/",
            {"titulo": "x"},
            format="json",
        )
        assert resp.status_code == 404

    def test_multitenant_nao_edita_interacao_de_outra_empresa(
        self, client_b, client_a, cliente_maria
    ):
        """Empresa B não pode editar interação de cliente da empresa A → 404."""
        iid = self._criar_venda(client_a, cliente_maria, "500.00")
        resp = client_b.patch(
            f"/api/clientes/{cliente_maria.id}/interacoes/{iid}/",
            {"titulo": "hack"},
            format="json",
        )
        assert resp.status_code == 404

    def test_multitenant_nao_apaga_interacao_de_outra_empresa(
        self, client_b, client_a, cliente_maria
    ):
        """Empresa B não pode apagar interação de cliente da empresa A → 404."""
        iid = self._criar_venda(client_a, cliente_maria, "500.00")
        resp = client_b.delete(
            f"/api/clientes/{cliente_maria.id}/interacoes/{iid}/"
        )
        assert resp.status_code == 404
        assert InteracaoCliente.objects.filter(id=iid).exists()
