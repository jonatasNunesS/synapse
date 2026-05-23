"""
Synapse — M8 Dashboard: Service Consolidado
Agrega dados de todos os módulos (M2–M7) em um único payload.
Cache Redis: synapse:{empresa_id}:dashboard:resumo (TTL 5 min)
"""
import logging
from datetime import date, timedelta

from shared.cache import build_cache_key, get_cached, set_cached

logger = logging.getLogger("synapse")

# TTLs
TTL_DASHBOARD = 300       # 5 min — resumo principal
TTL_ATIVIDADE = 120       # 2 min — feed de atividade recente
TTL_VENCIMENTOS = 120     # 2 min — vencimentos próximos
TTL_FOLLOWUPS = 120       # 2 min — follow-ups próximos
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
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter resumo financeiro — {e}")
            financeiro = {
                "total_receitas": 0,
                "total_despesas": 0,
                "saldo": 0,
                "total_pendente": 0,
                "total_atrasado": 0,
                "lancamentos_count": 0,
            }

        # ── Estoque ───────────────────────────────────────────
        try:
            from modules.estoque.repository import EstoqueRepository
            estoque = EstoqueRepository.calcular_relatorio(empresa_id)
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter resumo estoque — {e}")
            estoque = {
                "total_produtos": 0,
                "total_skus": 0,
                "valor_total_estoque": 0,
                "produtos_sem_estoque": 0,
                "produtos_abaixo_minimo": 0,
                "giro_medio": 0,
            }

        # ── CRM ───────────────────────────────────────────────
        try:
            from modules.clientes.repository import ClienteRepository
            crm = ClienteRepository.calcular_resumo(empresa_id)
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter resumo CRM — {e}")
            crm = {
                "total_clientes": 0,
                "clientes_ativos": 0,
                "novos_este_mes": 0,
                "valor_total_gerado": 0,
                "ticket_medio_geral": 0,
                "followups_atrasados": 0,
                "clientes_por_status": {},
            }

        # ── Projetos ──────────────────────────────────────────
        try:
            from modules.projetos.repository import ProjetosRepository
            projetos = ProjetosRepository.calcular_resumo(empresa_id, usuario_id)
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter resumo projetos — {e}")
            projetos = {
                "total_projetos": 0,
                "projetos_ativos": 0,
                "projetos_atrasados": 0,
                "tarefas_pendentes": 0,
                "tarefas_minhas": 0,
                "tarefas_atrasadas": 0,
                "projetos_por_status": {},
            }

        # ── Equipe ────────────────────────────────────────────
        try:
            from modules.equipe.repository import EquipeRepository
            equipe = EquipeRepository.resumo(empresa_id)
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter resumo equipe — {e}")
            equipe = {
                "total_membros": 0,
                "membros_ativos": 0,
                "por_perfil": {},
                "por_departamento": [],
            }

        # ── Notificações ──────────────────────────────────────
        try:
            from modules.notificacoes.repository import NotificacaoRepository
            notificacoes_nao_lidas = NotificacaoRepository.contar_nao_lidas(usuario_id)
        except Exception as e:
            logger.warning(f"Dashboard: erro ao contar notificações — {e}")
            notificacoes_nao_lidas = 0

        resultado = {
            "financeiro": {
                "total_receitas": float(financeiro.get("total_receitas", 0)),
                "total_despesas": float(financeiro.get("total_despesas", 0)),
                "saldo_mes": float(financeiro.get("saldo", 0)),
                "total_pendente": float(financeiro.get("total_pendente", 0)),
                "total_atrasado": float(financeiro.get("total_atrasado", 0)),
                "lancamentos_count": financeiro.get("lancamentos_count", 0),
            },
            "estoque": {
                "total_produtos": estoque.get("total_produtos", 0),
                "valor_total_estoque": float(estoque.get("valor_total_estoque", 0)),
                "produtos_sem_estoque": estoque.get("produtos_sem_estoque", 0),
                "produtos_abaixo_minimo": estoque.get("produtos_abaixo_minimo", 0),
                "giro_medio": float(estoque.get("giro_medio", 0)),
            },
            "crm": {
                "total_clientes": crm.get("total_clientes", 0),
                "clientes_ativos": crm.get("clientes_ativos", 0),
                "novos_este_mes": crm.get("novos_este_mes", 0),
                "valor_total_gerado": float(crm.get("valor_total_gerado", 0)),
                "ticket_medio_geral": float(crm.get("ticket_medio_geral", 0)),
                "followups_atrasados": crm.get("followups_atrasados", 0),
                "clientes_por_status": crm.get("clientes_por_status", {}),
            },
            "projetos": {
                "total_projetos": projetos.get("total_projetos", 0),
                "projetos_ativos": projetos.get("projetos_ativos", 0),
                "projetos_atrasados": projetos.get("projetos_atrasados", 0),
                "tarefas_pendentes": projetos.get("tarefas_pendentes", 0),
                "tarefas_minhas": projetos.get("tarefas_minhas", 0),
                "tarefas_atrasadas": projetos.get("tarefas_atrasadas", 0),
                "projetos_por_status": projetos.get("projetos_por_status", {}),
            },
            "equipe": {
                "total_membros": equipe.get("total_membros", 0),
                "membros_ativos": equipe.get("membros_ativos", 0),
                "por_perfil": equipe.get("por_perfil", {}),
                "por_departamento": equipe.get("por_departamento", []),
            },
            "notificacoes": {
                "nao_lidas": notificacoes_nao_lidas,
            },
            "meta": {
                "mes": mes,
                "ano": ano,
                "gerado_em": str(hoje),
            },
        }

        set_cached(cache_key, resultado, TTL_DASHBOARD)
        return resultado

    # ── Fluxo de Caixa (últimos 30 dias) ─────────────────────
    @staticmethod
    def obter_fluxo_caixa(empresa_id, dias: int = 30) -> list:
        """Fluxo de caixa dos últimos N dias para o gráfico do dashboard."""
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
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter fluxo de caixa — {e}")
            fluxo = []

        set_cached(cache_key, fluxo, TTL_DASHBOARD)
        return fluxo

    # ── Funil de Vendas ───────────────────────────────────────
    @staticmethod
    def obter_funil_vendas(empresa_id) -> dict:
        """Dados do funil de vendas CRM para o gráfico."""
        cache_key = build_cache_key(empresa_id, "dashboard", "funil")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            from modules.clientes.repository import ClienteRepository
            resumo = ClienteRepository.calcular_resumo(empresa_id)
            funil = resumo.get("clientes_por_status", {})
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter funil de vendas — {e}")
            funil = {}

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
    def obter_vencimentos_proximos(empresa_id, dias: int = 7) -> list:
        """Lançamentos financeiros com vencimento nos próximos N dias."""
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
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter vencimentos — {e}")
            resultado = []

        set_cached(cache_key, resultado, TTL_VENCIMENTOS)
        return resultado

    # ── Follow-ups Próximos ───────────────────────────────────
    @staticmethod
    def obter_followups_proximos(empresa_id, dias: int = 3) -> list:
        """Clientes com follow-up nos próximos N dias."""
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
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter follow-ups — {e}")
            resultado = []

        set_cached(cache_key, resultado, TTL_FOLLOWUPS)
        return resultado

    # ── Minhas Tarefas ────────────────────────────────────────
    @staticmethod
    def obter_minhas_tarefas(empresa_id, usuario_id, limit: int = 10) -> list:
        """Tarefas pendentes do usuário logado."""
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
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter minhas tarefas — {e}")
            resultado = []

        set_cached(cache_key, resultado, TTL_TAREFAS)
        return resultado

    # ── Alertas de Estoque ────────────────────────────────────
    @staticmethod
    def obter_alertas_estoque(empresa_id, limit: int = 10) -> list:
        """Produtos com estoque zerado ou abaixo do mínimo."""
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
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter alertas de estoque — {e}")
            resultado = []

        set_cached(cache_key, resultado, TTL_ALERTAS)
        return resultado

    # ── Projetos em Andamento ─────────────────────────────────
    @staticmethod
    def obter_projetos_em_andamento(empresa_id, limit: int = 5) -> list:
        """Projetos ativos com progresso para o widget do dashboard."""
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
        except Exception as e:
            logger.warning(f"Dashboard: erro ao obter projetos em andamento — {e}")
            resultado = []

        set_cached(cache_key, resultado, TTL_PROJETOS_WIDGET)
        return resultado

    # ── Atividade Recente ─────────────────────────────────────
    @staticmethod
    def obter_atividade_recente(empresa_id, limit: int = 10) -> list:
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
        except Exception as e:
            logger.debug(f"Dashboard atividade: financeiro — {e}")

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
        except Exception as e:
            logger.debug(f"Dashboard atividade: estoque — {e}")

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
        except Exception as e:
            logger.debug(f"Dashboard atividade: crm — {e}")

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
        except Exception as e:
            logger.debug(f"Dashboard atividade: projetos — {e}")

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
        except Exception as e:
            logger.debug(f"Dashboard atividade: documentos — {e}")

        # Ordenar por data decrescente e limitar
        eventos.sort(key=lambda x: x["data"], reverse=True)
        resultado = eventos[:limit]

        set_cached(cache_key, resultado, TTL_ATIVIDADE)
        return resultado
