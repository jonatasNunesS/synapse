"""
Synapse — A lista de equipe não escala em queries com o tamanho da equipe.

ESC-02. `MembroEquipe` expunha duas contagens como propriedade, e cada uma
consultava o banco por membro. Com o FK `empresa` que `select_related` não
cobria, davam **1 + 3N**: medido em 31 queries para 10 membros e 91 para 30.

É a mesma classe do ESC-01 (a lista de projetos, 42 queries para 10), e a
correção é a mesma: `annotate` no repository, propriedade preferindo a
anotação. O que este arquivo guarda é a propriedade que importa — a contagem
de queries **não cresce** com o número de membros —, porque um `annotate`
removido por engano continuaria devolvendo os valores certos, só que caro.
"""
import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from modules.auth.models import CustomUser, Empresa
from modules.equipe.models import MembroEquipe
from modules.equipe.repository import EquipeRepository
from modules.equipe.serializers import MembroEquipeListSerializer
from modules.projetos.models import Projeto, Tarefa


def _equipe(nome, n_membros, tarefas_por_membro=1, projetos_por_membro=1):
    """Uma empresa com N membros, cada um com tarefas e projetos próprios."""
    empresa = Empresa.objects.create(nome=nome, plano="pro")
    for i in range(n_membros):
        usuario = CustomUser.objects.create_user(
            email=f"m{i}@{nome}.com", nome=f"Membro {i:02d}", senha="Senha@12345",
            empresa=empresa, perfil="colaborador",
        )
        MembroEquipe.objects.create(empresa=empresa, usuario=usuario, cargo="Dev")
        for j in range(projetos_por_membro):
            projeto = Projeto.objects.create(
                empresa=empresa, nome=f"P{i}-{j}", status="em_andamento",
                responsavel=usuario, ativo=True,
            )
            for k in range(tarefas_por_membro):
                Tarefa.objects.create(
                    empresa=empresa, projeto=projeto, titulo=f"T{i}-{j}-{k}",
                    status="a_fazer", responsavel=usuario,
                )
    return empresa


def _serializar(empresa):
    """O caminho real da listagem: repository → serializer."""
    membros = list(EquipeRepository.listar(str(empresa.id)))
    return MembroEquipeListSerializer(membros, many=True).data


def _queries_para(empresa):
    with CaptureQueriesContext(connection) as ctx:
        _serializar(empresa)
    return len(ctx)


# ════════════════════════════════════════════════════════════
# A PROPRIEDADE QUE IMPORTA
# ════════════════════════════════════════════════════════════


def test_a_contagem_de_queries_nao_cresce_com_a_equipe(db):
    """
    1 membro e 10 membros custam o mesmo número de queries.

    Comparar os dois tamanhos, e não fixar um número, é deliberado: o número
    absoluto muda com qualquer `select_related` que alguém acrescente, e o
    teste viraria manutenção. O que não pode mudar é a INCLINAÇÃO.
    """
    uma = _queries_para(_equipe("equipe-de-1", 1))
    dez = _queries_para(_equipe("equipe-de-10", 10))

    assert uma == dez, (
        f"{uma} queries para 1 membro e {dez} para 10: a listagem voltou a "
        "consultar por membro. Ver o `annotate` em EquipeRepository.listar."
    )


def test_e_nem_com_o_volume_de_tarefas_e_projetos(db):
    """Nem o que cada membro tem embaixo dele muda a conta."""
    magra = _queries_para(_equipe("magra", 5, tarefas_por_membro=1))
    cheia = _queries_para(_equipe("cheia", 5, tarefas_por_membro=4, projetos_por_membro=3))

    assert magra == cheia


# ════════════════════════════════════════════════════════════
# E OS VALORES CONTINUAM CERTOS
# ════════════════════════════════════════════════════════════


def test_as_contagens_batem_por_membro(db):
    """
    Dois `Count` sobre relações multivaloradas diferentes no mesmo queryset
    multiplicam as linhas um do outro sem `distinct=True`. Com 3 projetos e 4
    tarefas por projeto, o erro seria visível: 12 em vez de 3, ou 36 em vez
    de 12.
    """
    empresa = _equipe("conferencia", 3, tarefas_por_membro=4, projetos_por_membro=3)

    for membro in _serializar(empresa):
        assert membro["total_projetos"] == 3
        assert membro["total_tarefas_abertas"] == 12


def test_tarefa_concluida_nao_conta_como_aberta(db):
    empresa = _equipe("com-concluida", 1, tarefas_por_membro=2, projetos_por_membro=1)
    Tarefa.objects.filter(empresa=empresa).update(status="concluido")

    assert _serializar(empresa)[0]["total_tarefas_abertas"] == 0


@pytest.mark.parametrize("status", ["a_fazer", "em_andamento", "revisao"])
def test_todo_status_nao_terminal_conta_como_aberto(db, status):
    """
    Por exclusão do único status terminal, não por lista de status abertos.

    O `ERR-01` nasceu de uma lista literal com dois status que não existiam
    (`backlog`, `em_progresso`): a tela mostrava 1 tarefa aberta para quem
    tinha 3, calada. O `annotate` herda a regra por exclusão, então um status
    novo entra como aberto sozinho.
    """
    empresa = _equipe(f"status-{status}", 1, tarefas_por_membro=2, projetos_por_membro=1)
    Tarefa.objects.filter(empresa=empresa).update(status=status)

    assert _serializar(empresa)[0]["total_tarefas_abertas"] == 2


def test_projeto_concluido_nao_conta(db):
    empresa = _equipe("projeto-fechado", 1, projetos_por_membro=2)
    Projeto.objects.filter(empresa=empresa).update(status="concluido")

    assert _serializar(empresa)[0]["total_projetos"] == 0


def test_nao_conta_o_que_e_de_outra_empresa(db):
    """
    Multi-tenant: a contagem via `annotate` atravessa `usuario`, e um usuário
    poderia ter registros de outra empresa. O filtro por `empresa_id` nas duas
    anotações é o que impede o vazamento — sem ele, o número da tela de uma
    empresa incluiria trabalho de outra.
    """
    empresa = _equipe("minha", 1, tarefas_por_membro=2, projetos_por_membro=1)
    membro = MembroEquipe.objects.get(empresa=empresa)

    outra = Empresa.objects.create(nome="Outra", plano="pro")
    projeto_alheio = Projeto.objects.create(
        empresa=outra, nome="Projeto de fora", status="em_andamento",
        responsavel=membro.usuario, ativo=True,
    )
    Tarefa.objects.create(
        empresa=outra, projeto=projeto_alheio, titulo="Tarefa de fora",
        status="a_fazer", responsavel=membro.usuario,
    )

    dados = _serializar(empresa)[0]
    assert dados["total_projetos"] == 1
    assert dados["total_tarefas_abertas"] == 2


def test_membro_sem_nada_conta_zero(db):
    empresa = Empresa.objects.create(nome="vazia", plano="pro")
    usuario = CustomUser.objects.create_user(
        email="so@vazia.com", nome="Sozinho", senha="Senha@12345",
        empresa=empresa, perfil="colaborador",
    )
    MembroEquipe.objects.create(empresa=empresa, usuario=usuario, cargo="Dev")

    dados = _serializar(empresa)[0]
    assert dados["total_tarefas_abertas"] == 0
    assert dados["total_projetos"] == 0


# ════════════════════════════════════════════════════════════
# FORA DA LISTAGEM, A PROPRIEDADE AINDA CONSULTA
# ════════════════════════════════════════════════════════════


def test_membro_obtido_fora_da_listagem_ainda_responde(db):
    """
    A anotação é do `listar`. Quem pega o membro por outro caminho — o
    detalhe, por exemplo — cai na consulta da propriedade, e ela continua lá
    justamente para isso.
    """
    empresa = _equipe("detalhe", 1, tarefas_por_membro=3, projetos_por_membro=1)
    membro = MembroEquipe.objects.get(empresa=empresa)  # sem annotate

    assert membro.total_tarefas_abertas == 3
    assert membro.total_projetos == 1
