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
    """Endpoint de health check: GET /api/health/"""
    return JsonResponse(
        {
            "success": True,
            "data": {"status": "ok", "service": "synapse-backend"},
            "message": "Synapse API está operacional.",
        }
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
    path("api/agenda/", include("modules.agenda.urls")),
    path("api/mensagens/", include("modules.mensagens.urls")),
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
