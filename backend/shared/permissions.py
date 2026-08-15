"""
Synapse — Permissões Customizadas
Multi-tenant obrigatório: todo acesso filtrado por empresa_id.
Atualizado no M1 para usar ForeignKey empresa (UUID).
"""

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

# Empresa suspensa administrativamente (painel Synapse). Espelha
# STATUS_EMPRESA_CHOICES em modules.auth.models.
STATUS_SUSPENSA = "suspensa"

MSG_SEM_EMPRESA = "Usuário não está vinculado a nenhuma empresa ativa."
MSG_EMPRESA_SUSPENSA = (
    "Esta empresa está suspensa e não pode realizar operações. "
    "Entre em contato com o suporte para regularizar."
)


class EmpresaAtiva(BasePermission):
    """
    Bloqueia operações de negócio quando a empresa está SUSPENSA.

    A suspensão é administrativa (painel Synapse) e não impede o login: o
    usuário entra, o /auth/me devolve `empresa.status == "suspensa"` e o
    frontend exibe a tela de aviso. Esta permission é a contraparte no
    backend — sem ela, bastava chamar a API direto para continuar operando.

    Quem NÃO é bloqueado:
      • staff da plataforma (`is_staff_synapse`) — precisa operar sobre a
        empresa suspensa justamente para suspender/reativar;
      • usuário sem empresa — quem responde por isso é `IsEmpresaMember`;
      • usuário não autenticado — quem responde é `IsAuthenticated`.

    Está embutida em `IsEmpresaMember` (ver abaixo), então vale para todos
    os endpoints de dados sem precisar ser declarada view a view.
    """

    message = MSG_EMPRESA_SUSPENSA
    code = "EMPRESA_SUSPENSA"

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return True
        if getattr(user, "is_staff_synapse", False):
            return True
        empresa = getattr(user, "empresa", None)
        if empresa is None:
            return True
        return getattr(empresa, "status", "ativa") != STATUS_SUSPENSA


class IsEmpresaMember(BasePermission):
    """
    Verifica se o usuário pertence a uma empresa ativa.
    Usado em todas as views protegidas.

    Reúne duas checagens porque ambas são pré-condição de qualquer operação
    de dados: o usuário tem empresa, e essa empresa não está suspensa. Como
    esta classe já está em todos os endpoints de negócio, embutir a segunda
    aqui garante cobertura completa — e mantém de fora, automaticamente, o
    painel de staff (`IsStaffSynapse`) e os endpoints que a empresa suspensa
    ainda precisa acessar (logout e /auth/me usam apenas `IsAuthenticated`).
    """

    message = MSG_SEM_EMPRESA

    def has_permission(self, request, view):
        vinculado = (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "empresa_id")
            and request.user.empresa_id is not None
        )
        if not vinculado:
            self.message = MSG_SEM_EMPRESA
            return False

        if not EmpresaAtiva().has_permission(request, view):
            # Empresta mensagem e código para o handler devolver
            # 403 EMPRESA_SUSPENSA em vez de PERMISSION_DENIED genérico.
            self.message = EmpresaAtiva.message
            self.code = EmpresaAtiva.code
            return False

        return True


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


class IsStaffSynapse(BasePermission):
    """
    Acesso restrito ao STAFF da plataforma Synapse (painel administrativo).
    Exige usuário autenticado E is_staff_synapse=True. É uma visão de
    plataforma (cross-tenant) — não usa EmpresaQuerySetMixin de propósito.
    """

    message = "Acesso restrito ao staff da plataforma Synapse."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_staff_synapse", False)
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
