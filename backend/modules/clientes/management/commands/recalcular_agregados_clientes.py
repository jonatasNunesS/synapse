"""
Synapse — Comando: refazer os agregados de compra dos clientes a partir de Venda.

    python manage.py recalcular_agregados_clientes --dry-run
    python manage.py recalcular_agregados_clientes
    python manage.py recalcular_agregados_clientes --empresa=<uuid>

POR QUE ELE EXISTE. `valor_total_compras` e companhia são colunas gravadas, e
até esta leva quem as gravava era um signal em `InteracaoCliente`. As vendas
criadas no fluxo novo nunca passaram por ele: o cliente que comprou R$ 450
mostrava R$ 0,00 (B10). Com a fonte trocada para `Venda`, o código novo
mantém tudo em dia daqui para a frente — mas o que já está no banco continua
errado até alguém recalcular. É isto.

RODAR DUAS VEZES NÃO MUDA NADA. O recálculo é completo, não incremental: ele
lê as vendas e escreve o resultado, em vez de somar diferenças. Por isso é
seguro repetir, e por isso `--dry-run` percorre exatamente o mesmo caminho do
modo real, revertendo no fim — simular por um caminho diferente seria simular
outra coisa.

A GUARDA DAS INTERAÇÕES NÃO MIGRADAS. `Venda` é a fonte única. Uma
`InteracaoCliente` do tipo "venda" que ainda não virou `Venda` representa
dinheiro que este comando NÃO vai contar — e que o cliente mostrava antes.
Então o comando conta quantas existem e, se houver, recusa-se a gravar:
`manage.py migrar_vendas` primeiro, este depois. A ordem importa, e errá-la
faz um total cair sem ninguém entender por quê. `--mesmo-assim` existe para
quem decidiu conscientemente que aquelas interações não são venda.
"""
import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from modules.auth.models import Empresa
from modules.clientes.models import Cliente, InteracaoCliente
from modules.clientes.repository import ClienteRepository


class _Simulacao(Exception):
    """Desfaz a transação do --dry-run. Não é erro; nunca escapa do handle."""


CAMPOS = [
    "valor_total_compras",
    "valor_recebido",
    "valor_a_receber",
    "quantidade_compras",
    "ultima_compra",
]


def _retrato(cliente: Cliente) -> tuple:
    return tuple(getattr(cliente, campo) for campo in CAMPOS)


class Command(BaseCommand):
    help = "Refaz os agregados de compra dos clientes a partir das vendas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra o que mudaria sem gravar nada.",
        )
        parser.add_argument(
            "--empresa",
            type=str,
            default=None,
            help="Recalcula só esta empresa (UUID).",
        )
        parser.add_argument(
            "--mesmo-assim",
            action="store_true",
            help=(
                "Grava mesmo havendo interações tipo=venda não migradas. "
                "Só com `migrar_vendas` já rodado ou decisão explícita."
            ),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        forcar = options["mesmo_assim"]
        empresa_id = options["empresa"]
        if empresa_id:
            try:
                empresa_id = uuid.UUID(str(empresa_id))
            except ValueError:
                raise CommandError(f"'{empresa_id}' não é um UUID de empresa válido.")
            if not Empresa.objects.filter(pk=empresa_id).exists():
                raise CommandError(f"Empresa {empresa_id} não existe.")

        if not self._checar_interacoes_pendentes(empresa_id, dry_run, forcar):
            return

        clientes = Cliente.objects.all().order_by("empresa_id", "nome")
        if empresa_id:
            clientes = clientes.filter(empresa_id=empresa_id)

        mudados: list[tuple] = []
        totais = {"antes": Decimal("0"), "depois": Decimal("0")}

        try:
            with transaction.atomic():
                for cliente in clientes.iterator():
                    antes = _retrato(cliente)
                    ClienteRepository.recalcular_agregados_cliente(cliente.pk)
                    cliente.refresh_from_db(fields=CAMPOS)
                    depois = _retrato(cliente)

                    totais["antes"] += antes[0]
                    totais["depois"] += depois[0]
                    if antes != depois:
                        mudados.append((cliente, antes, depois))

                if dry_run:
                    raise _Simulacao()
        except _Simulacao:
            pass

        self._relatar(clientes.count(), mudados, totais, dry_run)

    # ── A guarda ─────────────────────────────────────────────────────────────

    def _checar_interacoes_pendentes(self, empresa_id, dry_run, forcar) -> bool:
        """`False` manda parar sem gravar. Em --dry-run só avisa e segue."""
        pendentes = InteracaoCliente.objects.filter(
            tipo="venda", migrada_para_venda__isnull=True
        )
        if empresa_id:
            pendentes = pendentes.filter(empresa_id=empresa_id)

        quantas = pendentes.count()
        if not quantas:
            return True

        soma = sum(
            (i.valor or Decimal("0"))
            for i in pendentes.exclude(status_pagamento="cancelado").only("valor")
        )
        self.stdout.write(
            self.style.WARNING(
                f"\n{quantas} interação(ões) tipo=venda ainda NÃO migradas, "
                f"somando R$ {soma}."
            )
        )
        self.stdout.write(
            "Elas contavam nos agregados antigos e não contam neste recálculo:\n"
            "a fonte agora é Venda. Rode `manage.py migrar_vendas` antes, ou\n"
            "`--mesmo-assim` se decidiu que elas não são venda."
        )

        if forcar:
            self.stdout.write(self.style.WARNING("--mesmo-assim: seguindo.\n"))
            return True
        if dry_run:
            self.stdout.write(self.style.WARNING("Simulação: seguindo mesmo assim.\n"))
            return True

        self.stdout.write(self.style.ERROR("Nada foi gravado."))
        return False

    # ── Relatório ────────────────────────────────────────────────────────────

    def _relatar(self, total_clientes, mudados, totais, dry_run) -> None:
        verbo = "mudariam" if dry_run else "mudaram"

        self.stdout.write(
            self.style.MIGRATE_HEADING(f"\n{total_clientes} cliente(s) percorrido(s).")
        )
        if not mudados:
            self.stdout.write(
                self.style.SUCCESS("Nenhum agregado fora do lugar — nada a fazer.")
            )
        else:
            self.stdout.write(f"{len(mudados)} {verbo}:\n")
            for cliente, antes, depois in mudados:
                self.stdout.write(f"  {cliente.nome} · empresa {cliente.empresa_id}")
                for campo, a, d in zip(CAMPOS, antes, depois):
                    if a != d:
                        self.stdout.write(f"    {campo}: {a} → {d}")

        self.stdout.write(
            f"\nSoma de valor_total_compras — antes: R$ {totais['antes']}"
            f" · depois: R$ {totais['depois']}"
        )
        diferenca = totais["depois"] - totais["antes"]
        if diferenca:
            # Não é erro: é o dinheiro que estava invisível aparecendo (ou o
            # que uma interação não migrada deixou de contar). Mas é o número
            # que alguém precisa olhar antes de sair dizendo que deu certo.
            self.stdout.write(
                self.style.WARNING(f"Diferença: R$ {diferenca}. Confira se bate.")
            )

        if dry_run:
            self.stdout.write(self.style.WARNING("\nSimulação: nada foi gravado."))
