"""
Synapse - Middleware
- RequestLoggingMiddleware: loga todas as requisições em JSON estruturado.
- Gera request_id único para rastreamento.
"""

import logging
import time
import uuid

logger = logging.getLogger("synapse")


class RequestLoggingMiddleware:
    """
    Middleware que loga cada requisição HTTP com:
    - request_id (UUID único)
    - método, path, status code
    - tempo de resposta em ms
    - empresa_id e usuario_id (quando autenticado)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Gera request_id único
        request_id = str(uuid.uuid4())
        request.META["HTTP_X_REQUEST_ID"] = request_id

        start_time = time.monotonic()

        response = self.get_response(request)

        duration_ms = round((time.monotonic() - start_time) * 1000, 2)

        # Extrai dados do usuário se autenticado
        user_id = None
        empresa_id = None
        if hasattr(request, "user") and request.user.is_authenticated:
            user_id = request.user.id
            empresa_id = getattr(request.user, "empresa_id", None)

        # Loga a requisição (exceto health check e static files)
        path = request.path
        if not path.startswith(("/static/", "/media/", "/__debug__/")):
            log_data = {
                "request_id": request_id,
                "method": request.method,
                "path": path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "usuario_id": user_id,
                "empresa_id": empresa_id,
                "ip": self._get_client_ip(request),
            }

            if response.status_code >= 500:
                logger.error("Request failed", extra=log_data)
            elif response.status_code >= 400:
                logger.warning("Request error", extra=log_data)
            else:
                logger.info("Request completed", extra=log_data)

        # Adiciona request_id ao header da resposta
        response["X-Request-ID"] = request_id

        return response

    @staticmethod
    def _get_client_ip(request):
        """Extrai o IP real do cliente (considerando proxy)."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")
