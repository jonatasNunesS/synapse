"""
Synapse — Módulo Agenda: Service
Regras de negócio da agenda. Views chamam o service, nunca o ORM direto.
"""
import logging

from shared.cache import invalidate_cache
from shared.exceptions import ResourceNotFound

from .models import Evento
from .repository import AgendaRepository, CategoriaEventoRepository

logger = logging.getLogger("synapse")


class AgendaService:
    """Serviço da Agenda."""

    @staticmethod
    def listar_eventos(empresa_id, inicio=None, fim=None, cliente_id=None):
        """Lista eventos (opcionalmente por intervalo e/ou cliente)."""
        return AgendaRepository.listar(empresa_id, inicio, fim, cliente_id)

    @staticmethod
    def obter_evento(empresa_id, evento_id) -> Evento:
        evento = AgendaRepository.obter(empresa_id, evento_id)
        if not evento:
            raise ValueError("Evento não encontrado.")
        return evento

    @staticmethod
    def criar_evento(empresa_id, usuario_id, dados: dict) -> Evento:
        evento = AgendaRepository.criar(empresa_id, usuario_id, dados)
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Evento criado",
            extra={"empresa_id": str(empresa_id), "evento_id": str(evento.id)},
        )
        return evento

    @staticmethod
    def atualizar_evento(empresa_id, evento_id, dados: dict) -> Evento:
        evento = AgendaService.obter_evento(empresa_id, evento_id)
        dados = AgendaService._rearmar_lembrete(evento, dados)
        evento = AgendaRepository.atualizar(evento, dados)
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Evento atualizado",
            extra={"empresa_id": str(empresa_id), "evento_id": str(evento_id)},
        )
        return evento

    @staticmethod
    def _rearmar_lembrete(evento: Evento, dados: dict) -> dict:
        """
        Remarcou o evento ou trocou a antecedência? O lembrete volta a valer.

        Sem isto, avisar uma vez calaria o lembrete para sempre: quem adiasse a
        reunião de hoje para a semana que vem não seria avisado de novo, que é
        justamente quando o aviso faz falta.
        """
        novo_inicio = dados.get("data_inicio", evento.data_inicio)
        nova_antecedencia = dados.get(
            "lembrete_antecedencia", evento.lembrete_antecedencia
        )
        remarcado = novo_inicio != evento.data_inicio
        antecedencia_mudou = nova_antecedencia != evento.lembrete_antecedencia

        if evento.lembrete_enviado and (remarcado or antecedencia_mudou):
            dados = {**dados, "lembrete_enviado": False}
        return dados

    @staticmethod
    def deletar_evento(empresa_id, evento_id) -> None:
        evento = AgendaService.obter_evento(empresa_id, evento_id)
        AgendaRepository.deletar(evento)
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Evento excluído",
            extra={"empresa_id": str(empresa_id), "evento_id": str(evento_id)},
        )


class CategoriaEventoService:
    """
    Regras das categorias de evento.

    A categoria é DESATIVADA, nunca apagada: os eventos mantêm o vínculo e
    seguem pegando a cor dela, e a categoria só para de aparecer como opção.
    Apagar de verdade faria eventos históricos mudarem de cor sozinhos.
    """

    @staticmethod
    def listar(empresa_id, incluir_inativas=False):
        return CategoriaEventoRepository.listar(empresa_id, incluir_inativas)

    @staticmethod
    def obter(empresa_id, categoria_id):
        categoria = CategoriaEventoRepository.obter(empresa_id, categoria_id)
        if not categoria:
            raise ResourceNotFound("CategoriaEvento", str(categoria_id))
        return categoria

    @staticmethod
    def criar(empresa_id, dados: dict):
        categoria = CategoriaEventoRepository.criar(empresa_id, dados)
        # A cor exibida dos eventos sai da categoria: mexer nela muda a tela.
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Categoria de evento criada",
            extra={"empresa_id": str(empresa_id), "categoria_id": str(categoria.id)},
        )
        return categoria

    @staticmethod
    def atualizar(empresa_id, categoria_id, dados: dict):
        categoria = CategoriaEventoService.obter(empresa_id, categoria_id)
        categoria = CategoriaEventoRepository.atualizar(categoria, dados)
        invalidate_cache(empresa_id, "agenda")
        logger.info(
            "Categoria de evento atualizada",
            extra={"empresa_id": str(empresa_id), "categoria_id": str(categoria_id)},
        )
        return categoria
