"""
Synapse — Módulo Agenda: Models
Evento de calendário com multi-tenant obrigatório (empresa_id) e vínculo
opcional com um Cliente do CRM.
"""
import uuid

from django.db import models

# Antecedência do lembrete, em MINUTOS antes do início do evento.
# Zero é o default: quem não pediu lembrete não recebe lembrete.
SEM_LEMBRETE = 0
LEMBRETE_CHOICES = [
    (SEM_LEMBRETE, "Sem lembrete"),
    (10, "10 minutos antes"),
    (30, "30 minutos antes"),
    (60, "1 hora antes"),
    (1440, "1 dia antes"),
]

# A maior antecedência oferecida — a task usa para limitar a janela que varre.
MAIOR_ANTECEDENCIA_MIN = max(minutos for minutos, _ in LEMBRETE_CHOICES)

# A cor de quem não escolheu nada. É também o primeiro item do seletor no
# front, o que quer dizer que a maioria dos eventos antigos está nela.
COR_PADRAO = "#6D28D9"


def normalizar_dia_inteiro(data_inicio, data_fim):
    """
    Dia inteiro é 00:00 → 23:59:59, no fuso da empresa.

    Sem isto o campo mente: marcar "dia inteiro" num evento das 14h às 15h
    guardava 14h–15h, o calendário desenhava na faixa de dia inteiro e o
    detalhe imprimia "Dia inteiro" escondendo a hora que estava lá.

    O corte é no fuso LOCAL (America/Sao_Paulo), não em UTC: "o dia todo" é o
    dia de quem marcou, e usar UTC deslocaria as bordas em três horas.
    """
    from django.utils import timezone

    inicio = timezone.localtime(data_inicio).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    fim = timezone.localtime(data_fim).replace(
        hour=23, minute=59, second=59, microsecond=0
    )
    return inicio, fim


class CategoriaEvento(models.Model):
    """
    Categoria de evento criada pela empresa — é ela que dá NOME à cor.

    Antes, o evento escolhia entre 10 cores livres sem legenda em lugar nenhum:
    duas semanas depois ninguém lembrava por que aquele compromisso era laranja
    (AGENDA_AUDIT, item 5). Agora laranja é "Cobrança" ou "Entrega", e a tela
    mostra a legenda.

    Desativar OCULTA, não apaga — mesma filosofia dos módulos opcionais. Os
    eventos mantêm o vínculo e continuam pegando a cor daqui; a categoria só
    para de aparecer como opção para novos eventos.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="categorias_evento",
        db_index=True,
    )
    nome = models.CharField(max_length=60)
    cor = models.CharField(max_length=7, default=COR_PADRAO)
    ativo = models.BooleanField(default=True)
    # Para a legenda sair na ordem que a empresa acha útil, não alfabética.
    ordem = models.PositiveSmallIntegerField(default=0)

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_agenda"
        verbose_name = "Categoria de evento"
        verbose_name_plural = "Categorias de evento"
        ordering = ["ordem", "nome"]
        constraints = [
            # Duas "Reunião" na mesma empresa é erro de digitação, não escolha.
            models.UniqueConstraint(
                fields=["empresa", "nome"], name="categoria_evento_nome_unico_por_empresa"
            ),
        ]
        indexes = [models.Index(fields=["empresa", "ativo"])]

    def __str__(self) -> str:
        return self.nome


class Evento(models.Model):
    """Evento da agenda. Pode existir sem cliente; se tiver, linka ao CRM."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="eventos_agenda",
        db_index=True,
    )
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, default="")
    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField()
    dia_inteiro = models.BooleanField(default=False)
    local = models.CharField(max_length=255, blank=True, default="")
    # Cor livre, de antes das categorias. Continua sendo o FALLBACK de quem
    # não tem categoria; o formulário não a escreve mais.
    cor = models.CharField(max_length=7, default=COR_PADRAO)

    # Vínculo opcional com o CRM — evento pode existir sem cliente
    cliente = models.ForeignKey(
        "synapse_clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_agenda",
    )

    # ── Categoria ────────────────────────────────────────────────────────
    # Quando existe, é ela quem define a cor exibida (ver `cor_efetiva`).
    # Nulável de propósito: evento pode não ter categoria, e TODOS os eventos
    # criados antes desta mudança chegam aqui com null — eles seguem exibindo
    # a cor que já tinham, sem categoria inventada.
    categoria = models.ForeignKey(
        "synapse_agenda.CategoriaEvento",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos",
    )

    # ── Lembrete ─────────────────────────────────────────────────────────
    # Quanto antes avisar. Sem isto a agenda só guarda; com isto ela procura
    # a pessoa (sino + e-mail), que é o motivo de existir de uma agenda.
    lembrete_antecedencia = models.PositiveIntegerField(
        choices=LEMBRETE_CHOICES,
        default=SEM_LEMBRETE,
        help_text="Minutos antes do início para avisar. 0 = sem lembrete.",
    )
    # Guarda de idempotência: o lembrete deste evento JÁ FOI PROCESSADO — a
    # task não volta nele. Também fica True quando não havia a quem avisar,
    # senão o evento seria varrido de novo a cada rodada até passar a hora.
    # Remarcar o evento ou trocar a antecedência zera a guarda (ver o Service).
    lembrete_enviado = models.BooleanField(default=False)

    criado_por = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "synapse_agenda"
        verbose_name = "Evento"
        verbose_name_plural = "Eventos"
        ordering = ["data_inicio"]
        indexes = [
            models.Index(fields=["empresa", "data_inicio"]),
            models.Index(fields=["empresa", "data_fim"]),
            # A varredura do lembrete roda a cada 5 min e atravessa todas as
            # empresas: o índice é por (pendente, quando começa), não por empresa.
            models.Index(fields=["lembrete_enviado", "data_inicio"]),
        ]

    def save(self, *args, **kwargs):
        """
        A normalização do dia inteiro mora aqui, e não na view, porque o evento
        nasce por mais de um caminho: a API, o follow-up do CRM, o admin e o
        shell. Confiar só no formulário deixaria os outros três mentindo.
        """
        if self.dia_inteiro and self.data_inicio and self.data_fim:
            self.data_inicio, self.data_fim = normalizar_dia_inteiro(
                self.data_inicio, self.data_fim
            )
        super().save(*args, **kwargs)

    @property
    def cor_efetiva(self) -> str:
        """
        A cor que a tela deve pintar. REGRA ÚNICA, num só lugar.

        Tem categoria? A cor é dela — é o que dá significado ao colorido. Não
        tem? Cai no campo `cor` do próprio evento, que é como os eventos
        anteriores às categorias continuam exatamente com a aparência que
        tinham. Serializer e dashboard leem daqui; nenhum dos dois recalcula.
        """
        if self.categoria_id and self.categoria and self.categoria.cor:
            return self.categoria.cor
        return self.cor or COR_PADRAO

    def __str__(self) -> str:
        return f"{self.titulo} ({self.data_inicio:%d/%m/%Y %H:%M})"
