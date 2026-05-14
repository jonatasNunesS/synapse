"""
Synapse — M1: URLs de Autenticação
Prefixo: /api/auth/
"""

from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeView,
    RecuperarSenhaView,
    RedefinirSenhaView,
    RefreshView,
    RegistroView,
)

urlpatterns = [
    path("registro/", RegistroView.as_view(), name="auth-registro"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("recuperar-senha/", RecuperarSenhaView.as_view(), name="auth-recuperar-senha"),
    path("redefinir-senha/", RedefinirSenhaView.as_view(), name="auth-redefinir-senha"),
    path("me/", MeView.as_view(), name="auth-me"),
]
