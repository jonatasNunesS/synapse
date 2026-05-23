"""
Synapse — M7: Repository do módulo Documentos.
Todas as queries ao banco passam por aqui.
"""
import logging
from django.core.cache import cache
from .models import Documento, VersaoDocumento

logger = logging.getLogger("synapse")

CACHE_DOCS_KEY = "synapse:{empresa_id}:documentos:lista"
CACHE_DOCS_TTL = 300  # 5 minutos


class DocumentoRepository:

    @staticmethod
    def listar(empresa_id: str, filtros: dict = None):
        qs = (
            Documento.objects.filter(empresa_id=empresa_id)
            .select_related("criado_por")
            .prefetch_related("versoes")
            .order_by("-criado_em")
        )
        if filtros:
            if filtros.get("tipo"):
                qs = qs.filter(tipo=filtros["tipo"])
            if filtros.get("status"):
                qs = qs.filter(status=filtros["status"])
            if filtros.get("busca"):
                from django.db.models import Q
                qs = qs.filter(
                    Q(titulo__icontains=filtros["busca"])
                    | Q(descricao__icontains=filtros["busca"])
                )
            if filtros.get("tag"):
                qs = qs.filter(tags__contains=[filtros["tag"]])
        return qs

    @staticmethod
    def obter(doc_id: str, empresa_id: str) -> Documento:
        return Documento.objects.select_related("criado_por").prefetch_related("versoes").get(
            id=doc_id, empresa_id=empresa_id
        )

    @staticmethod
    def criar(empresa_id: str, criado_por_id: str, dados: dict) -> Documento:
        doc = Documento.objects.create(
            empresa_id=empresa_id,
            criado_por_id=criado_por_id,
            **dados,
        )
        cache.delete(CACHE_DOCS_KEY.format(empresa_id=empresa_id))
        return doc

    @staticmethod
    def atualizar(doc: Documento, dados: dict) -> Documento:
        for campo, valor in dados.items():
            setattr(doc, campo, valor)
        doc.save()
        cache.delete(CACHE_DOCS_KEY.format(empresa_id=str(doc.empresa_id)))
        return doc

    @staticmethod
    def deletar(doc_id: str, empresa_id: str) -> bool:
        deleted, _ = Documento.objects.filter(id=doc_id, empresa_id=empresa_id).delete()
        if deleted:
            cache.delete(CACHE_DOCS_KEY.format(empresa_id=empresa_id))
        return deleted > 0

    @staticmethod
    def criar_versao(doc_id: str, empresa_id: str, criado_por_id: str, dados: dict) -> VersaoDocumento:
        """Cria nova versão com número auto-incrementado."""
        ultima = VersaoDocumento.objects.filter(documento_id=doc_id).order_by("-numero_versao").first()
        numero = (ultima.numero_versao + 1) if ultima else 1
        versao = VersaoDocumento.objects.create(
            documento_id=doc_id,
            empresa_id=empresa_id,
            criado_por_id=criado_por_id,
            numero_versao=numero,
            **dados,
        )
        return versao

    @staticmethod
    def listar_versoes(doc_id: str, empresa_id: str):
        return VersaoDocumento.objects.filter(
            documento_id=doc_id, empresa_id=empresa_id
        ).select_related("criado_por").order_by("-numero_versao")
