"""
Synapse - Interface de Storage
Contrato que qualquer implementação de armazenamento deve seguir.
Implementação concreta: infrastructure/storage/local_storage.py
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class StorageResult:
    """Resultado de uma operação de storage."""

    caminho: str
    url: str
    tamanho_bytes: int = 0
    tipo_mime: str = ""
    sucesso: bool = True
    erro: str = ""


class IStorageService(ABC):
    """Interface abstrata para serviço de armazenamento de arquivos."""

    @abstractmethod
    def salvar(self, arquivo, diretorio: str, nome: Optional[str] = None) -> StorageResult:
        """Salva um arquivo e retorna o resultado."""
        pass

    @abstractmethod
    def deletar(self, caminho: str) -> bool:
        """Deleta um arquivo pelo caminho. Retorna True se sucesso."""
        pass

    @abstractmethod
    def existe(self, caminho: str) -> bool:
        """Verifica se um arquivo existe."""
        pass

    @abstractmethod
    def get_url(self, caminho: str) -> str:
        """Retorna a URL pública de um arquivo."""
        pass
