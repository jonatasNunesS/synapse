"""
Synapse — Painel Administrativo: Repository (acesso a dados).

Visão de PLATAFORMA (cross-tenant): consulta empresas e usuários de todos os
tenants. O bypass do isolamento multi-tenant é consciente e restrito ao staff.
"""
from django.db.models import Count, F, Max, Q

from modules.auth.models import CustomUser, Empresa

from .models import AuditLog, LogAlteracaoPlano


class PainelAdminRepository:
    """Acesso a dados do painel administrativo."""

    @staticmethod
    def empresas_com_contadores(filtros: dict | None = None):
        """
        Empresas anotadas com nº de usuários e último acesso, com busca,
        filtros (plano/status) e ordenação aplicados.
        """
        filtros = filtros or {}
        qs = Empresa.objects.all().annotate(
            num_usuarios=Count("usuarios", distinct=True),
            ultimo_acesso=Max("usuarios__last_login"),
        )

        busca = (filtros.get("busca") or "").strip()
        if busca:
            # Nome da empresa OU email de qualquer usuário da empresa.
            qs = qs.filter(
                Q(nome__icontains=busca) | Q(usuarios__email__icontains=busca)
            ).distinct()

        plano = filtros.get("plano")
        if plano:
            qs = qs.filter(plano=plano)

        status = filtros.get("status")
        if status in ("ativa", "suspensa"):
            qs = qs.filter(status=status)

        return qs.order_by(*_ordenacao(filtros.get("ordenar")))

    @staticmethod
    def get_empresa(empresa_id):
        return Empresa.objects.filter(pk=empresa_id).first()

    @staticmethod
    def usuarios_da_empresa(empresa_id):
        return CustomUser.objects.filter(empresa_id=empresa_id).order_by("-criado_em")

    @staticmethod
    def get_usuario_da_empresa(empresa_id, usuario_id):
        return CustomUser.objects.filter(empresa_id=empresa_id, pk=usuario_id).first()

    @staticmethod
    def ultimo_acesso(empresa_id):
        """Último login de qualquer usuário da empresa (ou None)."""
        return (
            CustomUser.objects.filter(empresa_id=empresa_id)
            .aggregate(ultimo=Max("last_login"))
            .get("ultimo")
        )

    @staticmethod
    def historico(empresa_id):
        """Histórico de eventos (planos, criação, suspensão…) do mais recente."""
        return LogAlteracaoPlano.objects.filter(empresa_id=empresa_id).order_by(
            "-alterado_em"
        )

    @staticmethod
    def criar_log(**dados) -> LogAlteracaoPlano:
        return LogAlteracaoPlano.objects.create(**dados)

    @staticmethod
    def criar_auditoria(**dados) -> AuditLog:
        return AuditLog.objects.create(**dados)


def _ordenacao(ordenar: str | None):
    """
    Converte o parâmetro `ordenar` na lista de campos do order_by.
    Ordenar por uso (último acesso) empurra quem nunca acessou (NULL) pro fim.
    """
    if ordenar == "nome":
        return ["nome"]
    if ordenar == "-nome":
        return ["-nome"]
    if ordenar == "cadastro":
        return ["criado_em"]
    if ordenar == "uso":
        return [F("ultimo_acesso").asc(nulls_last=True), "-criado_em"]
    if ordenar == "-uso":
        return [F("ultimo_acesso").desc(nulls_last=True), "-criado_em"]
    # Default: mais recentes primeiro.
    return ["-criado_em"]
