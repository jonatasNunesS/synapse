"""
Synapse — M7: Repository do módulo Equipe.
Todas as queries ao banco passam por aqui.
"""
import logging
from django.db import transaction
from django.core.cache import cache
from .models import MembroEquipe, MetaMembro

logger = logging.getLogger("synapse")

CACHE_MEMBROS_KEY = "synapse:{empresa_id}:equipe:membros"
CACHE_RESUMO_KEY = "synapse:{empresa_id}:equipe:resumo"
CACHE_MEMBROS_TTL = 300   # 5 minutos
CACHE_RESUMO_TTL = 600    # 10 minutos


class EquipeRepository:

    @staticmethod
    def listar(empresa_id: str, filtros: dict = None):
        """Lista membros da equipe com filtros opcionais."""
        qs = (
            MembroEquipe.objects.filter(empresa_id=empresa_id)
            .select_related("usuario")
            .order_by("usuario__nome")
        )
        if filtros:
            if filtros.get("departamento"):
                qs = qs.filter(departamento__icontains=filtros["departamento"])
            if filtros.get("perfil"):
                qs = qs.filter(usuario__perfil=filtros["perfil"])
            if filtros.get("ativo") is not None:
                qs = qs.filter(ativo=filtros["ativo"])
            if filtros.get("busca"):
                from django.db.models import Q
                qs = qs.filter(
                    Q(usuario__nome__icontains=filtros["busca"])
                    | Q(cargo__icontains=filtros["busca"])
                    | Q(departamento__icontains=filtros["busca"])
                )
        return qs

    @staticmethod
    def obter(membro_id: str, empresa_id: str) -> MembroEquipe:
        return MembroEquipe.objects.select_related("usuario").get(
            id=membro_id, empresa_id=empresa_id
        )

    @staticmethod
    def criar(empresa_id: str, usuario_id: str, dados: dict) -> MembroEquipe:
        membro = MembroEquipe.objects.create(
            empresa_id=empresa_id,
            usuario_id=usuario_id,
            **dados,
        )
        cache.delete(CACHE_MEMBROS_KEY.format(empresa_id=empresa_id))
        cache.delete(CACHE_RESUMO_KEY.format(empresa_id=empresa_id))
        return membro

    @staticmethod
    def atualizar(membro: MembroEquipe, dados: dict) -> MembroEquipe:
        for campo, valor in dados.items():
            setattr(membro, campo, valor)
        membro.save()
        cache.delete(CACHE_MEMBROS_KEY.format(empresa_id=str(membro.empresa_id)))
        cache.delete(CACHE_RESUMO_KEY.format(empresa_id=str(membro.empresa_id)))
        return membro

    @staticmethod
    def deletar(membro_id: str, empresa_id: str, solicitante_id: str = None) -> bool:
        """
        Remove o membro E a conta de usuário associada, liberando o e-mail
        para um novo convite. Antes, o hard delete só apagava o MembroEquipe e
        deixava o CustomUser órfão — o que fazia o reconvite falhar com
        "e-mail já cadastrado". Deletar o usuário é seguro: FKs de dados do
        próprio usuário são CASCADE e campos de auditoria (criado_por) são
        SET_NULL.

        Preserva a conta (só remove o vínculo) quando o alvo é um superusuário
        ou o próprio solicitante — evita alguém apagar a própria conta ao sair
        da equipe.
        """
        try:
            membro = MembroEquipe.objects.select_related("usuario").get(
                id=membro_id, empresa_id=empresa_id
            )
        except MembroEquipe.DoesNotExist:
            return False

        usuario = membro.usuario
        preservar_conta = (
            usuario is None
            or usuario.is_superuser
            or (solicitante_id is not None and str(usuario.id) == str(solicitante_id))
        )

        with transaction.atomic():
            membro.delete()
            if not preservar_conta:
                usuario.delete()

        cache.delete(CACHE_MEMBROS_KEY.format(empresa_id=empresa_id))
        cache.delete(CACHE_RESUMO_KEY.format(empresa_id=empresa_id))
        return True

    @staticmethod
    def resumo(empresa_id: str) -> dict:
        """Calcula KPIs da equipe com cache."""
        cache_key = CACHE_RESUMO_KEY.format(empresa_id=empresa_id)
        cached = cache.get(cache_key)
        if cached:
            return cached

        membros = MembroEquipe.objects.filter(empresa_id=empresa_id).select_related("usuario")
        total = membros.count()
        ativos = membros.filter(ativo=True).count()

        por_perfil = {"admin": 0, "gerente": 0, "colaborador": 0}
        por_dept: dict = {}
        for m in membros.filter(ativo=True):
            perfil = m.usuario.perfil or "colaborador"
            por_perfil[perfil] = por_perfil.get(perfil, 0) + 1
            if m.departamento:
                por_dept[m.departamento] = por_dept.get(m.departamento, 0) + 1

        por_departamento = [
            {"departamento": k, "count": v} for k, v in sorted(por_dept.items())
        ]

        # KPIs de metas — o frontend (ResumoEquipeCards) lê metas_ativas e
        # metas_atingidas; sem eles o card exibia "undefined (0%)".
        metas = MetaMembro.objects.filter(empresa_id=empresa_id)
        metas_ativas = metas.count()
        metas_atingidas = metas.filter(atingida=True).count()

        resultado = {
            "total_membros": total,
            "membros_ativos": ativos,
            "membros_inativos": total - ativos,
            "por_perfil": por_perfil,
            "por_departamento": por_departamento,
            "departamentos": {d["departamento"]: d["count"] for d in por_departamento},
            "metas_ativas": metas_ativas,
            "metas_atingidas": metas_atingidas,
        }
        cache.set(cache_key, resultado, CACHE_RESUMO_TTL)
        return resultado

    @staticmethod
    def criar_membro_convidado(empresa_id: str, dados_usuario: dict, dados_membro: dict):
        """
        Cria CustomUser + MembroEquipe em transaction.atomic().
        O usuário nasce SEM senha utilizável: o primeiro acesso é feito pelo
        link de convite (token de definição de senha), nunca por senha pronta.
        """
        from modules.auth.models import CustomUser
        from shared.exceptions import BusinessRuleViolation

        # Multi-tenant: um usuário pertence a UMA empresa. Se o e-mail já existe,
        # traduz o conflito em 400 claro (em vez do IntegrityError → 500 que o
        # create_user levantaria por causa do unique global de email).
        try:
            existente = CustomUser.objects.get(email=dados_usuario["email"])
            if str(existente.empresa_id) == str(empresa_id):
                raise BusinessRuleViolation(
                    code="MEMBRO_JA_NA_EQUIPE",
                    message="Este usuário já faz parte da sua equipe.",
                )
            raise BusinessRuleViolation(
                code="EMAIL_OUTRA_EMPRESA",
                message=(
                    "Este email já está cadastrado em outra empresa no Synapse "
                    "e não pode ser convidado."
                ),
            )
        except CustomUser.DoesNotExist:
            pass  # E-mail livre — segue para a criação.

        with transaction.atomic():
            usuario = CustomUser.objects.create_user(
                email=dados_usuario["email"],
                nome=dados_usuario["nome"],
                senha=None,  # set_password(None) → has_usable_password() == False
                empresa_id=empresa_id,
                perfil=dados_usuario.get("perfil", "colaborador"),
            )
            membro = MembroEquipe.objects.create(
                empresa_id=empresa_id,
                usuario=usuario,
                cargo=dados_membro.get("cargo", ""),
                departamento=dados_membro.get("departamento", ""),
            )
        cache.delete(CACHE_MEMBROS_KEY.format(empresa_id=empresa_id))
        cache.delete(CACHE_RESUMO_KEY.format(empresa_id=empresa_id))
        return usuario, membro

    # ── Metas ──────────────────────────────────────────────────

    @staticmethod
    def listar_metas(membro_id: str, empresa_id: str):
        return MetaMembro.objects.filter(
            membro_id=membro_id, empresa_id=empresa_id
        ).order_by("-criado_em")

    @staticmethod
    def criar_meta(membro_id: str, empresa_id: str, dados: dict) -> MetaMembro:
        return MetaMembro.objects.create(
            membro_id=membro_id, empresa_id=empresa_id, **dados
        )

    @staticmethod
    def obter_meta(meta_id: str, membro_id: str, empresa_id: str) -> MetaMembro:
        return MetaMembro.objects.get(
            id=meta_id, membro_id=membro_id, empresa_id=empresa_id
        )

    @staticmethod
    def atualizar_meta(meta: MetaMembro, dados: dict) -> MetaMembro:
        for campo, valor in dados.items():
            setattr(meta, campo, valor)
        meta.save()
        return meta

    @staticmethod
    def deletar_meta(meta_id: str, membro_id: str, empresa_id: str) -> bool:
        deleted, _ = MetaMembro.objects.filter(
            id=meta_id, membro_id=membro_id, empresa_id=empresa_id
        ).delete()
        return deleted > 0
