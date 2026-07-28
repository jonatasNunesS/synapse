"""
Synapse — Painel Administrativo: Service (orquestração / regras).

Toda troca de plano gera um LogAlteracaoPlano. Se a mutação falhar, a tentativa
também é registrada (status="erro") antes de propagar o erro.
"""
import logging
import secrets
from datetime import date, timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from modules.auth.models import PLANO_CHOICES, CustomUser, Empresa
from shared.exceptions import BusinessRuleViolation, ResourceNotFound

from .repository import PainelAdminRepository

logger = logging.getLogger("synapse")

PLANOS_VALIDOS = [p[0] for p in PLANO_CHOICES]

# Hard delete só é liberado depois de suspensa por este tanto de dias.
DIAS_SUSPENSA_PARA_EXCLUIR = 30


class PainelAdminService:
    """Regras do painel administrativo (visão de plataforma)."""

    # ── Empresas ─────────────────────────────────────────────────────────────
    @staticmethod
    def listar_empresas(filtros: dict | None = None):
        return PainelAdminRepository.empresas_com_contadores(filtros)

    @staticmethod
    def creditos_usados_hoje(empresa_id) -> int:
        """Créditos de IA já usados hoje pela empresa (0 para ilimitado)."""
        from modules.ai_hub.creditos import CreditosService

        return CreditosService.saldo(empresa_id)["usado"]

    @staticmethod
    def creditos_usados_mes(empresa_id) -> int:
        """
        Soma dos créditos usados em cada dia do mês corrente. Lê os contadores
        diários do cache (chave ai:uso:{empresa}:YYYY-MM-DD) dia a dia.
        """
        from django.core.cache import cache

        hoje = date.today()
        total = 0
        dia = date(hoje.year, hoje.month, 1)
        while dia <= hoje:
            chave = f"ai:uso:{empresa_id}:{dia.isoformat()}"
            total += int(cache.get(chave) or 0)
            dia += timedelta(days=1)
        return total

    @staticmethod
    def ultimo_acesso(empresa_id):
        return PainelAdminRepository.ultimo_acesso(empresa_id)

    @staticmethod
    def total_lancamentos(empresa_id) -> int:
        from modules.financeiro.models import Lancamento

        return Lancamento.objects.filter(empresa_id=empresa_id).count()

    @staticmethod
    def total_clientes(empresa_id) -> int:
        from modules.clientes.models import Cliente

        return Cliente.objects.filter(empresa_id=empresa_id).count()

    @staticmethod
    def obter_empresa(empresa_id):
        empresa = PainelAdminRepository.get_empresa(empresa_id)
        if empresa is None:
            raise ResourceNotFound("Empresa", str(empresa_id))
        return empresa

    @staticmethod
    def usuarios_da_empresa(empresa_id):
        return PainelAdminRepository.usuarios_da_empresa(empresa_id)

    @staticmethod
    def listar_historico(empresa_id):
        # Garante que a empresa existe (404 claro em vez de lista vazia silenciosa)
        PainelAdminService.obter_empresa(empresa_id)
        return PainelAdminRepository.historico(empresa_id)

    # ── Criar empresa ────────────────────────────────────────────────────────
    @staticmethod
    def criar_empresa(dados: dict, usuario):
        """
        Cria a Empresa + o CustomUser admin dela + o log de criação. Nunca
        seta is_staff_synapse (só o comando manage.py criar_staff_synapse pode).
        """
        with transaction.atomic():
            empresa = Empresa.objects.create(
                nome=dados["nome_empresa"],
                segmento=dados["segmento"],
                plano=dados["plano"],
            )
            admin = CustomUser.objects.create_user(
                email=dados["admin_email"],
                nome=dados["admin_nome"],
                senha=dados["admin_senha"],
                empresa=empresa,
                perfil="admin",
                # is_staff_synapse NUNCA vem daqui — fica no default (False).
            )
            PainelAdminRepository.criar_log(
                empresa=empresa,
                acao="criacao",
                plano_anterior="",
                plano_novo=empresa.plano,
                alterado_por=usuario,
                observacao=f"Empresa criada com admin {admin.email}.",
                status="sucesso",
            )
        logger.info(
            "Painel: empresa %s criada (por %s)",
            empresa.id, getattr(usuario, "email", "?"),
        )
        return empresa, admin

    # ── Editar empresa (nome/segmento) ───────────────────────────────────────
    @staticmethod
    def editar_empresa(empresa_id, dados: dict):
        empresa = PainelAdminService.obter_empresa(empresa_id)
        campos = []
        if dados.get("nome") is not None:
            empresa.nome = dados["nome"]
            campos.append("nome")
        if dados.get("segmento") is not None:
            empresa.segmento = dados["segmento"]
            campos.append("segmento")
        if campos:
            campos.append("atualizado_em")
            empresa.save(update_fields=campos)
        return empresa

    # ── Suspender / reativar ─────────────────────────────────────────────────
    @staticmethod
    def suspender(empresa_id, motivo: str, usuario):
        empresa = PainelAdminService.obter_empresa(empresa_id)
        with transaction.atomic():
            empresa.status = "suspensa"
            empresa.data_suspensao = timezone.now()
            empresa.motivo_suspensao = motivo
            empresa.suspensa_por = usuario if getattr(usuario, "pk", None) else None
            empresa.save(
                update_fields=[
                    "status", "data_suspensao", "motivo_suspensao",
                    "suspensa_por", "atualizado_em",
                ]
            )
            PainelAdminRepository.criar_log(
                empresa=empresa,
                acao="suspenso",
                plano_anterior=empresa.plano,
                plano_novo=empresa.plano,
                alterado_por=usuario,
                observacao=motivo,
                status="sucesso",
            )
        logger.info("Painel: empresa %s suspensa (por %s)", empresa_id,
                    getattr(usuario, "email", "?"))
        return empresa

    @staticmethod
    def reativar(empresa_id, usuario, motivo: str = ""):
        empresa = PainelAdminService.obter_empresa(empresa_id)
        with transaction.atomic():
            empresa.status = "ativa"
            empresa.data_suspensao = None
            empresa.motivo_suspensao = ""
            empresa.suspensa_por = None
            empresa.save(
                update_fields=[
                    "status", "data_suspensao", "motivo_suspensao",
                    "suspensa_por", "atualizado_em",
                ]
            )
            PainelAdminRepository.criar_log(
                empresa=empresa,
                acao="reativado",
                plano_anterior=empresa.plano,
                plano_novo=empresa.plano,
                alterado_por=usuario,
                observacao=motivo or "",
                status="sucesso",
            )
        logger.info("Painel: empresa %s reativada (por %s)", empresa_id,
                    getattr(usuario, "email", "?"))
        return empresa

    # ── Excluir (hard delete com trava de 30 dias) ───────────────────────────
    @staticmethod
    def excluir_empresa(empresa_id, usuario):
        """
        Apaga em cascata TODOS os dados da empresa. Só é permitido se a empresa
        estiver suspensa há pelo menos 30 dias — trava contra exclusão acidental
        de empresa ativa. Registra um AuditLog que persiste após a exclusão.
        """
        empresa = PainelAdminService.obter_empresa(empresa_id)

        bloqueio = BusinessRuleViolation(
            code="EXCLUSAO_BLOQUEADA",
            message=(
                "Suspenda a empresa por pelo menos 30 dias antes de excluir "
                "definitivamente."
            ),
        )
        if empresa.status != "suspensa" or empresa.data_suspensao is None:
            raise bloqueio
        dias = (timezone.now() - empresa.data_suspensao).days
        if dias < DIAS_SUSPENSA_PARA_EXCLUIR:
            bloqueio.details = {"dias_suspensa": dias, "minimo": DIAS_SUSPENSA_PARA_EXCLUIR}
            raise bloqueio

        nome = empresa.nome
        with transaction.atomic():
            # 1) A auditoria é gravada ANTES (persiste mesmo após apagar tudo).
            PainelAdminRepository.criar_auditoria(
                empresa_id=empresa.id,
                empresa_nome=nome,
                acao="empresa_excluida",
                realizado_por=usuario if getattr(usuario, "pk", None) else None,
                realizado_por_email=getattr(usuario, "email", "") or "",
                detalhes=(
                    f"Suspensa em {empresa.data_suspensao.isoformat()} "
                    f"({dias} dias). Motivo: {empresa.motivo_suspensao or '—'}."
                ),
            )
            # 2) Usuários comuns são apagados; staff da plataforma sobrevive
            #    (empresa vira NULL via on_delete=SET_NULL no delete da empresa).
            CustomUser.objects.filter(
                empresa_id=empresa.id, is_staff_synapse=False
            ).delete()
            # 3) delete() da empresa cascateia todo o resto (CASCADE nas FKs).
            empresa.delete()

        logger.warning(
            "Painel: empresa %s (%s) EXCLUÍDA definitivamente por %s",
            empresa_id, nome, getattr(usuario, "email", "?"),
        )
        return nome

    # ── Usuários da empresa ──────────────────────────────────────────────────
    @staticmethod
    def obter_usuario(empresa_id, usuario_id):
        PainelAdminService.obter_empresa(empresa_id)
        u = PainelAdminRepository.get_usuario_da_empresa(empresa_id, usuario_id)
        if u is None:
            raise ResourceNotFound("Usuário", str(usuario_id))
        return u

    @staticmethod
    def editar_usuario(empresa_id, usuario_id, dados: dict):
        """
        Muda perfil e/ou is_active de um usuário. is_staff_synapse é intocável
        pelo painel — usuário staff não pode ter perfil/status alterados aqui.
        """
        u = PainelAdminService.obter_usuario(empresa_id, usuario_id)
        if u.is_staff_synapse:
            raise BusinessRuleViolation(
                code="USUARIO_STAFF_PROTEGIDO",
                message="Usuários staff da plataforma não podem ser editados pelo painel.",
            )
        campos = []
        if dados.get("perfil") is not None:
            u.perfil = dados["perfil"]
            campos.append("perfil")
        if dados.get("is_active") is not None:
            u.is_active = dados["is_active"]
            u.ativo = dados["is_active"]  # mantém os dois flags coerentes
            campos += ["is_active", "ativo"]
        if campos:
            campos.append("atualizado_em")
            u.save(update_fields=campos)
        return u

    @staticmethod
    def redefinir_senha_usuario(empresa_id, usuario_id) -> tuple:
        """
        Gera uma senha temporária forte, aplica no usuário e a retorna para ser
        exibida (uma única vez) ao staff. Bloqueado para usuários staff.
        """
        u = PainelAdminService.obter_usuario(empresa_id, usuario_id)
        if u.is_staff_synapse:
            raise BusinessRuleViolation(
                code="USUARIO_STAFF_PROTEGIDO",
                message="A senha de um usuário staff não é redefinida pelo painel.",
            )
        nova_senha = _gerar_senha_temporaria()
        u.set_password(nova_senha)
        u.save(update_fields=["password", "atualizado_em"])
        logger.info("Painel: senha do usuário %s redefinida", usuario_id)
        return u, nova_senha

    # ── Troca de plano (auditada) ────────────────────────────────────────────
    @staticmethod
    def trocar_plano(empresa_id, plano_novo: str, usuario, observacao: str = ""):
        """
        Troca o plano da empresa e registra a auditoria. Troca para o MESMO
        plano é permitida (registra a observação). Falha na mutação também é
        registrada (status="erro") e então propagada.
        """
        empresa = PainelAdminService.obter_empresa(empresa_id)
        plano_anterior = empresa.plano

        try:
            with transaction.atomic():
                empresa.plano = plano_novo
                empresa.save(update_fields=["plano", "atualizado_em"])
                log = PainelAdminRepository.criar_log(
                    empresa=empresa,
                    acao="troca_plano",
                    plano_anterior=plano_anterior,
                    plano_novo=plano_novo,
                    alterado_por=usuario,
                    observacao=observacao or "",
                    status="sucesso",
                )
            logger.info(
                "Painel: plano da empresa %s: %s → %s (por %s)",
                empresa_id, plano_anterior, plano_novo, getattr(usuario, "email", "?"),
            )
            return empresa, log
        except Exception as exc:
            # A tentativa falha também vira auditoria (fora da transação revertida).
            logger.error("Painel: falha ao trocar plano da empresa %s — %s", empresa_id, exc)
            PainelAdminRepository.criar_log(
                empresa=empresa,
                acao="troca_plano",
                plano_anterior=plano_anterior,
                plano_novo=plano_novo,
                alterado_por=usuario,
                observacao=observacao or "",
                status="erro",
                erro=str(exc),
            )
            raise


def _gerar_senha_temporaria() -> str:
    """
    Senha temporária forte que passa nos validadores do Django (12 chars,
    letras maiúsculas/minúsculas, dígito e símbolo).
    """
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    corpo = "".join(secrets.choice(alfabeto) for _ in range(10))
    senha = f"{corpo}@{secrets.choice('23456789')}"
    try:
        validate_password(senha)
    except DjangoValidationError:  # pragma: no cover — fallback improvável
        senha = f"Synapse@{secrets.token_urlsafe(6)}"
    return senha
