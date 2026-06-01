from shared.cache import build_cache_key, get_cached, set_cached, invalidate_cache
from shared.exceptions import ResourceNotFound, TenantAccessDenied
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
    def obter_resumo(empresa_id, filtros: dict = None) -> dict:
        """Retorna KPIs do CRM. Com filtros de período não usa cache."""
        filtros = filtros or {}
        mes = filtros.get("mes")
        ano = filtros.get("ano")

        if mes or ano:
            return ClienteRepository.calcular_resumo(empresa_id, filtros)

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
