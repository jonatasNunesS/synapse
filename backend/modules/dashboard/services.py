"""
Synapse — M8 Dashboard: Service Consolidado
Agrega dados de todos os módulos (M2–M7) em um único payload.
Cache Redis: synapse:{empresa_id}:dashboard:resumo (TTL 5 min)
"""
import logging
from datetime import date, timedelta

from django.db import DatabaseError, InterfaceError

from shared.cache import build_cache_key, get_cached, set_cached

logger = logging.getLogger("synapse")

# ── O que conta como "o dado não veio" ───────────────────────────────
#
# O dashboard continua resiliente: um bloco que falha não derruba a tela. Mas
# resiliente não é mudo. Antes, `except Exception` transformava QUALQUER falha
# em estrutura zerada, e a tela mostrava esse zero como se fosse resposta do
# banco — número errado com cara de certo.
#
# Duas mudanças, e as duas importam:
#
# 1. O valor de falha deixou de ser zero e passou a ser None. Ausência não é
#    zero: zero é informação ("não vendeu nada"), falha é outra coisa e precisa
#    aparecer como falha. É a mesma regra que o `formatCurrency` do front já
#    seguia sozinho, mostrando "—" para ausência.
#
# 2. Só o que é falha de infraestrutura é tratado. Um AttributeError nascido de
#    refatoração NÃO vira "indisponível" plausível: ele estoura, sobe para o
#    handler da view, cai no log com traceback e no Sentry. Bug mudo é pior que
#    bug barulhento, porque ninguém vai procurar.
#
# DatabaseError cobre o que o banco relata (timeout de statement vira
# OperationalError, esquema fora de hora vira ProgrammingError); InterfaceError
# cobre a conexão quebrada por baixo. Fora disso, é bug de código.
FALHAS_DE_INFRA = (DatabaseError, InterfaceError)


def _guardar_se_completo(cache_key: str, resultado: dict, ttl: int) -> None:
    """
    Só põe no cache o que veio inteiro.

    Guardar um bloco indisponível seria repetir a falha por todo o TTL: o banco
    volta em dez segundos e a tela segue dizendo "não foi possível carregar"
    por cinco minutos, sem nada de errado acontecendo. O código antigo fazia
    isso com os zeros — e um zero errado guardado por cinco minutos é pior
    ainda, porque ninguém desconfia dele.
    """
    if any(valor is None for valor in resultado.values()):
        logger.info("Dashboard: resposta degradada não vai para o cache")
        return
    set_cached(cache_key, resultado, ttl)


def _logar_falha(bloco: str, erro: Exception) -> None:
    """
    Registra a indisponibilidade de um bloco com o tipo real da exceção.

    O tipo entra na mensagem porque "erro ao obter resumo financeiro" sozinho
    não diz se o banco caiu ou se a query estourou o tempo — e é essa
    diferença que decide se alguém precisa ser acordado.
    """
    logger.warning(
        "Dashboard: %s indisponível — %s: %s",
        bloco,
        type(erro).__name__,
        erro,
        exc_info=True,
    )

# TTLs
TTL_DASHBOARD = 300       # 5 min — resumo principal
TTL_ATIVIDADE = 120       # 2 min — feed de atividade recente
TTL_VENCIMENTOS = 120     # 2 min — vencimentos próximos
TTL_FOLLOWUPS = 120       # 2 min — follow-ups próximos
TTL_COMPROMISSOS = 120    # 2 min — próximos compromissos da agenda
TTL_TAREFAS = 120         # 2 min — minhas tarefas
TTL_ALERTAS = 300         # 5 min — alertas de estoque
TTL_PROJETOS_WIDGET = 300 # 5 min — projetos em andamento


class DashboardService:
    """Serviço que consolida KPIs de todos os módulos para o Dashboard."""

    # ── Resumo Principal ─────────────────────────────────────
    @staticmethod
    def obter_resumo_principal(empresa_id, usuario_id) -> dict:
        """
        Retorna KPIs consolidados de todos os módulos.
        Cache Redis TTL 5 min.

        Cada bloco vem preenchido ou vem `None`. `None` é o bloco que não
        respondeu, e a tela mostra aviso no lugar do número. Bloco que
        respondeu zero continua zero, porque zero é resposta.
        """
        cache_key = build_cache_key(
            empresa_id, "dashboard", "resumo", {"uid": str(usuario_id)}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        hoje = date.today()
        mes = hoje.month
        ano = hoje.year

        # ── Financeiro ────────────────────────────────────────
        try:
            from modules.financeiro.services import FinanceiroService
            financeiro = FinanceiroService.obter_resumo(empresa_id, mes, ano)
        except FALHAS_DE_INFRA as e:
            _logar_falha("resumo financeiro", e)
            financeiro = None

        # ── Estoque ───────────────────────────────────────────
        try:
            from modules.estoque.repository import EstoqueRepository
            estoque = EstoqueRepository.calcular_relatorio(empresa_id)
        except FALHAS_DE_INFRA as e:
            _logar_falha("resumo de estoque", e)
            estoque = None

        # ── CRM ───────────────────────────────────────────────
        try:
            from modules.clientes.repository import ClienteRepository
            crm = ClienteRepository.calcular_resumo(empresa_id)
        except FALHAS_DE_INFRA as e:
            _logar_falha("resumo do CRM", e)
            crm = None

        # ── Projetos ──────────────────────────────────────────
        try:
            # `ProjetoRepository`, singular. Estava `ProjetosRepository` aqui, e
            # a classe com esse nome nunca existiu: o `except Exception` engolia
            # o ImportError e o bloco saía zerado. Medido numa empresa com 1
            # projeto ativo e 2 tarefas abertas, o dashboard dizia 0 e 0 — para
            # todas as empresas, desde que esta linha foi escrita. É o ERR-04
            # inteiro em uma linha: a falha tinha cara de resposta.
            from modules.projetos.repository import ProjetoRepository
            projetos = ProjetoRepository.calcular_resumo(empresa_id, usuario_id)
        except FALHAS_DE_INFRA as e:
            _logar_falha("resumo de projetos", e)
            projetos = None

        # ── Equipe ────────────────────────────────────────────
        try:
            from modules.equipe.repository import EquipeRepository
            equipe = EquipeRepository.resumo(empresa_id)
        except FALHAS_DE_INFRA as e:
            _logar_falha("resumo da equipe", e)
            equipe = None

        # ── Notificações ──────────────────────────────────────
        try:
            from modules.notificacoes.repository import NotificacaoRepository
            notificacoes_nao_lidas = NotificacaoRepository.contar_nao_lidas(usuario_id)
        except FALHAS_DE_INFRA as e:
            _logar_falha("contagem de notificações", e)
            notificacoes_nao_lidas = None

        # Bloco que falhou entra como None. Os zeros aqui dentro são o
        # default de um bloco que RESPONDEU sem aquele campo — coisa diferente
        # de bloco que não respondeu.
        resultado = {
            "financeiro": None if financeiro is None else {
                "total_receitas": float(financeiro.get("total_receitas", 0)),
                "total_despesas": float(financeiro.get("total_despesas", 0)),
                "saldo_mes": float(financeiro.get("saldo", 0)),
                "total_pendente": float(financeiro.get("total_pendente", 0)),
                "total_atrasado": float(financeiro.get("total_atrasado", 0)),
                "lancamentos_count": financeiro.get("lancamentos_count", 0),
            },
            "estoque": None if estoque is None else {
                "total_produtos": estoque.get("total_produtos", 0),
                "valor_total_estoque": float(estoque.get("valor_total_estoque", 0)),
                "produtos_sem_estoque": estoque.get("produtos_sem_estoque", 0),
                "produtos_abaixo_minimo": estoque.get("produtos_abaixo_minimo", 0),
                "giro_medio": float(estoque.get("giro_medio", 0)),
            },
            "crm": None if crm is None else {
                "total_clientes": crm.get("total_clientes", 0),
                "clientes_ativos": crm.get("clientes_ativos", 0),
                "novos_este_mes": crm.get("novos_este_mes", 0),
                "valor_total_gerado": float(crm.get("valor_total_gerado", 0)),
                "ticket_medio_geral": float(crm.get("ticket_medio_geral", 0)),
                "followups_atrasados": crm.get("followups_atrasados", 0),
                "clientes_por_status": crm.get("clientes_por_status", {}),
            },
            "projetos": None if projetos is None else {
                "total_projetos": projetos.get("total_projetos", 0),
                "projetos_ativos": projetos.get("projetos_ativos", 0),
                "projetos_atrasados": projetos.get("projetos_atrasados", 0),
                "tarefas_pendentes": projetos.get("tarefas_pendentes", 0),
                "tarefas_minhas": projetos.get("tarefas_minhas", 0),
                "tarefas_atrasadas": projetos.get("tarefas_atrasadas", 0),
                "projetos_por_status": projetos.get("projetos_por_status", {}),
            },
            "equipe": None if equipe is None else {
                "total_membros": equipe.get("total_membros", 0),
                "membros_ativos": equipe.get("membros_ativos", 0),
                "por_perfil": equipe.get("por_perfil", {}),
                "por_departamento": equipe.get("por_departamento", []),
            },
            "notificacoes": None if notificacoes_nao_lidas is None else {
                "nao_lidas": notificacoes_nao_lidas,
            },
            "meta": {
                "mes": mes,
                "ano": ano,
                "gerado_em": str(hoje),
            },
        }

        _guardar_se_completo(cache_key, resultado, TTL_DASHBOARD)
        return resultado

    # ── Fluxo de Caixa (últimos 30 dias) ─────────────────────
    @staticmethod
    def obter_fluxo_caixa(empresa_id, dias: int = 30) -> list | None:
        """
        Fluxo de caixa dos últimos N dias para o gráfico do dashboard.

        `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        hoje = date.today()
        data_inicio = hoje - timedelta(days=dias - 1)

        cache_key = build_cache_key(
            empresa_id,
            "dashboard",
            "fluxo",
            {"inicio": str(data_inicio), "fim": str(hoje)},
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.financeiro.services import FinanceiroService
            fluxo = FinanceiroService.obter_fluxo_caixa(empresa_id, data_inicio, hoje)
        except FALHAS_DE_INFRA as e:
            _logar_falha("fluxo de caixa", e)
            return None

        set_cached(cache_key, fluxo, TTL_DASHBOARD)
        return fluxo

    # ── Funil de Vendas ───────────────────────────────────────
    @staticmethod
    def obter_funil_vendas(empresa_id) -> dict | None:
        """
        Dados do funil de vendas CRM para o gráfico.

        `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        cache_key = build_cache_key(empresa_id, "dashboard", "funil")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.clientes.repository import ClienteRepository
            resumo = ClienteRepository.calcular_resumo(empresa_id)
            funil = resumo.get("clientes_por_status", {})
        except FALHAS_DE_INFRA as e:
            # Sem isto, a falha virava um funil de seis etapas zeradas — o
            # retrato de uma empresa que nunca vendeu nada.
            _logar_falha("funil de vendas", e)
            return None

        ORDEM_FUNIL = ["lead", "contato", "proposta", "negociacao", "fechado", "perdido"]
        LABELS = {
            "lead": "Lead",
            "contato": "Contato",
            "proposta": "Proposta",
            "negociacao": "Negociação",
            "fechado": "Fechado",
            "perdido": "Perdido",
        }
        resultado = {
            "etapas": [
                {
                    "status": s,
                    "label": LABELS.get(s, s),
                    "count": funil.get(s, 0),
                }
                for s in ORDEM_FUNIL
            ]
        }

        set_cached(cache_key, resultado, TTL_DASHBOARD)
        return resultado

    # ── Vencimentos Próximos ──────────────────────────────────
    @staticmethod
    def obter_vencimentos_proximos(empresa_id, dias: int = 7) -> list | None:
        """
        Lançamentos financeiros com vencimento nos próximos N dias.

        `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        cache_key = build_cache_key(
            empresa_id, "dashboard", "vencimentos", {"dias": dias}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.financeiro.repository import FinanceiroRepository
            lancamentos = FinanceiroRepository.listar_vencimentos_proximos(
                empresa_id, dias
            )
            resultado = [
                {
                    "id": str(l.id),
                    "descricao": l.descricao,
                    "valor": float(l.valor),
                    "tipo": l.tipo,
                    "data_vencimento": str(l.data_vencimento),
                    "status": l.status,
                    "categoria": l.categoria.nome if l.categoria else None,
                }
                for l in lancamentos[:10]
            ]
        except FALHAS_DE_INFRA as e:
            _logar_falha("vencimentos próximos", e)
            return None

        set_cached(cache_key, resultado, TTL_VENCIMENTOS)
        return resultado

    # ── Próximos Compromissos (Agenda) ────────────────────────
    @staticmethod
    def obter_proximos_compromissos(empresa_id, dias: int = 7) -> list | None:
        """
        Eventos da Agenda de agora até o fim do dia daqui a N dias.

        Existe para tirar a agenda do beco sem saída: até aqui o dashboard não
        sabia que ela existia, e o compromisso marcado só aparecia para quem
        fosse até a tela da Agenda olhar.

        Empresa com o módulo Agenda desligado recebe lista vazia — o widget
        some no front, mas o backend também não entrega, para o dado não vazar
        por um cliente de API que ignore o gating da tela.

        Essa lista vazia é resposta, não falha: o módulo está desligado de
        propósito. `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        cache_key = build_cache_key(
            empresa_id, "dashboard", "compromissos", {"dias": dias}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from django.utils import timezone

            from modules.agenda.models import Evento
            from modules.auth.models import Empresa
            from shared.modulos import modulo_ativo

            empresa = Empresa.objects.filter(pk=empresa_id).only("modulo_agenda").first()
            if not modulo_ativo(empresa, "agenda"):
                resultado = []
            else:
                agora = timezone.now()
                limite = timezone.localtime(agora).replace(
                    hour=23, minute=59, second=59, microsecond=0
                ) + timedelta(days=dias)

                # `data_fim >= agora` e não `data_inicio >= agora`: um
                # compromisso que começou às 9h e vai até as 11h ainda está
                # acontecendo ao meio-dia — sumir com ele seria mentira.
                eventos = (
                    Evento.objects.filter(
                        empresa_id=empresa_id,
                        data_fim__gte=agora,
                        data_inicio__lte=limite,
                    )
                    .select_related("cliente", "categoria")
                    .order_by("data_inicio")[:10]
                )
                hoje = timezone.localtime(agora).date()
                resultado = [
                    {
                        "id": str(e.id),
                        "titulo": e.titulo,
                        "data_inicio": e.data_inicio.isoformat(),
                        "data_fim": e.data_fim.isoformat(),
                        "dia_inteiro": e.dia_inteiro,
                        "local": e.local,
                        # A cor vem da categoria quando há uma; a regra é a do
                        # modelo, para o widget não ter a sua própria versão.
                        "cor": e.cor_efetiva,
                        "cliente_id": str(e.cliente_id) if e.cliente_id else None,
                        "cliente_nome": e.cliente.nome if e.cliente_id else None,
                        "dias_restantes": (
                            timezone.localtime(e.data_inicio).date() - hoje
                        ).days,
                    }
                    for e in eventos
                ]
        except FALHAS_DE_INFRA as e:
            _logar_falha("próximos compromissos", e)
            return None

        set_cached(cache_key, resultado, TTL_COMPROMISSOS)
        return resultado

    # ── Follow-ups Próximos ───────────────────────────────────
    @staticmethod
    def obter_followups_proximos(empresa_id, dias: int = 3) -> list | None:
        """
        Clientes com follow-up nos próximos N dias.

        `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        cache_key = build_cache_key(
            empresa_id, "dashboard", "followups", {"dias": dias}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.clientes.repository import ClienteRepository
            clientes = ClienteRepository.listar_followups_proximos(empresa_id, dias)
            resultado = [
                {
                    "id": str(c.id),
                    "nome": c.nome,
                    "nome_empresa": c.nome_empresa,
                    "telefone": c.telefone,
                    "whatsapp": c.whatsapp,
                    "proximo_followup": str(c.proximo_followup),
                    "status_funil": c.status_funil,
                }
                for c in clientes[:10]
            ]
        except FALHAS_DE_INFRA as e:
            _logar_falha("follow-ups próximos", e)
            return None

        set_cached(cache_key, resultado, TTL_FOLLOWUPS)
        return resultado

    # ── Minhas Tarefas ────────────────────────────────────────
    @staticmethod
    def obter_minhas_tarefas(empresa_id, usuario_id, limit: int = 10) -> list | None:
        """
        Tarefas pendentes do usuário logado.

        `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        cache_key = build_cache_key(
            empresa_id, "dashboard", "tarefas", {"uid": str(usuario_id)}
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.projetos.models import Tarefa
            hoje = date.today()
            tarefas = (
                Tarefa.objects.filter(
                    empresa_id=empresa_id,
                    responsavel_id=usuario_id,
                )
                .exclude(status="concluido")
                .select_related("projeto")
                .order_by("data_prazo", "prioridade")[:limit]
            )
            resultado = [
                {
                    "id": str(t.id),
                    "titulo": t.titulo,
                    "status": t.status,
                    "prioridade": t.prioridade,
                    "data_prazo": str(t.data_prazo) if t.data_prazo else None,
                    "esta_atrasada": t.esta_atrasada,
                    "projeto_id": str(t.projeto_id),
                    "projeto_nome": t.projeto.nome,
                }
                for t in tarefas
            ]
        except FALHAS_DE_INFRA as e:
            _logar_falha("minhas tarefas", e)
            return None

        set_cached(cache_key, resultado, TTL_TAREFAS)
        return resultado

    # ── Alertas de Estoque ────────────────────────────────────
    @staticmethod
    def obter_alertas_estoque(empresa_id, limit: int = 10) -> list | None:
        """
        Produtos com estoque zerado ou abaixo do mínimo.

        `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        cache_key = build_cache_key(empresa_id, "dashboard", "alertas_estoque")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.estoque.repository import EstoqueRepository
            produtos = EstoqueRepository.listar_alertas(empresa_id)
            resultado = [
                {
                    "id": str(p.id),
                    "nome": p.nome,
                    "sku": p.sku,
                    "estoque_atual": float(p.estoque_atual),
                    "estoque_minimo": float(p.estoque_minimo),
                    "status_estoque": p.status_estoque,
                    "categoria": p.categoria.nome if p.categoria else None,
                }
                for p in produtos[:limit]
            ]
        except FALHAS_DE_INFRA as e:
            _logar_falha("alertas de estoque", e)
            return None

        set_cached(cache_key, resultado, TTL_ALERTAS)
        return resultado

    # ── Projetos em Andamento ─────────────────────────────────
    @staticmethod
    def obter_projetos_em_andamento(empresa_id, limit: int = 5) -> list | None:
        """
        Projetos ativos com progresso para o widget do dashboard.

        `None` significa que a consulta falhou — não que o resultado é vazio.
        """
        cache_key = build_cache_key(empresa_id, "dashboard", "projetos_widget")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.projetos.models import Projeto
            projetos = (
                Projeto.objects.filter(
                    empresa_id=empresa_id,
                    ativo=True,
                    status__in=["planejamento", "em_andamento"],
                )
                .select_related("responsavel")
                .order_by("-atualizado_em")[:limit]
            )
            resultado = [
                {
                    "id": str(p.id),
                    "nome": p.nome,
                    "status": p.status,
                    "prioridade": p.prioridade,
                    "progresso": p.progresso,
                    "data_prazo": str(p.data_prazo) if p.data_prazo else None,
                    "esta_atrasado": p.esta_atrasado,
                    "responsavel": p.responsavel.nome if p.responsavel else None,
                    "cor": p.cor,
                }
                for p in projetos
            ]
        except FALHAS_DE_INFRA as e:
            _logar_falha("projetos em andamento", e)
            return None

        set_cached(cache_key, resultado, TTL_PROJETOS_WIDGET)
        return resultado

    # ── Atividade Recente ─────────────────────────────────────
    @staticmethod
    def obter_atividade_recente(empresa_id, limit: int = 10) -> list | None:
        """
        Feed de atividade recente consolidado de todos os módulos.
        Agrega: lançamentos, movimentações, interações, tarefas, documentos.
        """
        cache_key = build_cache_key(empresa_id, "dashboard", "atividade")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        eventos = []
        hoje = date.today()
        sete_dias = hoje - timedelta(days=7)

        # Uma fonte que falha deixa o feed INCOMPLETO, e um feed incompleto é
        # a mesma mentira em miniatura: a lista parece a atividade da semana
        # mas está sem o financeiro, e nada na tela diz isso. Então falha em
        # qualquer fonte derruba o feed inteiro para "indisponível".
        #
        # Não é exagero: com o except estreitado, o que chega aqui é o banco
        # não respondendo — e aí as outras quatro consultas também não vão
        # muito longe.

        # Lançamentos financeiros recentes
        try:
            from modules.financeiro.models import Lancamento
            for l in Lancamento.objects.filter(
                empresa_id=empresa_id,
                criado_em__date__gte=sete_dias,
            ).select_related("criado_por").order_by("-criado_em")[:5]:
                eventos.append({
                    "tipo": "financeiro",
                    "icone": "DollarSign",
                    "titulo": l.descricao,
                    "subtitulo": f"R$ {float(l.valor):,.2f} — {l.get_tipo_display()}",
                    "data": l.criado_em.isoformat(),
                    "usuario": l.criado_por.nome if l.criado_por else None,
                    "url": "/financeiro",
                })
        except FALHAS_DE_INFRA as e:
            _logar_falha("atividade: lançamentos", e)
            return None

        # Movimentações de estoque recentes
        try:
            from modules.estoque.models import Movimentacao
            for m in Movimentacao.objects.filter(
                empresa_id=empresa_id,
                criado_em__date__gte=sete_dias,
            ).select_related("produto", "criado_por").order_by("-criado_em")[:5]:
                eventos.append({
                    "tipo": "estoque",
                    "icone": "Package",
                    "titulo": f"{m.get_tipo_display()} — {m.produto.nome}",
                    "subtitulo": f"Qtd: {float(m.quantidade)} ({m.get_motivo_display()})",
                    "data": m.criado_em.isoformat(),
                    "usuario": m.criado_por.nome if m.criado_por else None,
                    "url": "/estoque",
                })
        except FALHAS_DE_INFRA as e:
            _logar_falha("atividade: movimentações de estoque", e)
            return None

        # Interações CRM recentes
        try:
            from modules.clientes.models import InteracaoCliente
            for i in InteracaoCliente.objects.filter(
                empresa_id=empresa_id,
                criado_em__date__gte=sete_dias,
            ).select_related("cliente", "criado_por").order_by("-criado_em")[:5]:
                eventos.append({
                    "tipo": "crm",
                    "icone": "Users",
                    "titulo": i.titulo,
                    "subtitulo": f"{i.get_tipo_display()} — {i.cliente.nome}",
                    "data": i.criado_em.isoformat(),
                    "usuario": i.criado_por.nome if i.criado_por else None,
                    "url": f"/clientes/{i.cliente_id}",
                })
        except FALHAS_DE_INFRA as e:
            _logar_falha("atividade: interações do CRM", e)
            return None

        # Tarefas concluídas recentes
        try:
            from modules.projetos.models import Tarefa
            for t in Tarefa.objects.filter(
                empresa_id=empresa_id,
                status="concluido",
                atualizado_em__date__gte=sete_dias,
            ).select_related("projeto", "criado_por").order_by("-atualizado_em")[:5]:
                eventos.append({
                    "tipo": "projetos",
                    "icone": "CheckSquare",
                    "titulo": t.titulo,
                    "subtitulo": f"Concluída — {t.projeto.nome}",
                    "data": t.atualizado_em.isoformat(),
                    "usuario": t.criado_por.nome if t.criado_por else None,
                    "url": f"/projetos/{t.projeto_id}",
                })
        except FALHAS_DE_INFRA as e:
            _logar_falha("atividade: tarefas concluídas", e)
            return None

        # Documentos criados recentes
        try:
            from modules.documentos.models import Documento
            for d in Documento.objects.filter(
                empresa_id=empresa_id,
                criado_em__date__gte=sete_dias,
            ).select_related("criado_por").order_by("-criado_em")[:3]:
                eventos.append({
                    "tipo": "documentos",
                    "icone": "FileText",
                    "titulo": d.titulo,
                    "subtitulo": f"Novo documento — {d.get_tipo_display()}",
                    "data": d.criado_em.isoformat(),
                    "usuario": d.criado_por.nome if d.criado_por else None,
                    "url": f"/documentos/{d.id}",
                })
        except FALHAS_DE_INFRA as e:
            _logar_falha("atividade: documentos", e)
            return None

        # Ordenar por data decrescente e limitar
        eventos.sort(key=lambda x: x["data"], reverse=True)
        resultado = eventos[:limit]

        set_cached(cache_key, resultado, TTL_ATIVIDADE)
        return resultado
