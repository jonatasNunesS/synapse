"""
Synapse - Paginação Padrão
Todas as listagens usam esta paginação (max 25 itens por página).
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    Paginação padrão do Synapse.
    - page_size: 25 (padrão)
    - page_size_query_param: 'page_size' (permite override até max_page_size)
    - max_page_size: 25
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 25

    def get_paginated_response(self, data):
        """
        Resposta paginada no padrão Synapse:
        {
            "success": true,
            "data": [...],
            "message": "",
            "pagination": {
                "count": 100,
                "page": 1,
                "page_size": 25,
                "total_pages": 4,
                "next": "http://...",
                "previous": null
            }
        }
        """
        return Response(
            {
                "success": True,
                "data": data,
                "message": "",
                "pagination": {
                    "count": self.page.paginator.count,
                    "page": self.page.number,
                    "page_size": self.get_page_size(self.request),
                    "total_pages": self.page.paginator.num_pages,
                    "next": self.get_next_link(),
                    "previous": self.get_previous_link(),
                },
            }
        )
