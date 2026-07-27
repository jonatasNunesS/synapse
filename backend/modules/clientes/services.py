from shared.cache import build_cache_key, get_cached, set_cached, invalidate_cache
from shared.exceptions import ResourceNotFound, TenantAccessDenied, BusinessRuleViolation
from .repository import ClienteRepository
from .models import Cliente, InteracaoCliente


class ClienteService:
    """Camada de serviço para o módulo de Clientes."""

    # TTLs de cache
    TTL_RESUMO = 300       # 5 minutos
    TTL_FUNIL = 180        # 3 minutos
    TTL_LISTA = 120        # 2 minutos
    TTL_DETALHE = 300      # 5 minutos

    @staticmethod
    def _invalidar_todos(empresa_id):
        """Invalida todos os caches do módulo clientes para a empresa."""
        invalidate_cache(empresa_id, "clientes")

    # ─── Clientes ─────────────────────────────────────────────────────────────

    @staticmethod
    def listar_clientes(empresa_id, filtros: dict):
        """Lista clientes com cache por empresa (TTL 2 min)."""
        # Cache apenas para listagem sem filtros complexos
        if not any(filtros.values()):
            cache_key = build_cache_key(empresa_id, "clientes", "lista")
            cached = get_cached(cache_key)
            if cached is not None:
                return cached, True  # (queryset_ou_lista, from_cache)

        qs = ClienteRepository.listar_clientes(empresa_id, filtros)
        return qs, False

    @staticmethod
    def obter_cliente(empresa_id, cliente_id) -> Cliente:
        """Obtém um cliente verificando multi-tenant."""
        cliente = ClienteRepository.obter_por_id(empresa_id, cliente_id)
        if not cliente:
            raise ResourceNotFound(f"Cliente {cliente_id} não encontrado.")
        return cliente

    @staticmethod
    def criar_cliente(empresa_id, usuario_id, dados: dict) -> Cliente:
        """Cria um novo cliente e invalida o cache."""
        cliente = ClienteRepository.criar_cliente(empresa_id, usuario_id, dados)
        ClienteService._invalidar_todos(empresa_id)
        return cliente

    @staticmethod
    def atualizar_cliente(empresa_id, cliente_id, dados: dict) -> Cliente:
        """Atualiza um cliente verificando multi-tenant e invalida cache."""
        cliente = ClienteService.obter_cliente(empresa_id, cliente_id)
        cliente = ClienteRepository.atualizar_cliente(cliente, dados)
        ClienteService._invalidar_todos(empresa_id)
        return cliente

    @staticmethod
    def deletar_cliente(empresa_id, cliente_id) -> Cliente:
        """Soft delete de um cliente."""
        cliente = ClienteService.obter_cliente(empresa_id, cliente_id)
        cliente = ClienteRepository.soft_delete_cliente(cliente)
        ClienteService._invalidar_todos(empresa_id)
        return cliente

    @staticmethod
    def mover_funil(empresa_id, cliente_id, novo_status: str) -> Cliente:
        """Move um cliente no funil e invalida o cache do funil."""
        cliente = ClienteService.obter_cliente(empresa_id, cliente_id)
        cliente = ClienteRepository.mover_funil(cliente, novo_status)
        # Invalida especificamente o cache do funil
        invalidate_cache(empresa_id, "clientes")
        return cliente

    # ─── Resumo e Funil ───────────────────────────────────────────────────────

    @staticmethod
    def obter_resumo(empresa_id) -> dict:
        """Retorna KPIs do CRM com cache de 5 minutos."""
        cache_key = build_cache_key(empresa_id, "clientes", "resumo")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        resumo = ClienteRepository.calcular_resumo(empresa_id)
        set_cached(cache_key, resumo, ttl=ClienteService.TTL_RESUMO)
        return resumo

    @staticmethod
    def obter_funil(empresa_id) -> dict:
        """Retorna dados do funil Kanban com cache de 3 minutos."""
        cache_key = build_cache_key(empresa_id, "clientes", "funil")
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        funil = ClienteRepository.obter_funil(empresa_id)
        set_cached(cache_key, funil, ttl=ClienteService.TTL_FUNIL)
        return funil

    @staticmethod
    def listar_followups(empresa_id, dias: int = 3):
        """Retorna follow-ups próximos."""
        return ClienteRepository.listar_followups_proximos(empresa_id, dias)

    # ─── Interações ───────────────────────────────────────────────────────────

    @staticmethod
    def registrar_interacao(empresa_id, usuario_id, cliente_id, dados: dict) -> InteracaoCliente:
        """Registra uma interação e invalida cache do cliente e resumo."""
        # Verificar multi-tenant do cliente
        cliente = ClienteService.obter_cliente(empresa_id, cliente_id)

        # Remover cliente dos dados se vier no payload (já passamos como arg)
        dados.pop("cliente", None)

        interacao = ClienteRepository.criar_interacao(
            cliente_id=cliente.id,
            empresa_id=empresa_id,
            dados=dados,
            usuario_id=usuario_id,
        )
        ClienteService._invalidar_todos(empresa_id)
        return interacao

    @staticmethod
    def listar_interacoes(empresa_id, cliente_id, filtros: dict):
        """Lista interações de um cliente verificando multi-tenant."""
        # Verificar que o cliente pertence à empresa
        ClienteService.obter_cliente(empresa_id, cliente_id)
        return ClienteRepository.listar_interacoes(cliente_id, empresa_id, filtros)

    @staticmethod
    def obter_interacao(empresa_id, cliente_id, interacao_id) -> InteracaoCliente:
        """Obtém uma interação verificando multi-tenant (empresa + cliente)."""
        # Garante que o cliente pertence à empresa
        ClienteService.obter_cliente(empresa_id, cliente_id)
        interacao = ClienteRepository.obter_interacao(
            interacao_id=interacao_id,
            empresa_id=empresa_id,
            cliente_id=cliente_id,
        )
        if not interacao:
            raise ResourceNotFound(f"Interação {interacao_id} não encontrada.")
        return interacao

    @staticmethod
    def atualizar_interacao(empresa_id, cliente_id, interacao_id, dados: dict) -> InteracaoCliente:
        """Atualiza uma interação verificando multi-tenant e invalida cache."""
        interacao = ClienteService.obter_interacao(empresa_id, cliente_id, interacao_id)
        dados.pop("cliente", None)  # cliente nunca muda via update
        interacao = ClienteRepository.atualizar_interacao(interacao, dados)
        ClienteService._invalidar_todos(empresa_id)
        return interacao

    @staticmethod
    def remover_interacao(empresa_id, cliente_id, interacao_id) -> None:
        """Remove uma interação verificando multi-tenant e invalida cache."""
        interacao = ClienteService.obter_interacao(empresa_id, cliente_id, interacao_id)
        ClienteRepository.deletar_interacao(interacao)
        ClienteService._invalidar_todos(empresa_id)

    @staticmethod
    def apagar_interacao_com_ajustes(
        empresa_id, usuario_id, interacao_id,
        estornar_estoque=False, apagar_financeiro=False,
    ):
        """
        Apaga uma interação ajustando os vínculos, na ordem: estoque → financeiro
        → apagar a interação.
        - estornar_estoque: cria a movimentação inversa (a original é imutável).
        - apagar_financeiro: apaga o lançamento (se pendente) ou o cancela
          (se pago — preserva o histórico, regra de imutabilidade).
        Retorna um resumo do que foi feito.
        """
        from modules.estoque.services import EstoqueService

        interacao = ClienteService._obter_interacao_por_empresa(empresa_id, interacao_id)
        resumo = {"estoque_estornado": False, "financeiro_ajustado": None}

        if estornar_estoque and interacao.movimentacao_estoque_id:
            EstoqueService.estornar_movimentacao(
                empresa_id,
                interacao.movimentacao_estoque_id,
                usuario_id,
                motivo_estorno=f"Venda apagada (interação {interacao.id})",
            )
            resumo["estoque_estornado"] = True

        if apagar_financeiro and interacao.lancamento_financeiro_id:
            resumo["financeiro_ajustado"] = ClienteService._ajustar_lancamento_ao_apagar(
                empresa_id, interacao.lancamento_financeiro
            )

        ClienteRepository.deletar_interacao(interacao)
        ClienteService._invalidar_todos(empresa_id)
        return resumo

    @staticmethod
    def _ajustar_lancamento_ao_apagar(empresa_id, lancamento):
        """Pendente → apaga; pago → cancela (imutabilidade). Retorna a ação."""
        from modules.financeiro.repository import FinanceiroRepository

        if lancamento.status == "pago":
            lancamento.status = "cancelado"
            lancamento.save(update_fields=["status"])
            acao = "cancelado"
        else:
            FinanceiroRepository.deletar_lancamento(lancamento)
            acao = "apagado"
        invalidate_cache(empresa_id, "financeiro")
        return acao

    @staticmethod
    def baixar_interacao_estoque(empresa_id, usuario_id, interacao_id, produto_id, quantidade):
        """
        Cria uma saída de estoque a partir de uma interação de VENDA.

        - Multi-tenant: interação e produto precisam ser da mesma empresa.
        - Só vale para interação tipo=venda.
        - Idempotente: se a venda já baixou estoque, recusa (não duplica).
        - Soft block: se o estoque for insuficiente, levanta ESTOQUE_INSUFICIENTE
          com o saldo atual nos details, para o front oferecer baixar o que há.
        """
        from decimal import Decimal
        from modules.estoque.services import EstoqueService
        from modules.estoque.models import Produto

        # Busca a interação só por empresa (rota é flat, sem cliente_id)
        interacao = ClienteRepository.obter_interacao(
            interacao_id=interacao_id, empresa_id=empresa_id
        )
        if not interacao:
            raise ResourceNotFound("Interação", str(interacao_id))

        if interacao.tipo != "venda":
            raise BusinessRuleViolation(
                "INTERACAO_NAO_VENDA",
                "Só é possível baixar estoque a partir de uma interação de venda.",
            )

        if interacao.movimentacao_estoque_id:
            raise BusinessRuleViolation(
                "VENDA_JA_BAIXADA",
                "Esta venda já baixou o estoque.",
            )

        produto = Produto.objects.filter(id=produto_id, empresa_id=empresa_id).first()
        if not produto:
            raise BusinessRuleViolation(
                "PRODUTO_INVALIDO",
                "Produto não encontrado nesta empresa.",
            )

        qtd = Decimal(str(quantidade))
        if qtd <= 0:
            raise BusinessRuleViolation(
                "QUANTIDADE_INVALIDA", "Quantidade deve ser maior que zero."
            )

        # Soft block: informa o saldo para o front decidir baixar tudo que tem
        if produto.estoque_atual < qtd:
            raise BusinessRuleViolation(
                "ESTOQUE_INSUFICIENTE",
                f"Estoque insuficiente. Disponível: {produto.estoque_atual}.",
                details={"saldo_atual": str(produto.estoque_atual)},
            )

        movimentacao, _ = EstoqueService.registrar_movimentacao(
            empresa_id=empresa_id,
            usuario_id=usuario_id,
            dados={
                "produto": produto_id,
                "tipo": "saida",
                "quantidade": qtd,
                "motivo": "venda",
                "referencia": f"Venda para {interacao.cliente.nome}",
                "observacoes": f"Interação #{interacao.id}",
            },
        )

        interacao.movimentacao_estoque = movimentacao
        interacao.save(update_fields=["movimentacao_estoque"])
        ClienteService._invalidar_todos(empresa_id)
        return movimentacao

    # ── Fiado: cobrança no vencimento (mesma mecânica das recorrências) ──────

    @staticmethod
    def _obter_interacao_por_empresa(empresa_id, interacao_id) -> InteracaoCliente:
        """Busca por empresa (rota flat, sem cliente_id) ou levanta 404."""
        interacao = ClienteRepository.obter_interacao(
            interacao_id=interacao_id, empresa_id=empresa_id
        )
        if not interacao:
            raise ResourceNotFound("Interação", str(interacao_id))
        return interacao

    @staticmethod
    def notificar_vendas_fiado(hoje=None) -> int:
        """
        Cria notificação no sino para cada venda fiada vencida ainda não avisada.
        Idempotente via notificacao_enviada. Retorna quantas notificações criou.
        """
        from datetime import date as _date
        from modules.notificacoes.services import NotificacaoService

        hoje = hoje or _date.today()
        pendentes = InteracaoCliente.objects.select_related("cliente").filter(
            status_pagamento="pendente",
            data_prevista_pagamento__isnull=False,
            data_prevista_pagamento__lte=hoje,
            notificacao_enviada=False,
        )

        total = 0
        for interacao in pendentes:
            if not interacao.criado_por_id:
                # Sem dono para receber no sino; marca para não reprocessar sempre.
                interacao.notificacao_enviada = True
                interacao.save(update_fields=["notificacao_enviada"])
                continue

            valor_fmt = interacao.valor if interacao.valor is not None else 0
            NotificacaoService.criar_notificacao(
                usuario_id=interacao.criado_por_id,
                empresa_id=interacao.empresa_id,
                tipo="cliente",
                titulo=f"{interacao.cliente.nome} ficou de pagar hoje",
                mensagem=(
                    f"{interacao.cliente.nome} ficou de pagar R$ {valor_fmt} hoje. "
                    f"Referente a: {interacao.titulo}"
                ),
                acao_url=f"/clientes/{interacao.cliente_id}?fiado={interacao.id}",
                prioridade="alta",
            )
            interacao.notificacao_enviada = True
            interacao.save(update_fields=["notificacao_enviada"])
            total += 1

        return total

    @staticmethod
    def confirmar_pagamento(
        empresa_id, interacao_id, valor_confirmado=None,
        criar_restante=False, data_prevista_restante=None,
    ):
        """
        Confirma o pagamento de uma venda fiada.
        - status_pagamento → pago; valor atualizado se o recebido foi diferente.
        - Se o recebido < valor original e criar_restante, cria nova interação
          pendente com o saldo devedor (fica devendo o resto).
        Retorna (interacao, nova_interacao_restante | None).
        """
        from decimal import Decimal

        interacao = ClienteService._obter_interacao_por_empresa(empresa_id, interacao_id)
        if interacao.status_pagamento not in ("pendente",):
            raise BusinessRuleViolation(
                "PAGAMENTO_JA_RESOLVIDO",
                "Este pagamento já foi resolvido.",
            )

        valor_original = interacao.valor or Decimal("0")
        recebido = (
            Decimal(str(valor_confirmado)) if valor_confirmado is not None else valor_original
        )

        interacao.status_pagamento = "pago"
        if valor_confirmado is not None:
            interacao.valor = recebido
        interacao.save(update_fields=["status_pagamento", "valor"])

        nova = None
        restante = valor_original - recebido
        if criar_restante and restante > 0:
            # A data pode chegar como string ("YYYY-MM-DD"): converte para date
            # real, senão a serialização (dias_para_vencer) quebra.
            if isinstance(data_prevista_restante, str):
                from django.utils.dateparse import parse_date
                data_prevista_restante = parse_date(data_prevista_restante)
            nova = InteracaoCliente.objects.create(
                cliente_id=interacao.cliente_id,
                empresa_id=interacao.empresa_id,
                tipo=interacao.tipo,
                titulo=f"Saldo devedor — {interacao.titulo}",
                descricao=f"Restante de R$ {restante} referente a {interacao.titulo}.",
                valor=restante,
                status_pagamento="pendente",
                data_prevista_pagamento=data_prevista_restante,
                criado_por_id=interacao.criado_por_id,
            )

        ClienteService._invalidar_todos(empresa_id)
        return interacao, nova

    @staticmethod
    def adiar_pagamento(empresa_id, interacao_id, dias: int):
        """Adia a previsão de pagamento em N dias e rearma a notificação."""
        from datetime import date as _date, timedelta

        interacao = ClienteService._obter_interacao_por_empresa(empresa_id, interacao_id)
        base = interacao.data_prevista_pagamento or _date.today()
        # Nunca adia para o passado: parte de hoje se a previsão já venceu.
        base = max(base, _date.today())
        interacao.data_prevista_pagamento = base + timedelta(days=max(1, int(dias)))
        interacao.notificacao_enviada = False  # volta a notificar no novo vencimento
        interacao.save(update_fields=["data_prevista_pagamento", "notificacao_enviada"])
        ClienteService._invalidar_todos(empresa_id)
        return interacao

    @staticmethod
    def cancelar_pagamento(empresa_id, interacao_id):
        """Marca a venda como não cobrada (status_pagamento=cancelado)."""
        interacao = ClienteService._obter_interacao_por_empresa(empresa_id, interacao_id)
        interacao.status_pagamento = "cancelado"
        interacao.save(update_fields=["status_pagamento"])
        ClienteService._invalidar_todos(empresa_id)
        return interacao

    @staticmethod
    def registrar_interacao_no_financeiro(empresa_id, usuario_id, interacao_id):
        """
        Cria um lançamento de receita a partir de uma venda e vincula à interação.
        - Exige valor > 0 (senão não faz sentido gerar receita).
        - Status herda de status_pagamento (pago → pago; senão pendente).
        - Idempotente: interação já vinculada → VENDA_JA_COM_LANCAMENTO.
        """
        from datetime import date
        from modules.financeiro.services import FinanceiroService

        interacao = ClienteService._obter_interacao_por_empresa(empresa_id, interacao_id)

        if interacao.valor is None or interacao.valor <= 0:
            raise BusinessRuleViolation(
                "INTERACAO_SEM_VALOR",
                "Interação sem valor não gera receita.",
            )

        if interacao.lancamento_financeiro_id:
            raise BusinessRuleViolation(
                "VENDA_JA_COM_LANCAMENTO",
                "Esta venda já tem lançamento financeiro.",
            )

        hoje = date.today()
        pago = interacao.status_pagamento == "pago"
        lancamento = FinanceiroService.criar_lancamento(
            empresa_id,
            usuario_id,
            {
                "tipo": "receita",
                "descricao": f"Venda - {interacao.cliente.nome}: {interacao.titulo}",
                "valor": interacao.valor,
                "data_vencimento": interacao.data_prevista_pagamento or hoje,
                "data_pagamento": hoje if pago else None,
                "status": "pago" if pago else "pendente",
                "observacoes": f"Referente à interação #{interacao.id}",
            },
        )

        interacao.lancamento_financeiro = lancamento
        interacao.save(update_fields=["lancamento_financeiro"])
        ClienteService._invalidar_todos(empresa_id)
        return lancamento

    @staticmethod
    def criar_evento_followup(empresa_id, usuario_id, cliente_id, atualizar=False):
        """
        Cria (ou atualiza) um evento de Agenda a partir do proximo_followup do
        cliente. Não duplica: se já houver evento de follow-up desse cliente na
        mesma data, exige a intenção explícita (atualizar=True) — senão levanta
        EVENTO_FOLLOWUP_EXISTE com o id do evento existente.

        Retorna (evento, criado_bool).
        """
        from datetime import datetime, time
        from django.utils import timezone
        from modules.agenda.services import AgendaService
        from modules.agenda.models import Evento

        cliente = ClienteService.obter_cliente(empresa_id, cliente_id)  # 404 multi-tenant
        if not cliente.proximo_followup:
            raise BusinessRuleViolation(
                "SEM_FOLLOWUP",
                "Este cliente não tem próximo follow-up definido.",
            )

        data = cliente.proximo_followup
        inicio = timezone.make_aware(datetime.combine(data, time(9, 0)))
        fim = timezone.make_aware(datetime.combine(data, time(9, 30)))

        existente = Evento.objects.filter(
            empresa_id=empresa_id,
            cliente_id=cliente_id,
            data_inicio__date=data,
            titulo__startswith="Follow-up:",
        ).first()

        if existente and not atualizar:
            raise BusinessRuleViolation(
                "EVENTO_FOLLOWUP_EXISTE",
                "Já existe um evento de follow-up para este cliente nesta data.",
                details={"evento_id": str(existente.id)},
            )

        dados = {
            "titulo": f"Follow-up: {cliente.nome}",
            "descricao": f"Próximo contato com {cliente.nome}",
            "data_inicio": inicio,
            "data_fim": fim,
            "cor": "#3B82F6",  # azul — cor padrão de follow-up
            "cliente_id": cliente_id,
            "dia_inteiro": False,
        }

        if existente and atualizar:
            evento = AgendaService.atualizar_evento(empresa_id, existente.id, dados)
            return evento, False

        evento = AgendaService.criar_evento(empresa_id, usuario_id, dados)
        return evento, True
