"""
Synapse — Módulos configuráveis por empresa.

Cobre: bloqueio no BACKEND (403 MODULO_DESATIVADO) para módulos desligados;
módulos obrigatórios sempre ativos; /auth/me com a config; PATCH dos módulos
(admin vs não-admin); registro configurando módulos; tasks Celery pulando
empresas com módulo off; notificações não geradas; busca global; e a
retrocompatibilidade (empresas existentes com tudo ligado).
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from shared.modulos import (
    MODULOS_OBRIGATORIOS,
    MODULOS_OPCIONAIS,
    modulo_ativo,
    modulos_da_empresa,
)


@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Módulos", plano="pro")


@pytest.fixture
def admin(db, empresa):
    return CustomUser.objects.create_user(
        email="admin@mod.com", nome="Admin", senha="Senha@12345",
        empresa=empresa, perfil="admin",
    )


@pytest.fixture
def colaborador(db, empresa):
    return CustomUser.objects.create_user(
        email="colab@mod.com", nome="Colab", senha="Senha@12345",
        empresa=empresa, perfil="colaborador",
    )


def _client(user):
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


# ── Serviço central ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_modulos_obrigatorios_sempre_ativos(empresa):
    """Nem desligando o campo (que nem existe) o obrigatório fica inativo."""
    for nome in MODULOS_OBRIGATORIOS:
        assert modulo_ativo(empresa, nome) is True


@pytest.mark.django_db
def test_empresa_nova_tem_todos_os_modulos_ligados(empresa):
    """Retrocompatibilidade: default True em todos os opcionais."""
    modulos = modulos_da_empresa(empresa)
    assert set(modulos.keys()) == set(MODULOS_OPCIONAIS)
    assert all(modulos.values())


@pytest.mark.django_db
def test_modulo_desligado_reflete_no_servico(empresa):
    empresa.modulo_estoque = False
    empresa.save()
    assert modulo_ativo(empresa, "estoque") is False
    # Independência: desligar estoque não afeta os outros.
    assert modulo_ativo(empresa, "fornecedores") is True
    assert modulo_ativo(empresa, "projetos") is True


# ── Bloqueio no BACKEND (403), não só no frontend ───────────────────────────

@pytest.mark.django_db
@pytest.mark.parametrize(
    "campo,url",
    [
        ("modulo_estoque", "/api/estoque/produtos/"),
        ("modulo_fornecedores", "/api/fornecedores/"),
        ("modulo_projetos", "/api/projetos/"),
        ("modulo_agenda", "/api/agenda/"),
        ("modulo_equipe", "/api/equipe/membros/"),
        ("modulo_documentos", "/api/documentos/"),
    ],
)
def test_endpoint_de_modulo_desligado_retorna_403(admin, empresa, campo, url):
    c = _client(admin)
    # Ligado → passa (200)
    assert c.get(url).status_code == 200

    setattr(empresa, campo, False)
    empresa.save()

    resp = c.get(url)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "MODULO_DESATIVADO"
    assert "Configurações" in resp.json()["error"]["message"]


@pytest.mark.django_db
def test_modulo_desligado_bloqueia_tambem_o_post(admin, empresa):
    empresa.modulo_agenda = False
    empresa.save()
    resp = _client(admin).post("/api/agenda/", {"titulo": "X"}, format="json")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "MODULO_DESATIVADO"


@pytest.mark.django_db
def test_modulo_obrigatorio_nunca_bloqueia(admin, empresa):
    """Financeiro/Clientes seguem acessíveis mesmo com os opcionais off."""
    for nome in MODULOS_OPCIONAIS:
        setattr(empresa, f"modulo_{nome}", False)
    empresa.save()
    c = _client(admin)
    assert c.get("/api/clientes/").status_code == 200
    assert c.get("/api/financeiro/lancamentos/").status_code == 200


# ── /auth/me ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_auth_me_retorna_config_de_modulos(admin, empresa):
    empresa.modulo_equipe = False
    empresa.save()
    resp = _client(admin).get("/api/auth/me/")
    assert resp.status_code == 200
    modulos = resp.json()["data"]["modulos"]
    assert modulos["equipe"] is False
    assert modulos["estoque"] is True
    assert set(modulos.keys()) == set(MODULOS_OPCIONAIS)


# ── PATCH /api/auth/empresa/modulos/ ────────────────────────────────────────

@pytest.mark.django_db
def test_patch_modulos_admin_200(admin, empresa):
    resp = _client(admin).patch(
        "/api/auth/empresa/modulos/", {"modulo_estoque": False}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["modulos"]["estoque"] is False
    empresa.refresh_from_db()
    assert empresa.modulo_estoque is False


@pytest.mark.django_db
def test_patch_modulos_nao_admin_403(colaborador, empresa):
    resp = _client(colaborador).patch(
        "/api/auth/empresa/modulos/", {"modulo_estoque": False}, format="json"
    )
    assert resp.status_code == 403
    empresa.refresh_from_db()
    assert empresa.modulo_estoque is True  # inalterado


@pytest.mark.django_db
def test_religar_modulo_restaura_acesso_sem_perder_dados(admin, empresa):
    from modules.estoque.models import Produto

    Produto.objects.create(empresa=empresa, nome="Camisa", sku="C1", preco_venda=10)
    c = _client(admin)

    c.patch("/api/auth/empresa/modulos/", {"modulo_estoque": False}, format="json")
    assert c.get("/api/estoque/produtos/").status_code == 403
    # O dado continua lá — desligar só oculta.
    assert Produto.objects.filter(empresa=empresa).count() == 1

    c.patch("/api/auth/empresa/modulos/", {"modulo_estoque": True}, format="json")
    resp = c.get("/api/estoque/produtos/")
    assert resp.status_code == 200
    assert Produto.objects.filter(empresa=empresa).count() == 1


@pytest.mark.django_db
def test_get_modulos_traz_contagens_e_info(admin, empresa):
    from modules.estoque.models import Produto

    Produto.objects.create(empresa=empresa, nome="P", sku="S1", preco_venda=5)
    resp = _client(admin).get("/api/auth/empresa/modulos/")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["contagens"]["estoque"] == 1
    assert data["info"]["estoque"]["label"] == "Estoque"
    assert set(data["obrigatorios"]) == set(MODULOS_OBRIGATORIOS)


# ── Registro configurando módulos (Etapa 3) ─────────────────────────────────

@pytest.mark.django_db
def test_registro_configura_modulos():
    resp = APIClient().post(
        "/api/auth/registro/",
        {
            "nome_usuario": "Fulano", "email": "novo@x.com",
            "senha": "SenhaForte@123", "confirmar_senha": "SenhaForte@123",
            "nome_empresa": "Loja Nova", "segmento": "servicos",
            "modulo_estoque": False, "modulo_fornecedores": False,
            "modulo_projetos": True, "modulo_agenda": True,
            "modulo_equipe": False, "modulo_documentos": True,
        },
        format="json",
    )
    assert resp.status_code == 201
    empresa = Empresa.objects.get(nome="Loja Nova")
    assert empresa.modulo_estoque is False
    assert empresa.modulo_fornecedores is False
    assert empresa.modulo_equipe is False
    assert empresa.modulo_projetos is True
    assert empresa.modulo_agenda is True
    assert empresa.modulo_documentos is True


@pytest.mark.django_db
def test_registro_sem_respostas_liga_tudo():
    """Retrocompatível: registro antigo (sem as perguntas) → tudo ligado."""
    resp = APIClient().post(
        "/api/auth/registro/",
        {
            "nome_usuario": "Beltrano", "email": "outro@x.com",
            "senha": "SenhaForte@123", "confirmar_senha": "SenhaForte@123",
            "nome_empresa": "Loja Antiga", "segmento": "varejo",
        },
        format="json",
    )
    assert resp.status_code == 201
    empresa = Empresa.objects.get(nome="Loja Antiga")
    assert all(modulos_da_empresa(empresa).values())


# ── Tasks Celery e notificações ─────────────────────────────────────────────

@pytest.mark.django_db
def test_task_estoque_pula_empresa_com_modulo_off(empresa, admin):
    from modules.estoque.models import Produto
    from modules.estoque.tasks import verificar_estoque_minimo
    from modules.notificacoes.models import Notificacao

    Produto.objects.create(
        empresa=empresa, nome="Crítico", sku="CR1", preco_venda=10,
        estoque_atual=0, estoque_minimo=5,
    )
    empresa.modulo_estoque = False
    empresa.save()

    verificar_estoque_minimo()
    assert not Notificacao.objects.filter(empresa=empresa, tipo="estoque").exists()

    # Religando, o alerta volta a ser gerado.
    empresa.modulo_estoque = True
    empresa.save()
    verificar_estoque_minimo()
    assert Notificacao.objects.filter(empresa=empresa, tipo="estoque").exists()


@pytest.mark.django_db
def test_notificacao_de_modulo_desligado_nao_e_criada(empresa, admin):
    from modules.notificacoes.models import Notificacao
    from modules.notificacoes.services import NotificacaoService

    empresa.modulo_projetos = False
    empresa.save()

    criada = NotificacaoService.criar_notificacao(
        usuario_id=str(admin.id), empresa_id=str(empresa.id),
        tipo="projeto", titulo="X", mensagem="Y",
    )
    assert criada is None
    assert not Notificacao.objects.filter(tipo="projeto").exists()

    # Módulo obrigatório (financeiro) nunca é bloqueado.
    NotificacaoService.criar_notificacao(
        usuario_id=str(admin.id), empresa_id=str(empresa.id),
        tipo="financeiro", titulo="Conta", mensagem="Vence hoje",
    )
    assert Notificacao.objects.filter(tipo="financeiro").exists()


# ── Busca global ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_busca_global_ignora_modulo_desligado(admin, empresa):
    from modules.estoque.models import Produto

    Produto.objects.create(empresa=empresa, nome="Camiseta", sku="CAM1", preco_venda=50)
    c = _client(admin)

    resp = c.get("/api/search/?q=Camiseta")
    assert resp.status_code == 200
    assert len(resp.json()["data"]["produtos"]) == 1

    empresa.modulo_estoque = False
    empresa.save()
    resp = c.get("/api/search/?q=Camiseta")
    assert resp.json()["data"]["produtos"] == []
