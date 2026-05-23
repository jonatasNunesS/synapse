"""
Synapse — M9 AI Hub: Testes Completos
Cobre: happy path, acesso negado, multi-tenant, limites de plano,
       serializers, service, tasks (mocked), histórico, favoritos, uso.
"""
from unittest.mock import patch, MagicMock
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from modules.auth.models import CustomUser, Empresa
from modules.ai_hub.models import ConteudoGerado, TaskIA
from modules.ai_hub.services import AIHubService, AILimitExceededError, LIMITES_PLANO
from modules.ai_hub.serializers import SolicitacaoConteudoSerializer


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
def empresa_starter(db):
    return Empresa.objects.create(
        nome="Empresa Starter",
        segmento="Varejo",
        plano="starter",
        plano_ativo=True,
    )


@pytest.fixture
def empresa_pro(db):
    return Empresa.objects.create(
        nome="Empresa Pro",
        segmento="Serviços",
        plano="pro",
        plano_ativo=True,
    )


@pytest.fixture
def empresa_business(db):
    return Empresa.objects.create(
        nome="Empresa Business",
        segmento="Tecnologia",
        plano="business",
        plano_ativo=True,
    )


@pytest.fixture
def usuario_starter(db, empresa_starter):
    return CustomUser.objects.create_user(
        email="user@starter.com",
        nome="User Starter",
        senha="Test@1234",
        empresa=empresa_starter,
    )


@pytest.fixture
def usuario_pro(db, empresa_pro):
    return CustomUser.objects.create_user(
        email="user@pro.com",
        nome="User Pro",
        senha="Test@1234",
        empresa=empresa_pro,
    )


@pytest.fixture
def usuario_business(db, empresa_business):
    return CustomUser.objects.create_user(
        email="user@business.com",
        nome="User Business",
        senha="Test@1234",
        empresa=empresa_business,
    )


@pytest.fixture
def conteudo_a(db, empresa_starter, usuario_starter):
    return ConteudoGerado.objects.create(
        empresa=empresa_starter,
        tipo="legenda_instagram",
        prompt_usuario="Legenda para tênis Nike",
        prompt_completo="[system]\n\nLegenda para tênis Nike",
        resultado="Corra mais longe. 👟 #Nike #Corrida",
        modelo_usado="llama-3.1-8b-instant",
        tokens_usados=120,
        criado_por=usuario_starter,
    )


@pytest.fixture
def conteudo_favorito(db, empresa_starter, usuario_starter):
    return ConteudoGerado.objects.create(
        empresa=empresa_starter,
        tipo="hashtags",
        prompt_usuario="Hashtags para moda",
        prompt_completo="[system]\n\nHashtags para moda",
        resultado="#moda #fashion #estilo",
        modelo_usado="llama-3.1-8b-instant",
        tokens_usados=50,
        favorito=True,
        criado_por=usuario_starter,
    )


@pytest.fixture
def task_ia_pendente(db, empresa_starter):
    return TaskIA.objects.create(
        empresa=empresa_starter,
        tipo="conteudo",
        status="pendente",
        parametros={"tipo_conteudo": "legenda_instagram", "produto": "Tênis"},
    )


@pytest.fixture
def task_ia_concluida(db, empresa_starter):
    return TaskIA.objects.create(
        empresa=empresa_starter,
        tipo="conteudo",
        status="concluido",
        parametros={"tipo_conteudo": "legenda_instagram", "produto": "Tênis"},
        resultado="Corra mais longe. 👟",
    )


# ════════════════════════════════════════════════════════════
# TESTES: MODELS
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestConteudoGeradoModel:
    def test_criacao_conteudo(self, conteudo_a):
        assert conteudo_a.tipo == "legenda_instagram"
        assert conteudo_a.tokens_usados == 120
        assert conteudo_a.favorito is False

    def test_str_conteudo(self, conteudo_a):
        s = str(conteudo_a)
        assert "Legenda para Instagram" in s
        assert "Empresa Starter" in s

    def test_toggle_favorito_via_service(self, conteudo_a):
        assert conteudo_a.favorito is False
        conteudo_a.favorito = True
        conteudo_a.save()
        conteudo_a.refresh_from_db()
        assert conteudo_a.favorito is True


@pytest.mark.django_db
class TestTaskIAModel:
    def test_criacao_task(self, task_ia_pendente):
        assert task_ia_pendente.status == "pendente"
        assert task_ia_pendente.tipo == "conteudo"

    def test_str_task(self, task_ia_pendente):
        s = str(task_ia_pendente)
        assert "pendente" in s
        assert "Empresa Starter" in s


# ════════════════════════════════════════════════════════════
# TESTES: SERIALIZERS
# ════════════════════════════════════════════════════════════

class TestSolicitacaoConteudoSerializer:
    def test_valido_legenda_instagram(self):
        data = {
            "tipo": "legenda_instagram",
            "parametros": {"produto": "Tênis", "tom": "animado", "quantidade": "3"},
        }
        s = SolicitacaoConteudoSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_invalido_tipo_desconhecido(self):
        data = {"tipo": "tipo_inexistente", "parametros": {}}
        s = SolicitacaoConteudoSerializer(data=data)
        assert not s.is_valid()
        assert "tipo" in s.errors

    def test_invalido_campos_obrigatorios_faltando(self):
        data = {
            "tipo": "legenda_instagram",
            "parametros": {"produto": "Tênis"},  # falta tom e quantidade
        }
        s = SolicitacaoConteudoSerializer(data=data)
        assert not s.is_valid()
        assert "parametros" in s.errors

    def test_valido_relatorio_sem_parametros(self):
        data = {"tipo": "relatorio_negocio", "parametros": {}}
        s = SolicitacaoConteudoSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_valido_insight_sem_parametros(self):
        data = {"tipo": "insight", "parametros": {}}
        s = SolicitacaoConteudoSerializer(data=data)
        assert s.is_valid(), s.errors


# ════════════════════════════════════════════════════════════
# TESTES: SERVICE — Limites
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestAIHubServiceLimites:
    def test_limites_por_plano(self):
        assert LIMITES_PLANO["starter"] == 20
        assert LIMITES_PLANO["pro"] == 100
        assert LIMITES_PLANO["business"] is None
        assert LIMITES_PLANO["enterprise"] is None

    def test_verificar_limite_dentro_do_limite(self, empresa_starter):
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = "5"
            resultado = AIHubService.verificar_limite(empresa_starter.id)
            assert resultado is True

    def test_verificar_limite_excedido(self, empresa_starter):
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = "20"  # starter limit = 20
            resultado = AIHubService.verificar_limite(empresa_starter.id)
            assert resultado is False

    def test_verificar_limite_business_ilimitado(self, empresa_business):
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = "9999"
            resultado = AIHubService.verificar_limite(empresa_business.id)
            assert resultado is True  # ilimitado

    def test_obter_uso_starter(self, empresa_starter):
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = "10"
            uso = AIHubService.obter_uso(empresa_starter.id)
            assert uso["usado"] == 10
            assert uso["limite"] == 20
            assert uso["percentual"] == 50.0
            assert uso["plano"] == "starter"
            assert uso["ilimitado"] is False

    def test_obter_uso_business_ilimitado(self, empresa_business):
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = "50"
            uso = AIHubService.obter_uso(empresa_business.id)
            assert uso["ilimitado"] is True
            assert uso["percentual"] == 0.0


# ════════════════════════════════════════════════════════════
# TESTES: SERVICE — Histórico e Favoritos
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestAIHubServiceHistorico:
    def test_listar_conteudos_empresa(self, conteudo_a, conteudo_favorito, empresa_starter):
        qs = AIHubService.listar_conteudos(empresa_starter.id)
        assert qs.count() == 2

    def test_listar_conteudos_filtro_tipo(self, conteudo_a, conteudo_favorito, empresa_starter):
        qs = AIHubService.listar_conteudos(empresa_starter.id, tipo="hashtags")
        assert qs.count() == 1
        assert qs.first().tipo == "hashtags"

    def test_listar_conteudos_filtro_favorito(self, conteudo_a, conteudo_favorito, empresa_starter):
        qs = AIHubService.listar_conteudos(empresa_starter.id, favorito=True)
        assert qs.count() == 1
        assert qs.first().favorito is True

    def test_toggle_favorito(self, conteudo_a, empresa_starter):
        assert conteudo_a.favorito is False
        conteudo = AIHubService.toggle_favorito(empresa_starter.id, conteudo_a.id)
        assert conteudo.favorito is True
        # Toggle novamente
        conteudo = AIHubService.toggle_favorito(empresa_starter.id, conteudo_a.id)
        assert conteudo.favorito is False

    def test_toggle_favorito_empresa_errada(self, conteudo_a, empresa_pro):
        from shared.exceptions import ResourceNotFound
        with pytest.raises((ResourceNotFound, Exception)):
            AIHubService.toggle_favorito(empresa_pro.id, conteudo_a.id)


# ════════════════════════════════════════════════════════════
# TESTES: SERVICE — Solicitar Geração
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestAIHubServiceGeracao:
    def test_solicitar_geracao_cria_task(self, empresa_starter, usuario_starter):
        with patch("modules.ai_hub.services.AIHubService.verificar_limite", return_value=True):
            with patch("modules.ai_hub.tasks.gerar_conteudo_ia.delay") as mock_delay:
                mock_delay.return_value = MagicMock(id="celery-task-123")
                task = AIHubService.solicitar_geracao(
                    empresa_id=empresa_starter.id,
                    usuario_id=usuario_starter.id,
                    tipo="legenda_instagram",
                    parametros={"produto": "Tênis", "tom": "animado", "quantidade": "3"},
                )
                assert task.status == "pendente"
                assert task.empresa == empresa_starter
                assert task.task_id == "celery-task-123"
                mock_delay.assert_called_once()

    def test_solicitar_geracao_limite_excedido(self, empresa_starter, usuario_starter):
        with patch("modules.ai_hub.services.AIHubService.verificar_limite", return_value=False):
            with pytest.raises(AILimitExceededError):
                AIHubService.solicitar_geracao(
                    empresa_id=empresa_starter.id,
                    usuario_id=usuario_starter.id,
                    tipo="legenda_instagram",
                    parametros={"produto": "Tênis", "tom": "animado", "quantidade": "3"},
                )


# ════════════════════════════════════════════════════════════
# TESTES: ENDPOINTS — GET /api/ai/uso/
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestUsoIAEndpoint:
    def test_uso_autenticado(self, client, usuario_starter):
        c = auth_client(client, usuario_starter)
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = "5"
            resp = c.get("/api/ai/uso/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["plano"] == "starter"
        assert data["data"]["limite"] == 20

    def test_uso_nao_autenticado(self, client):
        resp = client.get("/api/ai/uso/")
        assert resp.status_code == 401


# ════════════════════════════════════════════════════════════
# TESTES: ENDPOINTS — POST /api/ai/gerar/
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestGerarConteudoEndpoint:
    def test_gerar_happy_path(self, client, usuario_starter):
        c = auth_client(client, usuario_starter)
        with patch("modules.ai_hub.services.AIHubService.verificar_limite", return_value=True):
            with patch("modules.ai_hub.tasks.gerar_conteudo_ia.delay") as mock_delay:
                mock_delay.return_value = MagicMock(id="celery-abc")
                resp = c.post(
                    "/api/ai/gerar/",
                    data={
                        "tipo": "legenda_instagram",
                        "parametros": {
                            "produto": "Tênis Nike",
                            "tom": "animado",
                            "quantidade": "3",
                        },
                    },
                    content_type="application/json",
                )
        assert resp.status_code == 202
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["status"] == "pendente"

    def test_gerar_dados_invalidos(self, client, usuario_starter):
        c = auth_client(client, usuario_starter)
        resp = c.post(
            "/api/ai/gerar/",
            data={"tipo": "tipo_invalido", "parametros": {}},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_gerar_limite_excedido(self, client, usuario_starter):
        c = auth_client(client, usuario_starter)
        with patch("modules.ai_hub.services.AIHubService.verificar_limite", return_value=False):
            resp = c.post(
                "/api/ai/gerar/",
                data={
                    "tipo": "legenda_instagram",
                    "parametros": {
                        "produto": "Tênis",
                        "tom": "animado",
                        "quantidade": "3",
                    },
                },
                content_type="application/json",
            )
        assert resp.status_code == 429

    def test_gerar_nao_autenticado(self, client):
        resp = client.post(
            "/api/ai/gerar/",
            data={"tipo": "legenda_instagram", "parametros": {}},
            content_type="application/json",
        )
        assert resp.status_code == 401


# ════════════════════════════════════════════════════════════
# TESTES: ENDPOINTS — GET /api/ai/status/{id}/
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestStatusTaskEndpoint:
    def test_status_pendente(self, client, usuario_starter, task_ia_pendente):
        c = auth_client(client, usuario_starter)
        resp = c.get(f"/api/ai/status/{task_ia_pendente.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["status"] == "pendente"

    def test_status_concluido(self, client, usuario_starter, task_ia_concluida):
        c = auth_client(client, usuario_starter)
        resp = c.get(f"/api/ai/status/{task_ia_concluida.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["status"] == "concluido"

    def test_status_multi_tenant(self, client, usuario_pro, task_ia_pendente):
        """Empresa B não pode ver task da empresa A."""
        c = auth_client(client, usuario_pro)
        resp = c.get(f"/api/ai/status/{task_ia_pendente.id}/")
        assert resp.status_code == 404

    def test_status_nao_autenticado(self, client, task_ia_pendente):
        resp = client.get(f"/api/ai/status/{task_ia_pendente.id}/")
        assert resp.status_code == 401


# ════════════════════════════════════════════════════════════
# TESTES: ENDPOINTS — GET /api/ai/historico/
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestHistoricoEndpoint:
    def test_historico_lista_propria_empresa(
        self, client, usuario_starter, conteudo_a, conteudo_favorito
    ):
        c = auth_client(client, usuario_starter)
        resp = c.get("/api/ai/historico/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["pagination"]["count"] == 2

    def test_historico_filtro_favorito(
        self, client, usuario_starter, conteudo_a, conteudo_favorito
    ):
        c = auth_client(client, usuario_starter)
        resp = c.get("/api/ai/historico/?favorito=true")
        assert resp.status_code == 200
        data = resp.json()
        assert data["pagination"]["count"] == 1

    def test_historico_filtro_tipo(
        self, client, usuario_starter, conteudo_a, conteudo_favorito
    ):
        c = auth_client(client, usuario_starter)
        resp = c.get("/api/ai/historico/?tipo=hashtags")
        assert resp.status_code == 200
        data = resp.json()
        assert data["pagination"]["count"] == 1

    def test_historico_multi_tenant(self, client, usuario_pro, conteudo_a):
        """Empresa B não vê conteúdos da empresa A."""
        c = auth_client(client, usuario_pro)
        resp = c.get("/api/ai/historico/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["pagination"]["count"] == 0

    def test_historico_nao_autenticado(self, client):
        resp = client.get("/api/ai/historico/")
        assert resp.status_code == 401


# ════════════════════════════════════════════════════════════
# TESTES: ENDPOINTS — POST /api/ai/favoritar/{id}/
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestFavoritarEndpoint:
    def test_favoritar_toggle(self, client, usuario_starter, conteudo_a):
        c = auth_client(client, usuario_starter)
        assert conteudo_a.favorito is False
        resp = c.post(f"/api/ai/favoritar/{conteudo_a.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["favorito"] is True

    def test_favoritar_multi_tenant(self, client, usuario_pro, conteudo_a):
        c = auth_client(client, usuario_pro)
        resp = c.post(f"/api/ai/favoritar/{conteudo_a.id}/")
        assert resp.status_code == 404


# ════════════════════════════════════════════════════════════
# TESTES: ENDPOINTS — GET /api/ai/insight/
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestInsightEndpoint:
    def test_insight_sem_dados(self, client, usuario_starter):
        c = auth_client(client, usuario_starter)
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = None
            resp = c.get("/api/ai/insight/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        # success_response(data=None) retorna {} por padrão
        assert data["data"] == {} or data["data"] is None

    def test_insight_com_dados(self, client, usuario_starter, empresa_starter):
        insight = ConteudoGerado.objects.create(
            empresa=empresa_starter,
            tipo="insight",
            prompt_usuario="Gere insights",
            prompt_completo="[system]\n\nGere insights",
            resultado="1. Aumentar vendas online\n2. Reduzir custos fixos",
            modelo_usado="llama-3.3-70b-versatile",
            tokens_usados=200,
        )
        c = auth_client(client, usuario_starter)
        with patch("modules.ai_hub.services.cache") as mock_cache:
            mock_cache.get.return_value = None
            resp = c.get("/api/ai/insight/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["tipo"] == "insight"

    def test_insight_nao_autenticado(self, client):
        resp = client.get("/api/ai/insight/")
        assert resp.status_code == 401


# ════════════════════════════════════════════════════════════
# TESTES: TASK CELERY (mocked)
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestGeradorCeleryTask:
    def test_task_gerar_conteudo_sucesso(self, task_ia_pendente, empresa_starter):
        """Testa a task Celery com GroqClient mockado."""
        from modules.ai_hub.tasks import gerar_conteudo_ia

        mock_response = "Corra mais longe com Nike! 👟 #Corrida #Nike"

        with patch("infrastructure.ia.groq_client.GroqClient.gerar", return_value=mock_response):
            with patch("modules.ai_hub.services.AIHubService.montar_contexto_negocio", return_value="Contexto mock"):
                with patch("modules.ai_hub.services.AIHubService.incrementar_uso"):
                    gerar_conteudo_ia(str(task_ia_pendente.id))

        task_ia_pendente.refresh_from_db()
        assert task_ia_pendente.status == "concluido"
        assert task_ia_pendente.resultado == mock_response
        assert ConteudoGerado.objects.filter(empresa=empresa_starter).count() == 1

    def test_task_gerar_conteudo_task_inexistente(self):
        """Task com ID inexistente não deve lançar exceção."""
        from modules.ai_hub.tasks import gerar_conteudo_ia
        import uuid
        # Não deve lançar exceção
        gerar_conteudo_ia(str(uuid.uuid4()))
