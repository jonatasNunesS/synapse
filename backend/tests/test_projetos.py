"""
Synapse — M6 Projetos: Testes Completos
Cobre: happy path, dados inválidos, acesso negado, multi-tenant, cache,
       Kanban, Comentários, Checklist, Tasks Celery.
"""
import uuid
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.projetos.models import ChecklistItem, Comentario, Projeto, Tarefa
from modules.projetos.repository import ProjetoRepository
from modules.projetos.services import ProjetoService


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
def projeto_a(db, empresa_a, usuario_a):
    return Projeto.objects.create(
        empresa=empresa_a,
        nome="Projeto Alpha",
        descricao="Descrição do projeto alpha",
        status="em_andamento",
        prioridade="alta",
        responsavel=usuario_a,
        data_inicio=date.today(),
        data_prazo=date.today() + timedelta(days=30),
        criado_por=usuario_a,
    )


@pytest.fixture
def projeto_atrasado(db, empresa_a, usuario_a):
    return Projeto.objects.create(
        empresa=empresa_a,
        nome="Projeto Atrasado",
        status="em_andamento",
        prioridade="urgente",
        data_prazo=date.today() - timedelta(days=5),
        criado_por=usuario_a,
    )


@pytest.fixture
def tarefa_a(db, empresa_a, projeto_a, usuario_a):
    return Tarefa.objects.create(
        empresa=empresa_a,
        projeto=projeto_a,
        titulo="Tarefa Alpha",
        descricao="Descrição da tarefa",
        status="a_fazer",
        prioridade="media",
        responsavel=usuario_a,
        data_prazo=date.today() + timedelta(days=7),
        criado_por=usuario_a,
    )


@pytest.fixture
def tarefa_atrasada(db, empresa_a, projeto_a, usuario_a):
    return Tarefa.objects.create(
        empresa=empresa_a,
        projeto=projeto_a,
        titulo="Tarefa Atrasada",
        status="em_andamento",
        prioridade="alta",
        responsavel=usuario_a,
        data_prazo=date.today() - timedelta(days=3),
        criado_por=usuario_a,
    )


def auth_client(client, usuario):
    """Autentica o client com JWT via cookie."""
    refresh = RefreshToken.for_user(usuario)
    access = str(refresh.access_token)
    client.cookies["access_token"] = access
    return client


# ════════════════════════════════════════════════════════════
# TESTES DE MODELO
# ════════════════════════════════════════════════════════════

class TestProjetoModel:
    def test_str_representation(self, projeto_a):
        assert "Projeto Alpha" in str(projeto_a)
        assert "em_andamento" in str(projeto_a)

    def test_progresso_sem_tarefas(self, projeto_a):
        assert projeto_a.progresso == 0

    def test_progresso_com_tarefas(self, db, empresa_a, projeto_a, usuario_a):
        Tarefa.objects.create(
            empresa=empresa_a, projeto=projeto_a,
            titulo="T1", status="concluido", criado_por=usuario_a,
        )
        Tarefa.objects.create(
            empresa=empresa_a, projeto=projeto_a,
            titulo="T2", status="a_fazer", criado_por=usuario_a,
        )
        # Recarrega do banco para atualizar cache de prefetch
        projeto = Projeto.objects.get(id=projeto_a.id)
        assert projeto.progresso == 50

    def test_esta_atrasado_false_com_prazo_futuro(self, projeto_a):
        assert projeto_a.esta_atrasado is False

    def test_esta_atrasado_true_com_prazo_vencido(self, projeto_atrasado):
        assert projeto_atrasado.esta_atrasado is True

    def test_esta_atrasado_false_se_concluido(self, db, empresa_a, usuario_a):
        p = Projeto.objects.create(
            empresa=empresa_a,
            nome="Concluído",
            status="concluido",
            data_prazo=date.today() - timedelta(days=1),
            criado_por=usuario_a,
        )
        assert p.esta_atrasado is False

    def test_dias_restantes_positivo(self, projeto_a):
        assert projeto_a.dias_restantes > 0

    def test_dias_restantes_negativo(self, projeto_atrasado):
        assert projeto_atrasado.dias_restantes < 0

    def test_dias_restantes_none_sem_prazo(self, db, empresa_a, usuario_a):
        p = Projeto.objects.create(
            empresa=empresa_a, nome="Sem Prazo", criado_por=usuario_a,
        )
        assert p.dias_restantes is None


class TestTarefaModel:
    def test_str_representation(self, tarefa_a):
        assert "Tarefa Alpha" in str(tarefa_a)

    def test_esta_atrasada_false(self, tarefa_a):
        assert tarefa_a.esta_atrasada is False

    def test_esta_atrasada_true(self, tarefa_atrasada):
        assert tarefa_atrasada.esta_atrasada is True

    def test_esta_atrasada_false_se_concluida(self, db, empresa_a, projeto_a, usuario_a):
        t = Tarefa.objects.create(
            empresa=empresa_a, projeto=projeto_a,
            titulo="Concluída", status="concluido",
            data_prazo=date.today() - timedelta(days=1),
            criado_por=usuario_a,
        )
        assert t.esta_atrasada is False


# ════════════════════════════════════════════════════════════
# TESTES DE REPOSITORY
# ════════════════════════════════════════════════════════════

class TestProjetoRepository:
    def test_listar_projetos_multi_tenant(self, db, empresa_a, empresa_b, projeto_a, usuario_b):
        # Cria projeto na empresa B
        Projeto.objects.create(
            empresa=empresa_b, nome="Projeto Beta", criado_por=usuario_b,
        )
        qs = ProjetoRepository.listar_projetos(empresa_a.id)
        assert all(str(p.empresa_id) == str(empresa_a.id) for p in qs)
        assert qs.count() == 1

    def test_listar_projetos_filtro_status(self, db, empresa_a, projeto_a, usuario_a):
        Projeto.objects.create(
            empresa=empresa_a, nome="Planejado", status="planejamento",
            criado_por=usuario_a,
        )
        qs = ProjetoRepository.listar_projetos(empresa_a.id, {"status": "em_andamento"})
        assert all(p.status == "em_andamento" for p in qs)

    def test_get_projeto_existente(self, projeto_a, empresa_a):
        p = ProjetoRepository.get_projeto(empresa_a.id, projeto_a.id)
        assert p is not None
        assert p.id == projeto_a.id

    def test_get_projeto_outra_empresa_retorna_none(self, projeto_a, empresa_b):
        p = ProjetoRepository.get_projeto(empresa_b.id, projeto_a.id)
        assert p is None

    def test_criar_projeto(self, db, empresa_a, usuario_a):
        p = ProjetoRepository.criar_projeto(
            empresa_a.id, usuario_a.id,
            {"nome": "Novo Projeto", "status": "planejamento", "prioridade": "media"},
        )
        assert p.id is not None
        assert p.nome == "Novo Projeto"
        assert str(p.empresa_id) == str(empresa_a.id)

    def test_soft_delete_projeto(self, projeto_a, empresa_a):
        ProjetoRepository.soft_delete_projeto(projeto_a)
        p = ProjetoRepository.get_projeto(empresa_a.id, projeto_a.id)
        assert p is None  # ativo=False não aparece na listagem

    def test_kanban_agrupa_por_status(self, db, empresa_a, projeto_a, usuario_a):
        Tarefa.objects.create(
            empresa=empresa_a, projeto=projeto_a,
            titulo="T1", status="a_fazer", criado_por=usuario_a,
        )
        Tarefa.objects.create(
            empresa=empresa_a, projeto=projeto_a,
            titulo="T2", status="em_andamento", criado_por=usuario_a,
        )
        Tarefa.objects.create(
            empresa=empresa_a, projeto=projeto_a,
            titulo="T3", status="concluido", criado_por=usuario_a,
        )
        kanban = ProjetoRepository.obter_kanban(empresa_a.id, projeto_a.id)
        assert len(kanban["a_fazer"]) == 1
        assert len(kanban["em_andamento"]) == 1
        assert len(kanban["concluido"]) == 1
        assert kanban["totais"]["a_fazer"] == 1

    def test_calcular_resumo(self, db, empresa_a, projeto_a, projeto_atrasado, tarefa_a, usuario_a):
        resumo = ProjetoRepository.calcular_resumo(empresa_a.id, usuario_a.id)
        assert resumo["total_projetos"] >= 2
        assert resumo["projetos_atrasados"] >= 1
        assert resumo["tarefas_pendentes"] >= 1
        assert "projetos_por_status" in resumo


# ════════════════════════════════════════════════════════════
# TESTES DE SERVICE
# ════════════════════════════════════════════════════════════

class TestProjetoService:
    def test_criar_projeto_invalida_cache(self, db, empresa_a, usuario_a):
        with patch("modules.projetos.services.invalidate_cache") as mock_inv:
            ProjetoService.criar_projeto(
                empresa_a.id, usuario_a.id,
                {"nome": "Projeto Cache Test", "status": "planejamento", "prioridade": "media"},
            )
            mock_inv.assert_called_once()

    def test_obter_projeto_nao_encontrado(self, empresa_a):
        with pytest.raises(ValueError, match="não encontrado"):
            ProjetoService.obter_projeto(empresa_a.id, uuid.uuid4())

    def test_deletar_projeto_com_tarefas_ativas_bloqueia(
        self, db, empresa_a, projeto_a, tarefa_a
    ):
        with pytest.raises(ValueError, match="tarefas ativas"):
            ProjetoService.deletar_projeto(empresa_a.id, projeto_a.id)

    def test_deletar_projeto_sem_tarefas_ativas(self, db, empresa_a, usuario_a):
        p = Projeto.objects.create(
            empresa=empresa_a, nome="Sem Tarefas", criado_por=usuario_a,
        )
        ProjetoService.deletar_projeto(empresa_a.id, p.id)
        assert not Projeto.objects.filter(id=p.id, ativo=True).exists()

    def test_mover_tarefa_atualiza_status(self, db, empresa_a, tarefa_a):
        tarefa = ProjetoService.mover_tarefa(
            empresa_a.id, tarefa_a.id, "em_andamento", 0
        )
        assert tarefa.status == "em_andamento"

    def test_mover_tarefa_para_concluido_preenche_data(self, db, empresa_a, tarefa_a):
        tarefa = ProjetoService.mover_tarefa(
            empresa_a.id, tarefa_a.id, "concluido", 0
        )
        assert tarefa.data_conclusao == date.today()

    def test_mover_tarefa_de_concluido_limpa_data(self, db, empresa_a, tarefa_a):
        # Primeiro mover para concluido
        ProjetoService.mover_tarefa(empresa_a.id, tarefa_a.id, "concluido", 0)
        # Depois voltar para em_andamento
        tarefa = ProjetoService.mover_tarefa(empresa_a.id, tarefa_a.id, "em_andamento", 0)
        assert tarefa.data_conclusao is None

    def test_adicionar_comentario(self, db, empresa_a, tarefa_a, usuario_a):
        comentario = ProjetoService.adicionar_comentario(
            empresa_a.id, tarefa_a.id, usuario_a.id, "Meu comentário"
        )
        assert comentario.texto == "Meu comentário"
        assert str(comentario.autor_id) == str(usuario_a.id)

    def test_editar_comentario_apenas_autor(self, db, empresa_a, tarefa_a, usuario_a, usuario_b):
        # usuario_b pertence a empresa_b, mas testamos a lógica de autor
        comentario = ProjetoService.adicionar_comentario(
            empresa_a.id, tarefa_a.id, usuario_a.id, "Original"
        )
        with pytest.raises(PermissionError):
            ProjetoService.editar_comentario(
                empresa_a.id, tarefa_a.id, comentario.id, usuario_b.id, "Editado"
            )

    def test_toggle_checklist_item(self, db, empresa_a, tarefa_a):
        item = ProjetoService.adicionar_checklist_item(
            empresa_a.id, tarefa_a.id, "Fazer algo", 0
        )
        assert item.concluido is False
        item = ProjetoService.toggle_checklist_item(empresa_a.id, tarefa_a.id, item.id)
        assert item.concluido is True
        item = ProjetoService.toggle_checklist_item(empresa_a.id, tarefa_a.id, item.id)
        assert item.concluido is False

    def test_resumo_usa_cache(self, db, empresa_a, usuario_a):
        with patch("modules.projetos.services.get_cached") as mock_get, \
             patch("modules.projetos.services.set_cached") as mock_set:
            mock_get.return_value = None  # cache miss
            ProjetoService.obter_resumo(empresa_a.id, usuario_a.id)
            mock_set.assert_called_once()

    def test_resumo_retorna_cache_se_existir(self, db, empresa_a, usuario_a):
        cached_data = {"total_projetos": 99}
        with patch("modules.projetos.services.get_cached") as mock_get:
            mock_get.return_value = cached_data
            resumo = ProjetoService.obter_resumo(empresa_a.id, usuario_a.id)
            assert resumo == cached_data


# ════════════════════════════════════════════════════════════
# TESTES DE API — PROJETOS
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestProjetoAPI:
    BASE = "/api/projetos/"

    def test_listar_sem_autenticacao(self, client):
        resp = client.get(self.BASE)
        assert resp.status_code == 401

    def test_listar_projetos_happy_path(self, client, usuario_a, projeto_a):
        c = auth_client(client, usuario_a)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "pagination" in data
        assert len(data["data"]) >= 1

    def test_listar_projetos_multi_tenant(self, client, usuario_b, projeto_a):
        """Usuário B não vê projetos da empresa A."""
        c = auth_client(client, usuario_b)
        resp = c.get(self.BASE)
        assert resp.status_code == 200
        ids = [p["id"] for p in resp.json()["data"]]
        assert str(projeto_a.id) not in ids

    def test_criar_projeto_happy_path(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            self.BASE,
            data={
                "nome": "Novo Projeto",
                "status": "planejamento",
                "prioridade": "alta",
                "data_inicio": str(date.today()),
                "data_prazo": str(date.today() + timedelta(days=30)),
            },
            content_type="application/json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["nome"] == "Novo Projeto"

    def test_criar_projeto_prazo_antes_inicio_invalido(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            self.BASE,
            data={
                "nome": "Projeto Inválido",
                "data_inicio": str(date.today() + timedelta(days=10)),
                "data_prazo": str(date.today()),
            },
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_criar_projeto_sem_nome_invalido(self, client, usuario_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            self.BASE,
            data={"status": "planejamento"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_obter_projeto_happy_path(self, client, usuario_a, projeto_a):
        c = auth_client(client, usuario_a)
        resp = c.get(f"{self.BASE}{projeto_a.id}/")
        assert resp.status_code == 200
        assert resp.json()["data"]["nome"] == "Projeto Alpha"

    def test_obter_projeto_outra_empresa_negado(self, client, usuario_b, projeto_a):
        c = auth_client(client, usuario_b)
        resp = c.get(f"{self.BASE}{projeto_a.id}/")
        assert resp.status_code == 404

    def test_atualizar_projeto_happy_path(self, client, usuario_a, projeto_a):
        c = auth_client(client, usuario_a)
        resp = c.patch(
            f"{self.BASE}{projeto_a.id}/",
            data={"nome": "Projeto Atualizado"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["nome"] == "Projeto Atualizado"

    def test_deletar_projeto_sem_tarefas(self, client, usuario_a, empresa_a):
        p = Projeto.objects.create(
            empresa=empresa_a, nome="Para Deletar", criado_por=usuario_a,
        )
        c = auth_client(client, usuario_a)
        resp = c.delete(f"{self.BASE}{p.id}/")
        assert resp.status_code == 200

    def test_deletar_projeto_com_tarefas_ativas_bloqueado(
        self, client, usuario_a, projeto_a, tarefa_a
    ):
        c = auth_client(client, usuario_a)
        resp = c.delete(f"{self.BASE}{projeto_a.id}/")
        assert resp.status_code == 400

    def test_resumo_autenticado(self, client, usuario_a, projeto_a):
        c = auth_client(client, usuario_a)
        resp = c.get(f"{self.BASE}resumo/")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "total_projetos" in data
        assert "projetos_ativos" in data
        assert "tarefas_pendentes" in data


# ════════════════════════════════════════════════════════════
# TESTES DE API — KANBAN
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestKanbanAPI:
    def test_kanban_happy_path(self, client, usuario_a, projeto_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.get(f"/api/projetos/{projeto_a.id}/kanban/")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "a_fazer" in data
        assert "em_andamento" in data
        assert "revisao" in data
        assert "concluido" in data
        assert "totais" in data

    def test_kanban_projeto_outra_empresa_negado(self, client, usuario_b, projeto_a):
        c = auth_client(client, usuario_b)
        resp = c.get(f"/api/projetos/{projeto_a.id}/kanban/")
        assert resp.status_code == 404

    def test_mover_tarefa_happy_path(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.patch(
            f"/api/projetos/tarefas/{tarefa_a.id}/mover/",
            data={"status": "em_andamento", "ordem": 0},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "em_andamento"

    def test_mover_tarefa_status_invalido(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.patch(
            f"/api/projetos/tarefas/{tarefa_a.id}/mover/",
            data={"status": "status_invalido"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_mover_tarefa_outra_empresa_negado(self, client, usuario_b, tarefa_a):
        c = auth_client(client, usuario_b)
        resp = c.patch(
            f"/api/projetos/tarefas/{tarefa_a.id}/mover/",
            data={"status": "em_andamento", "ordem": 0},
            content_type="application/json",
        )
        assert resp.status_code == 404


# ════════════════════════════════════════════════════════════
# TESTES DE API — TAREFAS
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestTarefaAPI:
    def test_listar_tarefas_projeto(self, client, usuario_a, projeto_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.get(f"/api/projetos/{projeto_a.id}/tarefas/")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) >= 1

    def test_criar_tarefa_happy_path(self, client, usuario_a, projeto_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/projetos/{projeto_a.id}/tarefas/",
            data={
                "titulo": "Nova Tarefa",
                "status": "a_fazer",
                "prioridade": "media",
            },
            content_type="application/json",
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["titulo"] == "Nova Tarefa"

    def test_criar_tarefa_sem_titulo_invalido(self, client, usuario_a, projeto_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/projetos/{projeto_a.id}/tarefas/",
            data={"status": "a_fazer"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_obter_tarefa_happy_path(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.get(f"/api/projetos/tarefas/{tarefa_a.id}/")
        assert resp.status_code == 200
        assert resp.json()["data"]["titulo"] == "Tarefa Alpha"

    def test_obter_tarefa_outra_empresa_negado(self, client, usuario_b, tarefa_a):
        c = auth_client(client, usuario_b)
        resp = c.get(f"/api/projetos/tarefas/{tarefa_a.id}/")
        assert resp.status_code == 404

    def test_deletar_tarefa_happy_path(self, client, usuario_a, empresa_a, projeto_a):
        t = Tarefa.objects.create(
            empresa=empresa_a, projeto=projeto_a,
            titulo="Para Deletar", criado_por=usuario_a,
        )
        c = auth_client(client, usuario_a)
        resp = c.delete(f"/api/projetos/tarefas/{t.id}/")
        assert resp.status_code == 204


# ════════════════════════════════════════════════════════════
# TESTES DE API — COMENTÁRIOS
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestComentarioAPI:
    def test_adicionar_comentario_happy_path(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/projetos/tarefas/{tarefa_a.id}/comentarios/",
            data={"texto": "Ótimo trabalho!"},
            content_type="application/json",
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["texto"] == "Ótimo trabalho!"

    def test_adicionar_comentario_vazio_invalido(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/projetos/tarefas/{tarefa_a.id}/comentarios/",
            data={"texto": ""},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_listar_comentarios_paginados(self, client, usuario_a, tarefa_a, empresa_a):
        for i in range(3):
            Comentario.objects.create(
                empresa=empresa_a, tarefa=tarefa_a,
                autor=usuario_a, texto=f"Comentário {i}",
            )
        c = auth_client(client, usuario_a)
        resp = c.get(f"/api/projetos/tarefas/{tarefa_a.id}/comentarios/")
        assert resp.status_code == 200
        assert "pagination" in resp.json()

    def test_editar_comentario_proprio(self, client, usuario_a, tarefa_a, empresa_a):
        com = Comentario.objects.create(
            empresa=empresa_a, tarefa=tarefa_a,
            autor=usuario_a, texto="Original",
        )
        c = auth_client(client, usuario_a)
        resp = c.patch(
            f"/api/projetos/tarefas/{tarefa_a.id}/comentarios/{com.id}/",
            data={"texto": "Editado"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["texto"] == "Editado"

    def test_editar_comentario_outro_usuario_negado(
        self, client, usuario_b, tarefa_a, empresa_a, usuario_a
    ):
        com = Comentario.objects.create(
            empresa=empresa_a, tarefa=tarefa_a,
            autor=usuario_a, texto="Original",
        )
        c = auth_client(client, usuario_b)
        resp = c.patch(
            f"/api/projetos/tarefas/{tarefa_a.id}/comentarios/{com.id}/",
            data={"texto": "Tentativa"},
            content_type="application/json",
        )
        assert resp.status_code in (403, 404)

    def test_deletar_comentario_proprio(self, client, usuario_a, tarefa_a, empresa_a):
        com = Comentario.objects.create(
            empresa=empresa_a, tarefa=tarefa_a,
            autor=usuario_a, texto="Para deletar",
        )
        c = auth_client(client, usuario_a)
        resp = c.delete(
            f"/api/projetos/tarefas/{tarefa_a.id}/comentarios/{com.id}/"
        )
        assert resp.status_code == 204


# ════════════════════════════════════════════════════════════
# TESTES DE API — CHECKLIST
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestChecklistAPI:
    def test_adicionar_item_happy_path(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/projetos/tarefas/{tarefa_a.id}/checklist/",
            data={"texto": "Fazer revisão", "ordem": 0},
            content_type="application/json",
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["texto"] == "Fazer revisão"

    def test_adicionar_item_sem_texto_invalido(self, client, usuario_a, tarefa_a):
        c = auth_client(client, usuario_a)
        resp = c.post(
            f"/api/projetos/tarefas/{tarefa_a.id}/checklist/",
            data={"texto": ""},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_toggle_item_happy_path(self, client, usuario_a, tarefa_a, empresa_a):
        item = ChecklistItem.objects.create(
            tarefa=tarefa_a, texto="Item", concluido=False,
        )
        c = auth_client(client, usuario_a)
        resp = c.patch(
            f"/api/projetos/tarefas/{tarefa_a.id}/checklist/{item.id}/",
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["concluido"] is True

    def test_deletar_item_happy_path(self, client, usuario_a, tarefa_a):
        item = ChecklistItem.objects.create(
            tarefa=tarefa_a, texto="Para deletar",
        )
        c = auth_client(client, usuario_a)
        resp = c.delete(
            f"/api/projetos/tarefas/{tarefa_a.id}/checklist/{item.id}/"
        )
        assert resp.status_code == 204


# ════════════════════════════════════════════════════════════
# TESTES DE TASKS CELERY
# ════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestProjetosTasks:
    def test_tasks_importaveis(self):
        from modules.projetos.tasks import (
            notificar_responsavel_tarefa,
            verificar_prazos_tarefas,
            verificar_projetos_atrasados,
        )
        assert callable(verificar_prazos_tarefas)
        assert callable(notificar_responsavel_tarefa)
        assert callable(verificar_projetos_atrasados)

    def test_verificar_prazos_tarefas_executa(
        self, db, empresa_a, projeto_a, tarefa_a, tarefa_atrasada
    ):
        result = verificar_prazos_tarefas()
        assert result["status"] == "ok"
        assert "notificacoes_criadas" in result

    def test_verificar_projetos_atrasados_executa(
        self, db, empresa_a, projeto_atrasado
    ):
        result = verificar_projetos_atrasados()
        assert result["status"] == "ok"
        assert result["notificacoes_criadas"] >= 0

    def test_notificar_responsavel_tarefa_inexistente(self, db):
        result = notificar_responsavel_tarefa(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result is None  # loga warning e retorna None

    def test_tasks_no_beat_schedule(self):
        from config.celery import app
        schedule = app.conf.beat_schedule
        assert "verificar-prazos-tarefas" in schedule
        assert "verificar-projetos-atrasados" in schedule


# Importações locais para os testes de tasks
from modules.projetos.tasks import (  # noqa: E402
    notificar_responsavel_tarefa,
    verificar_prazos_tarefas,
    verificar_projetos_atrasados,
)
