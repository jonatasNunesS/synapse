"""
Synapse — Dashboard: falha não é zero, e lista vazia não é falha.

Testes do ERR-04 (Leva 3 do CODE_HEALTH_AUDIT.md). O que está sendo defendido
aqui é uma distinção de três estados que o payload antigo achatava em dois:

    bloco preenchido  → o banco respondeu
    bloco `null`      → o banco não respondeu
    lista `[]`        → respondeu, e não há nada no período

Antes, "não respondeu" e "não há nada" eram a mesma coisa, e a tela escolhia a
leitura mais tranquilizadora das duas.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.db import InterfaceError, OperationalError
from rest_framework_simplejwt.tokens import RefreshToken

from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Lancamento


def auth_client(client, usuario):
    refresh = RefreshToken.for_user(usuario)
    client.cookies["access_token"] = str(refresh.access_token)
    return client


@pytest.fixture
def empresa(db):
    return Empresa.objects.create(
        nome="Empresa Degradação",
        cnpj="44.444.444/0001-44",
        plano="basico",
    )


@pytest.fixture
def usuario(db, empresa):
    return CustomUser.objects.create_user(
        email="deg@empresa.com",
        nome="Usuário Degradação",
        senha="Deg@123456789",
        empresa=empresa,
        perfil="admin",
    )


@pytest.fixture
def lancamento_a_vencer(db, empresa, usuario):
    """Um vencimento real, para separar lista vazia de lista não consultada."""
    return Lancamento.objects.create(
        empresa=empresa,
        descricao="Aluguel",
        valor=Decimal("1500.00"),
        tipo="despesa",
        status="pendente",
        data_vencimento=date.today() + timedelta(days=2),
        criado_por=usuario,
    )


# ════════════════════════════════════════════════════════════
# RESUMO PRINCIPAL — degradação por bloco
# ════════════════════════════════════════════════════════════


class TestResumoDegradado:
    BASE = "/api/dashboard/resumo/"

    def test_bloco_que_falha_vem_null_e_nao_zerado(self, client, usuario):
        """
        O teste central da leva.

        Com o financeiro fora do ar, o campo `total_receitas` NÃO pode existir
        valendo 0 — esse zero é a afirmação "a empresa não faturou neste mês",
        e ninguém chegou a olhar.
        """
        c = auth_client(client, usuario)
        with patch(
            "modules.financeiro.services.FinanceiroService.obter_resumo",
            side_effect=OperationalError("could not connect to server"),
        ):
            resp = c.get(self.BASE)

        assert resp.status_code == 200, "um bloco fora do ar não derruba a tela"
        data = resp.json()["data"]
        assert data["financeiro"] is None

    def test_os_outros_blocos_sobrevivem_a_falha_de_um(self, client, usuario):
        """Resiliência continua: o CRM não é arrastado pelo financeiro."""
        c = auth_client(client, usuario)
        with patch(
            "modules.financeiro.services.FinanceiroService.obter_resumo",
            side_effect=OperationalError("timeout"),
        ):
            resp = c.get(self.BASE)

        data = resp.json()["data"]
        assert data["financeiro"] is None
        assert data["crm"] is not None
        assert data["estoque"] is not None
        assert data["projetos"] is not None
        # `meta` é montado localmente, sem banco: nunca degrada.
        assert data["meta"]["mes"] == date.today().month

    def test_empresa_sem_movimento_tem_zero_de_verdade(self, client, usuario):
        """
        O contraponto, e é ele que impede o excesso de zelo.

        Empresa nova, sem lançamento nenhum: o bloco TEM de vir preenchido com
        zero. Transformar "não houve receita" em "indisponível" trocaria uma
        mentira por outra, e essa esconderia o fato de que o mês está vazio.
        """
        c = auth_client(client, usuario)
        resp = c.get(self.BASE)

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["financeiro"] is not None
        assert data["financeiro"]["total_receitas"] == 0
        assert data["financeiro"]["lancamentos_count"] == 0
        assert data["crm"] is not None
        assert data["crm"]["total_clientes"] == 0

    def test_interface_error_tambem_e_falha_de_infra(self, client, usuario):
        """Conexão quebrada por baixo do banco conta como degradação."""
        c = auth_client(client, usuario)
        with patch(
            "modules.clientes.repository.ClienteRepository.calcular_resumo",
            side_effect=InterfaceError("connection already closed"),
        ):
            resp = c.get(self.BASE)

        assert resp.status_code == 200
        assert resp.json()["data"]["crm"] is None

    def test_bug_de_codigo_nao_se_disfarca_de_indisponivel(self, client, usuario):
        """
        A metade esquecida do ERR-04.

        Marcar o bloco como indisponível já seria melhor que zerá-lo. Mas um
        bug de código marcado como indisponível também não é investigado:
        parece banco instável. Então ele sobe, e a view devolve erro.
        """
        c = auth_client(client, usuario)
        with patch(
            "modules.clientes.repository.ClienteRepository.calcular_resumo",
            side_effect=AttributeError("'NoneType' object has no attribute 'nome'"),
        ):
            resp = c.get(self.BASE)

        assert resp.status_code >= 500
        # E não um 200 com o bloco em null, que é o que o engolimento daria.
        assert resp.status_code != 200

    def test_resposta_degradada_nao_entra_no_cache(self, usuario):
        """
        Guardar a falha repetiria a falha por todo o TTL.

        O banco volta em dez segundos e a tela seguiria dizendo "não foi
        possível carregar" por cinco minutos, sem nada de errado acontecendo.
        Pior ainda no código antigo, que guardava os ZEROS por cinco minutos.
        """
        from modules.dashboard.services import DashboardService

        with patch("modules.dashboard.services.set_cached") as mock_set:
            with patch(
                "modules.financeiro.services.FinanceiroService.obter_resumo",
                side_effect=OperationalError("caiu"),
            ):
                DashboardService.obter_resumo_principal(usuario.empresa_id, usuario.id)
            assert not mock_set.called, "resposta degradada foi para o cache"

    def test_resposta_completa_entra_no_cache(self, usuario):
        """O contraponto: sem degradação, o cache continua funcionando."""
        from modules.dashboard.services import DashboardService

        with patch("modules.dashboard.services.set_cached") as mock_set:
            DashboardService.obter_resumo_principal(usuario.empresa_id, usuario.id)
            assert mock_set.called

    def test_bloco_de_projetos_responde_de_verdade(self, usuario):
        """
        Regressão do import errado que o `except Exception` escondia.

        Era `ProjetosRepository`, classe que nunca existiu. O bloco saiu zerado
        para todas as empresas desde que a linha foi escrita — e zerado, não
        indisponível, porque o ImportError era engolido junto com o resto.
        """
        from modules.projetos.models import Projeto, Tarefa

        projeto = Projeto.objects.create(
            empresa=usuario.empresa,
            nome="Projeto que existe",
            status="em_andamento",
            responsavel=usuario,
            ativo=True,
        )
        Tarefa.objects.create(
            empresa=usuario.empresa,
            projeto=projeto,
            titulo="Tarefa aberta",
            status="a_fazer",
            responsavel=usuario,
        )

        from modules.dashboard.services import DashboardService

        resumo = DashboardService.obter_resumo_principal(usuario.empresa_id, usuario.id)

        assert resumo["projetos"] is not None
        assert resumo["projetos"]["projetos_ativos"] == 1
        assert resumo["projetos"]["tarefas_minhas"] == 1


# ════════════════════════════════════════════════════════════
# ENDPOINTS DE LISTA — `null` não é `[]`
# ════════════════════════════════════════════════════════════


class TestListasDegradadas:
    """
    Cada endpoint de lista tem os dois casos lado a lado, de propósito: é o
    par que prova a distinção. Um teste só de falha passaria com o endpoint
    devolvendo `null` sempre.
    """

    CASOS = [
        ("/api/dashboard/vencimentos/", "vencimentos",
         "modules.financeiro.repository.FinanceiroRepository.listar_vencimentos_proximos"),
        ("/api/dashboard/followups/", "followups",
         "modules.clientes.repository.ClienteRepository.listar_followups_proximos"),
        ("/api/dashboard/alertas-estoque/", "alertas",
         "modules.estoque.repository.EstoqueRepository.listar_alertas"),
        ("/api/dashboard/fluxo-caixa/", "fluxo",
         "modules.financeiro.services.FinanceiroService.obter_fluxo_caixa"),
    ]

    @pytest.mark.parametrize("url,chave,alvo", CASOS)
    def test_falha_devolve_null(self, client, usuario, url, chave, alvo):
        c = auth_client(client, usuario)
        with patch(alvo, side_effect=OperationalError("banco fora")):
            resp = c.get(url)

        assert resp.status_code == 200
        corpo = resp.json()["data"]
        assert corpo[chave] is None, (
            f"{chave} veio como {corpo[chave]!r}: lista vazia numa falha afirma "
            "que não existe nada no período, e ninguém consultou o período"
        )

    @pytest.mark.parametrize("url,chave,alvo", CASOS)
    def test_sem_dados_devolve_lista_vazia(self, client, usuario, url, chave, alvo):
        c = auth_client(client, usuario)
        resp = c.get(url)

        assert resp.status_code == 200
        corpo = resp.json()["data"]
        assert corpo[chave] == [], f"{chave} devia ser [] numa empresa sem dados"

    def test_lista_com_dados_continua_vindo(self, client, usuario, lancamento_a_vencer):
        """Terceiro estado: respondeu e tem conteúdo."""
        c = auth_client(client, usuario)
        resp = c.get("/api/dashboard/vencimentos/")

        vencimentos = resp.json()["data"]["vencimentos"]
        assert vencimentos is not None
        assert len(vencimentos) == 1
        assert vencimentos[0]["descricao"] == "Aluguel"

    def test_funil_degradado_nao_vira_dicionario_vazio(self, client, usuario):
        """
        O funil tinha a armadilha extra: `success_response` converte `data=None`
        em `{}`, e o front leria isso como "veio, só está vazio". Por isso o
        null vai dentro da chave `etapas`.

        Também é onde a mentira era mais fotogênica: seis etapas em zero
        desenham o funil de uma empresa que nunca vendeu nada.
        """
        c = auth_client(client, usuario)
        with patch(
            "modules.clientes.repository.ClienteRepository.calcular_resumo",
            side_effect=OperationalError("banco fora"),
        ):
            resp = c.get("/api/dashboard/funil-vendas/")

        assert resp.status_code == 200
        assert resp.json()["data"]["etapas"] is None

    def test_funil_sem_clientes_tem_as_seis_etapas_em_zero(self, client, usuario):
        """Empresa sem cliente nenhum: as etapas existem, zeradas. É resposta."""
        c = auth_client(client, usuario)
        resp = c.get("/api/dashboard/funil-vendas/")

        etapas = resp.json()["data"]["etapas"]
        assert etapas is not None
        assert len(etapas) == 6
        assert all(e["count"] == 0 for e in etapas)

    def test_atividade_degradada_vem_null(self, client, usuario):
        c = auth_client(client, usuario)
        with patch(
            "modules.financeiro.models.Lancamento.objects.filter",
            side_effect=OperationalError("banco fora"),
        ):
            resp = c.get("/api/dashboard/atividade/")

        assert resp.status_code == 200
        assert resp.json()["data"]["eventos"] is None

    def test_modulo_desligado_nao_e_falha(self, client, usuario, empresa):
        """
        A fronteira do outro lado.

        Agenda desligada devolve `[]`, não `null`: é uma decisão da empresa, e
        o backend sabe a resposta. Marcar como indisponível faria a tela
        oferecer "Tentar de novo" para algo que vai responder igual sempre.
        """
        empresa.modulo_agenda = False
        empresa.save(update_fields=["modulo_agenda"])

        c = auth_client(client, usuario)
        resp = c.get("/api/dashboard/proximos-compromissos/")

        assert resp.status_code == 200
        assert resp.json()["data"]["compromissos"] == []
