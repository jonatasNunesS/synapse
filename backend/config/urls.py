"""
Synapse - Roteamento Principal
Todas as rotas da API seguem o padrão /api/{modulo}/
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.http import require_GET


@require_GET
def health_check(request):
    """
    Endpoint de health check enriquecido: GET /api/health/
    Verifica DB, Redis e Celery individualmente.
    Retorna HTTP 200 se tudo ok, HTTP 503 se qualquer dependência falhar.
    """
    import time
    from django.db import connection, OperationalError as DBError
    from django.core.cache import cache
    from celery.app.control import Control
    from config.celery import app as celery_app

    checks = {}
    overall_ok = True

    # ── DB ──────────────────────────────────────────────────────────
    try:
        connection.ensure_connection()
        checks["db"] = {"status": "ok"}
    except DBError as exc:
        checks["db"] = {"status": "error", "detail": str(exc)}
        overall_ok = False

    # ── Redis ──────────────────────────────────────────────────────
    try:
        _probe_key = "synapse:health:probe"
        _probe_val = str(time.time())
        cache.set(_probe_key, _probe_val, timeout=10)
        assert cache.get(_probe_key) == _probe_val
        checks["redis"] = {"status": "ok"}
    except Exception as exc:
        checks["redis"] = {"status": "error", "detail": str(exc)}
        overall_ok = False

    # ── Celery ─────────────────────────────────────────────────────
    try:
        ctrl = Control(app=celery_app)
        # ping com timeout curto para não bloquear o health check
        pong = ctrl.ping(timeout=1.0)
        if pong:
            checks["celery"] = {"status": "ok", "workers": len(pong)}
        else:
            # Sem workers ativos — não é erro crítico (pode estar escalando)
            checks["celery"] = {"status": "no_workers"}
    except Exception as exc:
        checks["celery"] = {"status": "error", "detail": str(exc)}
        overall_ok = False

    http_status = 200 if overall_ok else 503
    return JsonResponse(
        {
            "success": overall_ok,
            "data": {
                "status": "ok" if overall_ok else "degraded",
                "service": "synapse-backend",
                "checks": checks,
            },
            "message": "Synapse API está operacional." if overall_ok else "Synapse API degradada.",
        },
        status=http_status,
    )


urlpatterns = [
    # ── Admin ──────────────────────────────────────────────
    path("admin/", admin.site.urls),
    # ── Health Check ───────────────────────────────────────
    path("api/health/", health_check, name="health-check"),
    # ── Módulos ────────────────────────────────────────────
    path("api/auth/", include("modules.auth.urls")),
    path("api/financeiro/", include("modules.financeiro.urls")),
    path("api/estoque/", include("modules.estoque.urls")),
    path("api/clientes/", include("modules.clientes.urls")),
    path("api/fornecedores/", include("modules.fornecedores.urls")),
    path("api/projetos/", include("modules.projetos.urls")),
    path("api/equipe/", include("modules.equipe.urls")),
    path("api/documentos/", include("modules.documentos.urls")),
    path("api/notificacoes/", include("modules.notificacoes.urls")),
    path("api/dashboard/", include("modules.dashboard.urls")),
    path("api/ai/", include("modules.ai_hub.urls")),
    path("api/search/", include("modules.search.urls")),
]

# ── Debug Toolbar (apenas em dev) ──────────────────────────
if settings.DEBUG:
    try:
        import debug_toolbar

        urlpatterns = [
            path("__debug__/", include(debug_toolbar.urls)),
        ] + urlpatterns
    except ImportError:
        pass

# ── Arquivos de mídia (apenas em dev) ──────────────────────
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
