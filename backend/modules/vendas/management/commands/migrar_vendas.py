"""
Synapse — Comando: migrar as vendas antigas para a entidade Venda.

Antes da fase 1, uma venda era uma InteracaoCliente do tipo "venda": um
registro só, com um valor único. A fase 1 criou Venda + ItemVenda; esta é a
fase 2, que COPIA as interações antigas para o modelo novo.

    python manage.py migrar_vendas --dry-run
    python manage.py migrar_vendas
    python manage.py migrar_vendas --empresa=<uuid>

REGRA DE OURO: nada é apagado. A interação original permanece intacta; o
vínculo `migrada_para_venda` liga a antiga à nova para os dois lados serem
auditáveis. Rodar de novo não duplica — quem já tem o vínculo é pulado.

O DINHEIRO É O QUE MANDA. A soma dos valores das interações tem que bater ao
centavo com a soma dos totais das vendas criadas, por empresa. É a prova de
que a migração não perdeu nem inventou dinheiro, e é por isso que o valor da
interação — não o preço da movimentação — é a autoridade sobre o total.
"""
import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from modules.clientes.models import InteracaoCliente
from modules.vendas.models import ItemVenda, Venda

# Status da interação que a Venda não tem. Viram "pendente" — o mais
# conservador dos dois que existem — e o original fica escrito na observação,
# porque "cancelado" é informação real que não pode simplesmente sumir.
STATUS_SEM_EQUIVALENTE = {"cancelado", "nao_se_aplica"}


class Resultado:
    """Contagens de uma passada, para o relatório."""

    def __init__(self):
        self.classe_a = 0
        self.classe_b = 0
        self.status_convertido = 0
        self.valor_antes = Decimal("0")
        self.valor_depois = Decimal("0")
        self.puladas: dict[str, int] = {}

    @property
    def migradas(self) -> int:
        return self.classe_a + self.classe_b

    def pular(self, motivo: str) -> None:
        self.puladas[motivo] = self.puladas.get(motivo, 0) + 1


class Command(BaseCommand):
    help = "Copia as vendas antigas (InteracaoCliente tipo=venda) para Venda."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra o que seria migrado sem gravar nada.",
        )
        parser.add_argument(
            "--empresa",
            type=str,
            default=None,
            help="Migra só esta empresa (UUID). Útil para conferir numa antes de todas.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        empresa_id = options["empresa"]
        if empresa_id:
            try:
                empresa_id = uuid.UUID(str(empresa_id))
            except ValueError:
                raise CommandError(f"'{empresa_id}' não é um UUID de empresa válido.")

        pendentes = (
            InteracaoCliente.objects.filter(tipo="venda", migrada_para_venda__isnull=True)
            .select_related("cliente", "movimentacao_estoque__produto")
            .order_by("empresa_id", "data_interacao")
        )
        if empresa_id:
            pendentes = pendentes.filter(empresa_id=empresa_id)

        ja_migradas = InteracaoCliente.objects.filter(
            tipo="venda", migrada_para_venda__isnull=False
        )
        if empresa_id:
            ja_migradas = ja_migradas.filter(empresa_id=empresa_id)
        total_ja_migradas = ja_migradas.count()

        if dry_run:
            self.stdout.write(self.style.WARNING("MODO SIMULAÇÃO — nada será gravado.\n"))

        por_empresa: dict[str, Resultado] = {}
        # O rollback do dry-run tem que envolver a passada inteira: é o que
        # garante que simular e executar percorrem exatamente o mesmo código,
        # em vez de haver um caminho "de mentira" que ninguém testa de verdade.
        try:
            with transaction.atomic():
                for interacao in pendentes.iterator():
                    chave = str(interacao.empresa_id)
                    resultado = por_empresa.setdefault(chave, Resultado())
                    self._migrar(interacao, resultado)
                if dry_run:
                    raise _Simulacao()
        except _Simulacao:
            pass

        self._relatar(por_empresa, total_ja_migradas, dry_run)

    # ── Uma interação ────────────────────────────────────────────────────────

    def _migrar(self, interacao: InteracaoCliente, resultado: Resultado) -> None:
        # Sem valor não há o que migrar: criar uma venda de R$ 0 inventaria um
        # número que a interação nunca teve. Fica para trás, intacta e visível
        # no relatório.
        if interacao.valor is None:
            resultado.pular("sem valor")
            return

        valor = interacao.valor
        movimentacao = interacao.movimentacao_estoque
        rastro: list[str] = []

        status = interacao.status_pagamento
        if status in STATUS_SEM_EQUIVALENTE:
            rastro.append(f"[migrado de status: {status}]")
            status = "pendente"
            resultado.status_convertido += 1

        venda = Venda(
            empresa_id=interacao.empresa_id,
            cliente_id=interacao.cliente_id,
            data_venda=timezone.localtime(interacao.data_interacao).date(),
            desconto=Decimal("0"),
            status_pagamento=status,
            data_prevista_pagamento=interacao.data_prevista_pagamento,
            lancamento_financeiro_id=interacao.lancamento_financeiro_id,
            criado_por_id=interacao.criado_por_id,
        )
        venda.save()

        # Sem título a linha livre ficaria sem nome nenhum — e o model recusa,
        # com razão: uma linha que não diz o que é ainda soma ao total.
        nome_livre = (interacao.titulo or "").strip() or "Venda migrada"
        item, desconto, rastro_item = self._reconstruir_item(movimentacao, valor, nome_livre)
        rastro.extend(rastro_item)
        if item["produto"] is not None:
            resultado.classe_a += 1
        else:
            resultado.classe_b += 1

        ItemVenda.objects.create(
            venda=venda,
            empresa_id=interacao.empresa_id,
            produto=item["produto"],
            descricao=item["descricao"],
            quantidade=item["quantidade"],
            preco_unitario=item["preco_unitario"],
        )

        venda.desconto = desconto
        venda.observacoes = self._observacoes(interacao, rastro)
        venda.save(update_fields=["desconto", "observacoes", "atualizado_em"])
        venda.recalcular_totais()

        # criado_em é auto_now_add: só um update direto no banco escreve a data
        # original. Sem isso toda venda migrada nasceria "criada hoje", e a
        # ordem cronológica do histórico se perderia.
        Venda.objects.filter(pk=venda.pk).update(criado_em=interacao.criado_em)

        InteracaoCliente.objects.filter(pk=interacao.pk).update(migrada_para_venda=venda)

        resultado.valor_antes += valor
        venda.refresh_from_db()
        resultado.valor_depois += venda.total

    # ── O item ───────────────────────────────────────────────────────────────

    def _reconstruir_item(self, movimentacao, valor: Decimal, nome_livre: str):
        """
        Devolve (item, desconto_da_venda, rastro).

        CLASSE A — a interação tem movimentação de estoque: o produto, a
        quantidade e o preço praticado estão lá, e são recuperados. Mas a
        movimentação guarda desconto em PERCENTUAL e a Venda em reais; as duas
        semânticas não se convertem uma na outra. Então o percentual original
        vai para a observação como rastro, e o desconto da venda é a diferença
        OBSERVADA entre o que os itens somam e o que a interação de fato
        cobrou. Não é o percentual convertido: é o que sobra da conta, e é o
        que faz o total bater ao centavo com o valor antigo.

        CLASSE B — sem movimentação (ou com uma que não fecha com o valor
        cobrado): uma linha livre, sem produto, com o valor inteiro. Perder o
        vínculo com o produto é ruim; inventar um produto no catálogo de
        estoque para a venda velha caber seria pior.
        """
        rastro: list[str] = []

        if movimentacao and movimentacao.preco_unitario is not None:
            quantidade = movimentacao.quantidade
            preco = movimentacao.preco_unitario
            subtotal = quantidade * preco
            # subtotal menor que o cobrado não cabe: a Venda não tem acréscimo,
            # só desconto. Nesse caso o produto vira rastro e o valor vai
            # inteiro na linha livre — o dinheiro não pode ser arredondado.
            if subtotal >= valor:
                if movimentacao.desconto:
                    rastro.append(f"[desconto original: {movimentacao.desconto}%]")
                return (
                    {
                        "produto": movimentacao.produto,
                        "descricao": "",
                        "quantidade": quantidade,
                        "preco_unitario": preco,
                    },
                    subtotal - valor,
                    rastro,
                )
            rastro.append(
                f"[movimentação original: {movimentacao.produto.nome}, "
                f"{quantidade} × R$ {preco}]"
            )
        elif movimentacao:
            rastro.append(
                f"[movimentação original sem preço: {movimentacao.produto.nome}, "
                f"{movimentacao.quantidade}]"
            )

        return (
            {
                "produto": None,
                "descricao": nome_livre,
                "quantidade": Decimal("1"),
                "preco_unitario": valor,
            },
            Decimal("0"),
            rastro,
        )

    def _observacoes(self, interacao: InteracaoCliente, rastro: list[str]) -> str:
        partes = [p for p in (interacao.titulo, interacao.descricao) if p]
        texto = "\n\n".join(partes)
        if rastro:
            texto = f"{texto}\n\n{' '.join(rastro)}" if texto else " ".join(rastro)
        return texto

    # ── Relatório ────────────────────────────────────────────────────────────

    def _relatar(self, por_empresa: dict, total_ja_migradas: int, dry_run: bool) -> None:
        verbo = "seriam migradas" if dry_run else "migradas"

        if not por_empresa:
            self.stdout.write("Nenhuma venda antiga pendente de migração.")
        for empresa_id, r in por_empresa.items():
            self.stdout.write(self.style.MIGRATE_HEADING(f"\nEmpresa {empresa_id}"))
            self.stdout.write(f"  {r.migradas} vendas {verbo}")
            if r.migradas:
                self.stdout.write(f"    classe A (produto reconstruído): {r.classe_a}")
                self.stdout.write(f"    classe B (item livre):           {r.classe_b}")
                self.stdout.write(f"    status convertido:               {r.status_convertido}")
                self.stdout.write(f"  Total R$ antes:  {r.valor_antes}")
                self.stdout.write(f"  Total R$ depois: {r.valor_depois}")
                if r.valor_antes == r.valor_depois:
                    self.stdout.write(self.style.SUCCESS("  Os totais batem."))
                else:
                    # Não deveria acontecer nunca. Se acontecer, é para aparecer.
                    self.stdout.write(
                        self.style.ERROR(
                            f"  OS TOTAIS NÃO BATEM — diferença de "
                            f"R$ {r.valor_depois - r.valor_antes}"
                        )
                    )
            for motivo, quantas in sorted(r.puladas.items()):
                self.stdout.write(self.style.WARNING(f"  {quantas} pulada(s): {motivo}"))

        if total_ja_migradas:
            self.stdout.write(
                f"\n{total_ja_migradas} já migrada(s) anteriormente — não tocadas."
            )
        if dry_run:
            self.stdout.write(self.style.WARNING("\nSimulação: nada foi gravado."))


class _Simulacao(Exception):
    """Desfaz a transação do --dry-run. Não é erro; nunca escapa do handle."""
