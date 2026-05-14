"""
Synapse - Implementação de Storage Local
Implementa core/interfaces/i_storage.py
Arquivos salvos em /media/ via Django MEDIA_ROOT.
"""

import logging
import mimetypes
import os
import uuid
from typing import Optional

from django.conf import settings

from core.interfaces.i_storage import IStorageService, StorageResult

logger = logging.getLogger("synapse")


class LocalStorageService(IStorageService):
    """Implementação concreta de storage usando sistema de arquivos local."""

    def __init__(self):
        self.media_root = settings.MEDIA_ROOT
        self.media_url = settings.MEDIA_URL

    def salvar(self, arquivo, diretorio: str, nome: Optional[str] = None) -> StorageResult:
        """Salva arquivo no sistema de arquivos local."""
        try:
            # Gera nome único se não fornecido
            if nome is None:
                ext = os.path.splitext(arquivo.name)[1] if hasattr(arquivo, "name") else ""
                nome = f"{uuid.uuid4().hex}{ext}"

            # Cria diretório se não existe
            dir_path = os.path.join(self.media_root, diretorio)
            os.makedirs(dir_path, exist_ok=True)

            # Caminho completo do arquivo
            file_path = os.path.join(dir_path, nome)
            relative_path = os.path.join(diretorio, nome)

            # Salva o arquivo
            with open(file_path, "wb+") as destination:
                if hasattr(arquivo, "chunks"):
                    for chunk in arquivo.chunks():
                        destination.write(chunk)
                else:
                    destination.write(arquivo.read())

            # Detecta tipo MIME
            tipo_mime = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
            tamanho = os.path.getsize(file_path)

            logger.info(
                f"File saved: {relative_path}",
                extra={"path": relative_path, "size": tamanho, "mime": tipo_mime},
            )

            return StorageResult(
                caminho=relative_path,
                url=f"{self.media_url}{relative_path}",
                tamanho_bytes=tamanho,
                tipo_mime=tipo_mime,
                sucesso=True,
            )

        except Exception as e:
            logger.error(f"File save error: {e}", exc_info=True)
            return StorageResult(
                caminho="",
                url="",
                sucesso=False,
                erro=str(e),
            )

    def deletar(self, caminho: str) -> bool:
        """Deleta arquivo do sistema de arquivos local."""
        try:
            file_path = os.path.join(self.media_root, caminho)
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"File deleted: {caminho}")
                return True
            return False
        except Exception as e:
            logger.error(f"File delete error: {caminho} - {e}")
            return False

    def existe(self, caminho: str) -> bool:
        """Verifica se arquivo existe no sistema local."""
        file_path = os.path.join(self.media_root, caminho)
        return os.path.exists(file_path)

    def get_url(self, caminho: str) -> str:
        """Retorna URL relativa do arquivo."""
        return f"{self.media_url}{caminho}"
