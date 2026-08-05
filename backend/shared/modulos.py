"""
Synapse — Módulos configuráveis por empresa.

Cada empresa liga/desliga os módulos OPCIONAIS (no cadastro e depois em
Configurações). Desligar apenas OCULTA o módulo — nenhum dado é apagado, e
religar traz tudo de volta como estava.

Módulos são INDEPENDENTES: desligar um não afeta os outros.
Os OBRIGATÓRIOS nunca desligam (o sistema não faz sentido sem eles).
"""
from rest_framework.permissions import BasePermission

MODULOS_OBRIGATORIOS = ["financeiro", "clientes", "dashboard"]

MODULOS_OPCIONAIS = [
    "estoque",
    "fornecedores",
    "projetos",
    "agenda",
    "equipe",
    "documentos",
]

# Rótulos e descrições exibidos em Configurações (fonte única — o front lê daqui).
MODULOS_INFO = {
    "estoque": {
        "label": "Estoque",
        "descricao": "Controle de produtos e movimentações",
        "icone": "📦",
    },
    "fornecedores": {
        "label": "Fornecedores",
        "descricao": "Cadastro e avaliação de fornecedores",
        "icone": "🏭",
    },
    "projetos": {
        "label": "Projetos",
        "descricao": "Projetos, tarefas e prazos",
        "icone": "📋",
    },
    "agenda": {
        "label": "Agenda",
        "descricao": "Compromissos e eventos",
        "icone": "📅",
    },
    "equipe": {
        "label": "Equipe",
        "descricao": "Membros, metas e kanban da equipe",
        "icone": "👥",
    },
    "documentos": {
        "label": "Documentos",
        "descricao": "Contratos e arquivos da empresa",
        "icone": "📄",
    },
}


def modulo_ativo(empresa, nome_modulo: str) -> bool:
    """
    True se o módulo está ativo para a empresa.
    Obrigatórios são sempre ativos. Sem empresa (ou campo ausente) → True,
    para não bloquear fluxos legados/retrocompatibilidade.
    """
    if nome_modulo in MODULOS_OBRIGATORIOS:
        return True
    if empresa is None:
        return True
    return bool(getattr(empresa, f"modulo_{nome_modulo}", True))


def modulos_da_empresa(empresa) -> dict:
    """Mapa {modulo: bool} dos OPCIONAIS — o que o /auth/me devolve."""
    return {nome: modulo_ativo(empresa, nome) for nome in MODULOS_OPCIONAIS}


def empresas_com_modulo(nome_modulo: str) -> set:
    """
    IDs (str) das empresas com o módulo ATIVO. Usado pelas tasks Celery para
    pular empresas que desligaram o módulo. Obrigatório → todas as empresas.
    """
    from modules.auth.models import Empresa

    qs = Empresa.objects.all()
    if nome_modulo in MODULOS_OPCIONAIS:
        qs = qs.filter(**{f"modulo_{nome_modulo}": True})
    return {str(pk) for pk in qs.values_list("id", flat=True)}


class ModuloAtivo(BasePermission):
    """
    Bloqueia a view quando o módulo dela está desativado para a empresa.

    Uso na view:
        class ProdutoListView(APIView):
            modulo = "estoque"
            permission_classes = [IsAuthenticated, IsEmpresaMember, ModuloAtivo]

    Views sem o atributo `modulo` passam direto (não quebra nada existente).
    """

    message = "Este módulo está desativado. Ative em Configurações."
    code = "MODULO_DESATIVADO"

    def has_permission(self, request, view):
        nome = getattr(view, "modulo", None)
        if not nome:
            return True
        empresa = getattr(request.user, "empresa", None)
        return modulo_ativo(empresa, nome)
