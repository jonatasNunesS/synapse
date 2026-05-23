"""
Synapse — M7: Service do módulo Documentos.
Toda a lógica de negócio passa por aqui.
"""
import logging
from .repository import DocumentoRepository
from .models import Documento, VersaoDocumento

logger = logging.getLogger("synapse")


class DocumentoService:

    @staticmethod
    def criar(empresa_id: str, criado_por_id: str, dados: dict) -> Documento:
        doc = DocumentoRepository.criar(empresa_id, criado_por_id, dados)
        logger.info("Documento criado", extra={"empresa_id": empresa_id, "doc_id": str(doc.id)})
        return doc

    @staticmethod
    def atualizar(doc_id: str, empresa_id: str, dados: dict) -> Documento:
        doc = DocumentoRepository.obter(doc_id, empresa_id)
        return DocumentoRepository.atualizar(doc, dados)

    @staticmethod
    def deletar(doc_id: str, empresa_id: str) -> bool:
        return DocumentoRepository.deletar(doc_id, empresa_id)

    @staticmethod
    def criar_versao(
        doc_id: str, empresa_id: str, criado_por_id: str, dados: dict
    ) -> VersaoDocumento:
        # Verificar que o documento pertence à empresa
        DocumentoRepository.obter(doc_id, empresa_id)
        versao = DocumentoRepository.criar_versao(doc_id, empresa_id, criado_por_id, dados)
        logger.info(
            "Nova versão de documento criada",
            extra={"doc_id": doc_id, "versao": versao.numero_versao},
        )
        return versao
