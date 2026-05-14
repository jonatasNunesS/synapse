"""
Synapse - Interface de Scraping
Contrato que qualquer implementação de scraper deve seguir.
Implementação concreta: infrastructure/scraping/playwright_scraper.py
Nota: Sem implementação real até M9.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class ScrapingResult:
    """Resultado de uma operação de scraping."""

    url: str
    titulo: str = ""
    conteudo: str = ""
    dados: Dict = None
    sucesso: bool = True
    erro: str = ""

    def __post_init__(self):
        if self.dados is None:
            self.dados = {}


class IScraperService(ABC):
    """Interface abstrata para serviço de scraping."""

    @abstractmethod
    def scrape_url(self, url: str) -> ScrapingResult:
        """Faz scraping de uma URL e retorna o conteúdo."""
        pass

    @abstractmethod
    def scrape_precos(self, urls: List[str]) -> List[ScrapingResult]:
        """Faz scraping de preços em múltiplas URLs."""
        pass
