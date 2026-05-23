"""
Synapse — M7: Módulo Equipe
Models MembroEquipe e MetaMembro com multi-tenant obrigatório.
"""
import uuid
from django.db import models


class MembroEquipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="membros_equipe",
    )
    usuario = models.ForeignKey(
        "synapse_auth.CustomUser",
        on_delete=models.CASCADE,
        related_name="membros_equipe",
    )
    cargo = models.CharField(max_length=100, blank=True)
    departamento = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    data_entrada = models.DateField(null=True, blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "equipe_membros"
        unique_together = [("empresa", "usuario")]
        indexes = [
            models.Index(fields=["empresa", "ativo"], name="equipe_emp_ativo_idx"),
            models.Index(fields=["usuario", "ativo"], name="equipe_usr_ativo_idx"),
        ]
        verbose_name = "Membro da Equipe"
        verbose_name_plural = "Membros da Equipe"

    def __str__(self):
        return f"{self.usuario} @ {self.empresa}"

    @property
    def nome(self):
        return self.usuario.nome

    @property
    def email(self):
        return self.usuario.email

    @property
    def perfil(self):
        return self.usuario.perfil

    @property
    def total_tarefas_abertas(self):
        from modules.projetos.models import Tarefa
        return Tarefa.objects.filter(
            responsavel=self.usuario,
            empresa=self.empresa,
            status__in=["backlog", "a_fazer", "em_progresso"],
        ).count()

    @property
    def total_projetos(self):
        from modules.projetos.models import Projeto
        return Projeto.objects.filter(
            responsavel=self.usuario,
            empresa=self.empresa,
            status__in=["planejamento", "em_andamento"],
        ).count()

    @property
    def progresso_meta_atual(self):
        from django.utils import timezone
        hoje = timezone.now().date()
        meta = self.metas.filter(
            data_inicio__lte=hoje,
            data_fim__gte=hoje,
        ).order_by("-criado_em").first()
        if meta and meta.valor_meta:
            return round(float(meta.valor_atual) / float(meta.valor_meta) * 100, 1)
        return 0.0


class MetaMembro(models.Model):
    TIPO_CHOICES = [
        ("vendas", "Vendas"),
        ("tarefas", "Tarefas"),
        ("clientes", "Clientes"),
        ("projetos", "Projetos"),
        ("outro", "Outro"),
    ]

    PERIODO_CHOICES = [
        ("semanal", "Semanal"),
        ("mensal", "Mensal"),
        ("trimestral", "Trimestral"),
        ("anual", "Anual"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membro = models.ForeignKey(
        MembroEquipe,
        on_delete=models.CASCADE,
        related_name="metas",
    )
    empresa = models.ForeignKey(
        "synapse_auth.Empresa",
        on_delete=models.CASCADE,
        related_name="metas_equipe",
    )
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="outro")
    valor_meta = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    valor_atual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    periodo = models.CharField(max_length=15, choices=PERIODO_CHOICES, default="mensal")
    data_inicio = models.DateField()
    data_fim = models.DateField()
    atingida = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "equipe_metas"
        ordering = ["-criado_em"]
        verbose_name = "Meta do Membro"
        verbose_name_plural = "Metas dos Membros"

    def __str__(self):
        return f"{self.titulo} — {self.membro}"

    @property
    def progresso_percentual(self):
        if self.valor_meta and float(self.valor_meta) > 0:
            return round(float(self.valor_atual) / float(self.valor_meta) * 100, 1)
        return 0.0
