"""
Synapse - Permissões Customizadas
Multi-tenant obrigatório: todo acesso filtrado por empresa_id.
"""

from rest_framework.permissions import BasePermission


class IsEmpresaMember(BasePermission):
    """
    Verifica se o usuário pertence a uma empresa ativa.
    Usado em todas as views protegidas.
    """

    message = "Usuário não está vinculado a nenhuma empresa ativa."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "empresa_id")
            and request.user.empresa_id is not None
        )


class IsAdmin(BasePermission):
    """Verifica se o usuário tem perfil de administrador."""

    message = "Acesso restrito a administradores."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "perfil")
            and request.user.perfil == "admin"
        )


class IsAdminOrGerente(BasePermission):
    """Verifica se o usuário é admin ou gerente."""

    message = "Acesso restrito a administradores e gerentes."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "perfil")
            and request.user.perfil in ("admin", "gerente")
        )


class EmpresaQuerySetMixin:
    """
    Mixin multi-tenant obrigatório.
    Toda view que herda este mixin filtra automaticamente por empresa_id.
    Garante que um usuário NUNCA veja dados de outra empresa.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(self.request.user, "empresa_id") and self.request.user.empresa_id:
            return queryset.filter(empresa_id=self.request.user.empresa_id)
        return queryset.none()

    def perform_create(self, serializer):
        """Ao criar, injeta empresa_id automaticamente."""
        serializer.save(empresa_id=self.request.user.empresa_id)
