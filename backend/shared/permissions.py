"""
Synapse — Permissões Customizadas
Multi-tenant obrigatório: todo acesso filtrado por empresa_id.
Atualizado no M1 para usar ForeignKey empresa (UUID).
"""

from rest_framework.exceptions import PermissionDenied
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

    Uso:
        class MinhaView(EmpresaQuerySetMixin, ModelViewSet):
            queryset = MeuModel.objects.all()
            ...
    """

    def get_empresa_id(self):
        """
        Retorna o empresa_id do usuário autenticado.
        Lança PermissionDenied se o usuário não tiver empresa.
        """
        user = self.request.user
        if not hasattr(user, "empresa_id") or user.empresa_id is None:
            raise PermissionDenied(
                "Usuário não está vinculado a nenhuma empresa. Acesso negado."
            )
        return user.empresa_id

    def get_queryset(self):
        """Filtra queryset pelo empresa_id do usuário logado."""
        queryset = super().get_queryset()
        empresa_id = self.get_empresa_id()
        return queryset.filter(empresa_id=empresa_id)

    def perform_create(self, serializer):
        """Ao criar, injeta empresa_id automaticamente."""
        empresa_id = self.get_empresa_id()
        serializer.save(empresa_id=empresa_id)

    def check_tenant_ownership(self, obj) -> None:
        """
        Verifica se o objeto pertence à empresa do usuário.
        Lança PermissionDenied se não pertencer.
        Usar em retrieve/update/destroy para objetos específicos.
        """
        empresa_id = self.get_empresa_id()
        obj_empresa_id = getattr(obj, "empresa_id", None)
        if str(obj_empresa_id) != str(empresa_id):
            raise PermissionDenied(
                "Você não tem permissão para acessar este recurso."
            )
