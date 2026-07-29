"""
Synapse — Kanban da Equipe: testes de backend.

Cobre: seed de colunas ao criar empresa; CRUD de colunas (admin) e 403 para
não-admin; reordenar; excluir coluna com tarefas (400 sem mover / OK com mover);
tarefas pessoais (permissões admin vs membro); mover tarefa; board consolidado
com tarefas pessoais + de projeto (read-only); multi-tenant.
"""
import pytest
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.equipe.models import ColunaKanbanEquipe, TarefaPessoal
from modules.projetos.models import Projeto, Tarefa


@pytest.fixture(autouse=True)
def _limpa_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def empresa_a(db):
    return Empresa.objects.create(nome="Alpha Kanban", plano="pro")


@pytest.fixture
def empresa_b(db):
    return Empresa.objects.create(nome="Beta Kanban", plano="pro")


@pytest.fixture
def admin_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="admin@alpha.com", nome="Admin A", senha="Senha@12345",
        empresa=empresa_a, perfil="admin",
    )


@pytest.fixture
def membro_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="colab@alpha.com", nome="Colab A", senha="Senha@12345",
        empresa=empresa_a, perfil="colaborador",
    )


@pytest.fixture
def outro_membro_a(db, empresa_a):
    return CustomUser.objects.create_user(
        email="colab2@alpha.com", nome="Colab A2", senha="Senha@12345",
        empresa=empresa_a, perfil="colaborador",
    )


@pytest.fixture
def admin_b(db, empresa_b):
    return CustomUser.objects.create_user(
        email="admin@beta.com", nome="Admin B", senha="Senha@12345",
        empresa=empresa_b, perfil="admin",
    )


def _client(user):
    from rest_framework.test import APIClient
    c = APIClient()
    c.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return c


def _colunas(empresa):
    return list(
        ColunaKanbanEquipe.objects.filter(empresa=empresa).order_by("ordem")
    )


# ── Seed de colunas ao criar empresa ────────────────────────────────────────

@pytest.mark.django_db
def test_seed_colunas_ao_criar_empresa(empresa_a):
    cols = _colunas(empresa_a)
    assert [c.nome for c in cols] == ["A Fazer", "Em Andamento", "Concluído"]
    assert [c.ordem for c in cols] == [1, 2, 3]


# ── Colunas: CRUD e permissão ───────────────────────────────────────────────

@pytest.mark.django_db
def test_criar_coluna_admin_201(admin_a):
    r = _client(admin_a).post(
        "/api/equipe/kanban/colunas/", {"nome": "Revisão", "cor": "#facc15"}, format="json"
    )
    assert r.status_code == 201
    assert r.json()["data"]["nome"] == "Revisão"


@pytest.mark.django_db
def test_criar_coluna_nao_admin_403(membro_a):
    r = _client(membro_a).post(
        "/api/equipe/kanban/colunas/", {"nome": "Nova"}, format="json"
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_reordenar_colunas(admin_a, empresa_a):
    cols = _colunas(empresa_a)
    # Inverte a ordem das 3 colunas padrão.
    payload = [
        {"id": str(cols[0].id), "ordem": 3},
        {"id": str(cols[1].id), "ordem": 2},
        {"id": str(cols[2].id), "ordem": 1},
    ]
    r = _client(admin_a).post(
        "/api/equipe/kanban/colunas/reordenar/", payload, format="json"
    )
    assert r.status_code == 200
    cols[0].refresh_from_db()
    cols[2].refresh_from_db()
    assert cols[0].ordem == 3
    assert cols[2].ordem == 1
    # A resposta vem ordenada pela nova ordem.
    nomes = [c["nome"] for c in r.json()["data"]]
    assert nomes[0] == "Concluído"


@pytest.mark.django_db
def test_excluir_coluna_com_tarefas_sem_mover_400(admin_a, empresa_a):
    col = _colunas(empresa_a)[0]
    TarefaPessoal.objects.create(
        empresa=empresa_a, coluna=col, titulo="T", responsavel=admin_a
    )
    r = _client(admin_a).delete(f"/api/equipe/kanban/colunas/{col.id}/")
    assert r.status_code == 400
    assert ColunaKanbanEquipe.objects.filter(id=col.id).exists()


@pytest.mark.django_db
def test_excluir_coluna_com_tarefas_movendo_ok(admin_a, empresa_a):
    cols = _colunas(empresa_a)
    origem, destino = cols[0], cols[1]
    t = TarefaPessoal.objects.create(
        empresa=empresa_a, coluna=origem, titulo="T", responsavel=admin_a
    )
    r = _client(admin_a).delete(
        f"/api/equipe/kanban/colunas/{origem.id}/",
        {"mover_para": str(destino.id)}, format="json",
    )
    assert r.status_code == 204
    assert not ColunaKanbanEquipe.objects.filter(id=origem.id).exists()
    t.refresh_from_db()
    assert str(t.coluna_id) == str(destino.id)


# ── Tarefas pessoais: permissões ────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_cria_tarefa_para_outro_membro_201(admin_a, membro_a, empresa_a):
    col = _colunas(empresa_a)[0]
    r = _client(admin_a).post(
        "/api/equipe/tarefas/",
        {"coluna": str(col.id), "titulo": "Ligar pro cliente", "responsavel": str(membro_a.id)},
        format="json",
    )
    assert r.status_code == 201
    assert TarefaPessoal.objects.filter(responsavel=membro_a).count() == 1


@pytest.mark.django_db
def test_membro_cria_tarefa_para_outro_403(membro_a, outro_membro_a, empresa_a):
    col = _colunas(empresa_a)[0]
    r = _client(membro_a).post(
        "/api/equipe/tarefas/",
        {"coluna": str(col.id), "titulo": "X", "responsavel": str(outro_membro_a.id)},
        format="json",
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_membro_cria_tarefa_para_si_201(membro_a, empresa_a):
    col = _colunas(empresa_a)[0]
    r = _client(membro_a).post(
        "/api/equipe/tarefas/",
        {"coluna": str(col.id), "titulo": "Minha tarefa", "responsavel": str(membro_a.id)},
        format="json",
    )
    assert r.status_code == 201


@pytest.mark.django_db
def test_membro_nao_edita_tarefa_de_outro_403(membro_a, outro_membro_a, empresa_a):
    col = _colunas(empresa_a)[0]
    t = TarefaPessoal.objects.create(
        empresa=empresa_a, coluna=col, titulo="T", responsavel=outro_membro_a
    )
    r = _client(membro_a).patch(
        f"/api/equipe/tarefas/{t.id}/", {"titulo": "hack"}, format="json"
    )
    assert r.status_code == 403


# ── Mover tarefa ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_mover_tarefa_atualiza_coluna(admin_a, empresa_a):
    cols = _colunas(empresa_a)
    t = TarefaPessoal.objects.create(
        empresa=empresa_a, coluna=cols[0], titulo="T", responsavel=admin_a
    )
    r = _client(admin_a).post(
        f"/api/equipe/tarefas/{t.id}/mover/",
        {"coluna_id": str(cols[1].id), "ordem_na_coluna": 2}, format="json",
    )
    assert r.status_code == 200
    t.refresh_from_db()
    assert str(t.coluna_id) == str(cols[1].id)
    assert t.ordem == 2


# ── Board consolidado ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_kanban_retorna_pessoais_e_projeto(admin_a, membro_a, empresa_a):
    cols = _colunas(empresa_a)
    a_fazer, em_andamento = cols[0], cols[1]
    # Tarefa pessoal do membro
    TarefaPessoal.objects.create(
        empresa=empresa_a, coluna=a_fazer, titulo="Pessoal do membro", responsavel=membro_a
    )
    # Tarefa de projeto do membro, apontando pra coluna em_andamento
    proj = Projeto.objects.create(empresa=empresa_a, nome="Projeto X")
    Tarefa.objects.create(
        empresa=empresa_a, projeto=proj, titulo="Tarefa de projeto",
        responsavel=membro_a, coluna_kanban_equipe=em_andamento,
    )
    # Tarefa de projeto SEM coluna → não deve aparecer
    Tarefa.objects.create(
        empresa=empresa_a, projeto=proj, titulo="Sem coluna", responsavel=membro_a
    )

    r = _client(admin_a).get(f"/api/equipe/kanban/?membro={membro_a.id}")
    assert r.status_code == 200
    colunas = r.json()["data"]["colunas"]
    por_nome = {c["nome"]: c for c in colunas}

    pessoais = por_nome["A Fazer"]["tarefas"]
    assert len(pessoais) == 1
    assert pessoais[0]["origem"] == "pessoal"
    assert pessoais[0]["read_only"] is False

    projeto_tasks = por_nome["Em Andamento"]["tarefas"]
    assert len(projeto_tasks) == 1
    assert projeto_tasks[0]["origem"] == "projeto"
    assert projeto_tasks[0]["read_only"] is True
    assert projeto_tasks[0]["projeto_nome"] == "Projeto X"

    # "Concluído" fica vazia; a de projeto sem coluna não aparece em lugar nenhum
    titulos = [t["titulo"] for c in colunas for t in c["tarefas"]]
    assert "Sem coluna" not in titulos


@pytest.mark.django_db
def test_kanban_multitenant(admin_a, admin_b, empresa_a, empresa_b):
    col_a = _colunas(empresa_a)[0]
    TarefaPessoal.objects.create(
        empresa=empresa_a, coluna=col_a, titulo="Secreta da Alpha", responsavel=admin_a
    )
    # admin da empresa B não enxerga tarefas da Alpha
    r = _client(admin_b).get("/api/equipe/kanban/")
    titulos = [t["titulo"] for c in r.json()["data"]["colunas"] for t in c["tarefas"]]
    assert "Secreta da Alpha" not in titulos


@pytest.mark.django_db
def test_tarefa_projeto_readonly_no_kanban_equipe(admin_a, membro_a, empresa_a):
    """
    A tarefa de projeto não é uma TarefaPessoal — não há endpoint de mover dela
    no kanban da equipe. Mover é feito no projeto. Aqui garantimos que ela vem
    marcada read_only e que o endpoint de mover pessoal não a encontra.
    """
    cols = _colunas(empresa_a)
    proj = Projeto.objects.create(empresa=empresa_a, nome="P")
    tp = Tarefa.objects.create(
        empresa=empresa_a, projeto=proj, titulo="Proj task",
        responsavel=membro_a, coluna_kanban_equipe=cols[0],
    )
    # Tentar mover pelo endpoint de tarefa pessoal → 400 (não é tarefa pessoal)
    r = _client(admin_a).post(
        f"/api/equipe/tarefas/{tp.id}/mover/",
        {"coluna_id": str(cols[1].id)}, format="json",
    )
    assert r.status_code == 400
