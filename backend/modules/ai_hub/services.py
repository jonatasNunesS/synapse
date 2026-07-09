"""
Synapse - AI Hub Service
Responsável por:
- Montar contexto do negócio para a IA
- Orquestrar criação de TaskIA e disparo de Celery
- Obter status de tasks

O controle de limite foi extraído para o sistema unificado de créditos
(modules.ai_hub.creditos.CreditosService), que cobre TODAS as operações de IA.
"""
import logging
from datetime import date

from django.core.cache import cache

from .models import ConteudoGerado, TaskIA

logger = logging.getLogger("synapse")


class AIHubService:

    # ─── Contexto do negócio ──────────────────────────────────────────────────

    @staticmethod
    def montar_contexto_negocio(empresa_id) -> str:
        """
        Monta string de contexto do negócio para alimentar a IA.
        Cache TTL 10 minutos.
        """
        cache_key = f"synapse:ai:contexto:{empresa_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            from modules.auth.models import Empresa
            empresa = Empresa.objects.get(pk=empresa_id)
            nome = empresa.nome
            segmento = empresa.segmento or "Não informado"
            plano = empresa.plano
        except Exception:
            nome = "Empresa"
            segmento = "Não informado"
            plano = "starter"

        # Dados financeiros
        try:
            from modules.financeiro.services import FinanceiroService
            hoje = date.today()
            fin = FinanceiroService.obter_resumo(empresa_id, hoje.month, hoje.year)
            receita = fin.get("total_receitas", 0)
            despesas = fin.get("total_despesas", 0)
            saldo = fin.get("saldo", 0)
        except Exception:
            receita = despesas = saldo = 0

        # Dados de estoque
        try:
            from modules.estoque.repository import EstoqueRepository
            est = EstoqueRepository.calcular_relatorio(empresa_id)
            total_produtos = est.get("total_produtos", 0)
            abaixo_minimo = est.get("produtos_abaixo_minimo", 0)
        except Exception:
            total_produtos = abaixo_minimo = 0

        # Dados de clientes
        try:
            from modules.clientes.repository import ClienteRepository
            crm = ClienteRepository.calcular_resumo(empresa_id)
            total_clientes = crm.get("total_clientes", 0)
            novos_mes = crm.get("novos_mes", 0)
        except Exception:
            total_clientes = novos_mes = 0

        # Dados de projetos
        try:
            from modules.projetos.repository import ProjetoRepository
            proj = ProjetoRepository.calcular_resumo(empresa_id)
            projetos_ativos = proj.get("projetos_em_andamento", 0)
            tarefas_pendentes = proj.get("tarefas_pendentes", 0)
        except Exception:
            projetos_ativos = tarefas_pendentes = 0

        contexto = (
            f"Negócio: {nome}\n"
            f"Segmento: {segmento}\n"
            f"Plano: {plano}\n"
            f"Receita do mês: R$ {receita:,.2f}\n"
            f"Despesas do mês: R$ {despesas:,.2f}\n"
            f"Saldo: R$ {saldo:,.2f}\n"
            f"Clientes ativos: {total_clientes} (novos este mês: {novos_mes})\n"
            f"Produtos em estoque: {total_produtos} ({abaixo_minimo} abaixo do mínimo)\n"
            f"Projetos em andamento: {projetos_ativos}\n"
            f"Tarefas pendentes: {tarefas_pendentes}\n"
        )

        cache.set(cache_key, contexto, 600)  # 10 minutos
        return contexto

    # ─── Orquestração de geração ──────────────────────────────────────────────

    @staticmethod
    def solicitar_geracao(empresa_id, usuario_id, tipo: str, parametros: dict) -> "TaskIA":
        """
        Reserva 1 crédito (rejeita na porta se não houver), cria TaskIA e
        dispara a task Celery. Retorna a TaskIA criada (status=pendente).
        Levanta SemCreditosError (402) ANTES de qualquer chamada à IA.
        """
        from modules.auth.models import Empresa
        from modules.ai_hub.creditos import CreditosService

        empresa = Empresa.objects.get(pk=empresa_id)

        # Reserva o crédito ANTES de chamar a IA (rejeição na porta)
        operacao = "conteudo"
        CreditosService.reservar(empresa_id, operacao)

        # Criar TaskIA (guarda a operação para devolução em caso de falha)
        task_ia = TaskIA.objects.create(
            empresa=empresa,
            tipo="conteudo",
            status="pendente",
            parametros={"tipo_conteudo": tipo, "_credito_operacao": operacao, **parametros},
        )

        # Disparar Celery (importação lazy para evitar circular)
        from modules.ai_hub.tasks import gerar_conteudo_ia
        celery_task = gerar_conteudo_ia.delay(str(task_ia.id))
        task_ia.task_id = celery_task.id
        task_ia.save(update_fields=["task_id"])

        return task_ia

    @staticmethod
    def obter_status_task(empresa_id, task_ia_id) -> "TaskIA":
        """Busca TaskIA verificando multi-tenant."""
        try:
            return TaskIA.objects.get(pk=task_ia_id, empresa_id=empresa_id)
        except TaskIA.DoesNotExist:
            from shared.exceptions import ResourceNotFound
            raise ResourceNotFound("TaskIA", str(task_ia_id))

    # ─── Histórico ────────────────────────────────────────────────────────────

    @staticmethod
    def listar_conteudos(empresa_id, tipo=None, favorito=None):
        """Lista conteúdos gerados com filtros opcionais."""
        qs = ConteudoGerado.objects.filter(empresa_id=empresa_id)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if favorito is not None:
            qs = qs.filter(favorito=favorito)
        return qs.order_by("-criado_em")

    @staticmethod
    def toggle_favorito(empresa_id, conteudo_id) -> "ConteudoGerado":
        """Alterna o status de favorito de um conteúdo."""
        try:
            conteudo = ConteudoGerado.objects.get(pk=conteudo_id, empresa_id=empresa_id)
        except ConteudoGerado.DoesNotExist:
            from shared.exceptions import ResourceNotFound
            raise ResourceNotFound("ConteudoGerado", str(conteudo_id))
        conteudo.favorito = not conteudo.favorito
        conteudo.save(update_fields=["favorito"])
        return conteudo

    @staticmethod
    def obter_insight_semanal(empresa_id):
        """Retorna o último insight gerado para a empresa."""
        cache_key = f"synapse:ai:insight:{empresa_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        insight = (
            ConteudoGerado.objects
            .filter(empresa_id=empresa_id, tipo="insight")
            .order_by("-criado_em")
            .first()
        )
        if insight:
            cache.set(cache_key, insight, 3600)  # 1 hora
        return insight
