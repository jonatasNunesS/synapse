"""
Synapse — Equipe: as contagens que a tela mostra (CODE_HEALTH_AUDIT, ERR-01).

O bug que estes testes existem para não deixar voltar: `total_tarefas_abertas`
filtrava por `status__in=["backlog", "a_fazer", "em_progresso"]`, e dois desses
três status NÃO EXISTEM em `Tarefa.STATUS_CHOICES`. Um `status__in` com valor
inexistente não levanta erro — só não casa. A tela da equipe mostrava 1 tarefa
aberta para quem tinha 3, sem erro nenhum.

O teste central é `test_conta_uma_tarefa_de_cada_status`: ele cria uma tarefa
em cada status possível e afirma o número, então qualquer status esquecido
aparece como diferença.
"""
import pytest

from modules.auth.models import CustomUser, Empresa
from modules.equipe.models import MembroEquipe
from modules.projetos.models import TAREFA_STATUS_CONCLUIDO, Projeto, Tarefa


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Contagens", plano="starter")


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="membro@contagens.com", nome="Membro", senha="Senha@12345",
        empresa=empresa, perfil="colaborador",
    )


@pytest.fixture
def membro(db, empresa, usuario):
    return MembroEquipe.objects.create(empresa=empresa, usuario=usuario)


@pytest.fixture
def projeto(db, empresa):
    return Projeto.objects.create(empresa=empresa, nome="Projeto das contagens")


def _tarefa(empresa, projeto, status, responsavel=None, titulo=None):
    return Tarefa.objects.create(
        empresa=empresa, projeto=projeto,
        titulo=titulo or f"Tarefa {status}",
        status=status, responsavel=responsavel,
    )


# ═══════════════════════════════════════════════════════════════════════════
# O teste que pega o ERR-01
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_conta_uma_tarefa_de_cada_status(membro, empresa, projeto, usuario):
    """
    Uma tarefa em cada status: abertas são TODAS menos a concluída.

    Com a lista literal antiga este teste devolvia 1 (só `a_fazer`), porque
    `em_andamento` e `revisao` não constavam dela.
    """
    todos = [valor for valor, _ in Tarefa.STATUS_CHOICES]
    for status in todos:
        _tarefa(empresa, projeto, status, responsavel=usuario)

    esperado = len(todos) - 1  # tudo menos `concluido`

    assert membro.total_tarefas_abertas == esperado


@pytest.mark.django_db
def test_tarefa_em_andamento_conta_como_aberta(membro, empresa, projeto, usuario):
    """O status que a lista antiga escrevia errado ("em_progresso")."""
    _tarefa(empresa, projeto, "em_andamento", responsavel=usuario)

    assert membro.total_tarefas_abertas == 1


@pytest.mark.django_db
def test_tarefa_em_revisao_conta_como_aberta(membro, empresa, projeto, usuario):
    """Revisão não estava na lista antiga de jeito nenhum."""
    _tarefa(empresa, projeto, "revisao", responsavel=usuario)

    assert membro.total_tarefas_abertas == 1


@pytest.mark.django_db
def test_concluida_nao_conta(membro, empresa, projeto, usuario):
    _tarefa(empresa, projeto, TAREFA_STATUS_CONCLUIDO, responsavel=usuario)

    assert membro.total_tarefas_abertas == 0


@pytest.mark.django_db
def test_sem_tarefa_conta_zero(membro):
    assert membro.total_tarefas_abertas == 0


@pytest.mark.django_db
def test_status_novo_entraria_como_aberto(membro, empresa, projeto, usuario):
    """
    A razão de ser do `.exclude()`: um status que ninguém previu conta como
    ABERTO, que é o padrão seguro. Com a lista literal ele seria esquecido em
    silêncio — o mesmo defeito, de novo.

    Grava direto no banco porque `status` só valida em `full_clean()`.
    """
    t = _tarefa(empresa, projeto, "a_fazer", responsavel=usuario)
    Tarefa.objects.filter(pk=t.pk).update(status="pausada_para_revisao_externa")

    assert membro.total_tarefas_abertas == 1


# ═══════════════════════════════════════════════════════════════════════════
# Multi-tenant e escopo da pessoa
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_nao_conta_tarefa_de_outra_pessoa(membro, empresa, projeto, usuario):
    outra = CustomUser.objects.create_user(
        email="outra@contagens.com", nome="Outra", senha="Senha@12345",
        empresa=empresa, perfil="colaborador",
    )
    _tarefa(empresa, projeto, "a_fazer", responsavel=outra)
    _tarefa(empresa, projeto, "a_fazer", responsavel=usuario)

    assert membro.total_tarefas_abertas == 1


@pytest.mark.django_db
def test_nao_conta_tarefa_sem_responsavel(membro, empresa, projeto):
    _tarefa(empresa, projeto, "a_fazer", responsavel=None)

    assert membro.total_tarefas_abertas == 0


@pytest.mark.django_db
def test_nao_atravessa_empresa(membro, empresa, projeto, usuario):
    """
    A guarda por empresa continua valendo depois da troca para `.exclude()`.

    O mesmo usuário com tarefa numa empresa vizinha não entra na contagem.
    """
    vizinha = Empresa.objects.create(nome="Vizinha", plano="starter")
    proj_vizinho = Projeto.objects.create(empresa=vizinha, nome="Do vizinho")
    _tarefa(vizinha, proj_vizinho, "a_fazer", responsavel=usuario)

    assert membro.total_tarefas_abertas == 0


# ═══════════════════════════════════════════════════════════════════════════
# A tela: a contagem chega na listagem de membros
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_a_listagem_de_membros_publica_a_contagem_certa(
    membro, empresa, projeto, usuario
):
    """
    Não basta a propriedade estar certa — é pela listagem que a tela lê.
    """
    from modules.equipe.serializers import MembroEquipeListSerializer

    for status in ("a_fazer", "em_andamento", "revisao", TAREFA_STATUS_CONCLUIDO):
        _tarefa(empresa, projeto, status, responsavel=usuario)

    dados = MembroEquipeListSerializer([membro], many=True).data

    assert dados[0]["total_tarefas_abertas"] == 3
