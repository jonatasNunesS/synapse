"""
Synapse — M7: Service do módulo Documentos.
Toda a lógica de negócio passa por aqui.
"""
import logging

from django.core.cache import cache

from .models import Documento, VersaoDocumento
from .repository import DocumentoRepository

logger = logging.getLogger("synapse")

_CACHE_DOCS = "synapse:{empresa_id}:documentos:lista"
_CACHE_VERSOES = "synapse:{empresa_id}:documentos:versoes:{doc_id}"


def _invalidar_cache_documentos(empresa_id: str, doc_id: str = None) -> None:
    """Invalida o cache de documentos (e versões de um doc específico, se informado)."""
    cache.delete(_CACHE_DOCS.format(empresa_id=empresa_id))
    if doc_id:
        cache.delete(_CACHE_VERSOES.format(empresa_id=empresa_id, doc_id=doc_id))


class DocumentoService:

    @staticmethod
    def criar(empresa_id: str, criado_por_id: str, dados: dict) -> Documento:
        doc = DocumentoRepository.criar(empresa_id, criado_por_id, dados)
        _invalidar_cache_documentos(empresa_id)
        logger.info(
            "Documento criado",
            extra={"empresa_id": empresa_id, "doc_id": str(doc.id)},
        )
        return doc

    @staticmethod
    def atualizar(doc_id: str, empresa_id: str, dados: dict) -> Documento:
        doc = DocumentoRepository.obter(doc_id, empresa_id)
        resultado = DocumentoRepository.atualizar(doc, dados)
        _invalidar_cache_documentos(empresa_id, doc_id)
        return resultado

    @staticmethod
    def deletar(doc_id: str, empresa_id: str) -> bool:
        resultado = DocumentoRepository.deletar(doc_id, empresa_id)
        _invalidar_cache_documentos(empresa_id, doc_id)
        return resultado

    @staticmethod
    def criar_versao(
        doc_id: str, empresa_id: str, criado_por_id: str, dados: dict
    ) -> VersaoDocumento:
        # Verificar que o documento pertence à empresa
        DocumentoRepository.obter(doc_id, empresa_id)
        versao = DocumentoRepository.criar_versao(doc_id, empresa_id, criado_por_id, dados)
        _invalidar_cache_documentos(empresa_id, doc_id)
        logger.info(
            "Nova versão de documento criada",
            extra={"doc_id": doc_id, "versao": versao.numero_versao},
        )
        return versao
