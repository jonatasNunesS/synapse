"""
Synapse — Painel Administrativo: Repository (acesso a dados).

Visão de PLATAFORMA (cross-tenant): consulta empresas e usuários de todos os
tenants. O bypass do isolamento multi-tenant é consciente e restrito ao staff.
"""
from django.db.models import Count

from modules.auth.models import CustomUser, Empresa

from .models import LogAlteracaoPlano


class PainelAdminRepository:
    """Acesso a dados do painel administrativo."""

    @staticmethod
    def empresas_com_contadores():
        """Todas as empresas, anotadas com o nº de usuários."""
        return (
            Empresa.objects.all()
            .annotate(num_usuarios=Count("usuarios"))
            .order_by("-criado_em")
        )

    @staticmethod
    def get_empresa(empresa_id):
        return Empresa.objects.filter(pk=empresa_id).first()

    @staticmethod
    def usuarios_da_empresa(empresa_id):
        return CustomUser.objects.filter(empresa_id=empresa_id).order_by("-criado_em")

    @staticmethod
    def historico(empresa_id):
        """Histórico de trocas de plano, do mais recente ao mais antigo."""
        return LogAlteracaoPlano.objects.filter(empresa_id=empresa_id).order_by(
            "-alterado_em"
        )

    @staticmethod
    def criar_log(**dados) -> LogAlteracaoPlano:
        return LogAlteracaoPlano.objects.create(**dados)
