"""
Synapse — Script de Seed para o Piloto Real
Popula o banco com dados realistas de demonstração para uma empresa piloto.

Uso:
    python manage.py shell < scripts/seed_piloto.py
    # ou
    DJANGO_SETTINGS_MODULE=config.settings.development python scripts/seed_piloto.py

Dados criados:
    - 1 Empresa: "Loja Demo Synapse"
    - 1 Usuário admin: admin@synapse.demo / Synapse@2025
    - 5 Categorias financeiras
    - 15 Lançamentos financeiros (mix de receitas/despesas, pagos e pendentes)
    - 3 Categorias de estoque
    - 8 Produtos com movimentações
    - 6 Clientes em diferentes etapas do funil
    - 10 Interações com clientes
    - 3 Fornecedores
    - 2 Projetos com tarefas e comentários
    - 3 Membros de equipe com metas
    - 3 Documentos com versões
    - 5 Notificações
"""
import os
import sys
import django
from datetime import date, timedelta
from decimal import Decimal

# Configurar Django se executado diretamente
if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    django.setup()

from django.db import transaction

# ── Imports dos models ───────────────────────────────────────────────────────
from modules.auth.models import CustomUser, Empresa
from modules.financeiro.models import Categoria as CatFin, Lancamento
from modules.estoque.models import CategoriaEstoque, Produto
from modules.clientes.models import Cliente, InteracaoCliente
from modules.fornecedores.models import Fornecedor, CategoriaFornecedor
from modules.projetos.models import Projeto, Tarefa, Comentario
from modules.equipe.models import MembroEquipe, MetaMembro
from modules.documentos.models import Documento, VersaoDocumento
from modules.notificacoes.models import Notificacao

HOJE = date.today()


def seed():
    print("=" * 60)
    print("Synapse — Seed do Piloto Real")
    print("=" * 60)

    with transaction.atomic():
        # ── Empresa e Usuário Admin ──────────────────────────────
        empresa, criada = Empresa.objects.get_or_create(
            nome="Loja Demo Synapse",
            defaults={
                "cnpj": "12.345.678/0001-90",
                "segmento": "varejo",
                "plano": "pro",
            },
        )
        print(f"{'✓ Empresa criada' if criada else '→ Empresa já existe'}: {empresa.nome}")

        admin, criado = CustomUser.objects.get_or_create(
            email="admin@synapse.demo",
            defaults={
                "nome": "Admin Synapse",
                "empresa": empresa,
                "is_active": True,
                "perfil": "admin",
            },
        )
        if criado:
            admin.set_password("Synapse@2025")
            admin.save()
        print(f"{'✓ Admin criado' if criado else '→ Admin já existe'}: {admin.email}")

        # ── Categorias Financeiras ───────────────────────────────
        cats_fin = [
            {"nome": "Vendas", "tipo": "receita", "cor": "#22c55e"},
            {"nome": "Serviços", "tipo": "receita", "cor": "#3b82f6"},
            {"nome": "Aluguel", "tipo": "despesa", "cor": "#ef4444"},
            {"nome": "Fornecedores", "tipo": "despesa", "cor": "#f97316"},
            {"nome": "Marketing", "tipo": "despesa", "cor": "#a855f7"},
        ]
        categorias_fin = {}
        for c in cats_fin:
            obj, _ = CatFin.objects.get_or_create(
                empresa=empresa, nome=c["nome"],
                defaults={"tipo": c["tipo"], "cor": c["cor"]},
            )
            categorias_fin[c["nome"]] = obj
        print(f"✓ {len(categorias_fin)} categorias financeiras")

        # ── Lançamentos Financeiros ──────────────────────────────
        lancamentos_data = [
            # Receitas pagas
            {"descricao": "Venda de produtos - Semana 1", "tipo": "receita", "valor": Decimal("4500.00"), "status": "pago", "categoria": "Vendas", "dias": -20},
            {"descricao": "Venda de produtos - Semana 2", "tipo": "receita", "valor": Decimal("3800.00"), "status": "pago", "categoria": "Vendas", "dias": -13},
            {"descricao": "Consultoria mensal", "tipo": "receita", "valor": Decimal("2000.00"), "status": "pago", "categoria": "Serviços", "dias": -10},
            {"descricao": "Venda de produtos - Semana 3", "tipo": "receita", "valor": Decimal("5200.00"), "status": "pago", "categoria": "Vendas", "dias": -6},
            {"descricao": "Serviço de instalação", "tipo": "receita", "valor": Decimal("800.00"), "status": "pago", "categoria": "Serviços", "dias": -3},
            # Receitas pendentes
            {"descricao": "Venda de produtos - Semana 4", "tipo": "receita", "valor": Decimal("4100.00"), "status": "pendente", "categoria": "Vendas", "dias": 5},
            {"descricao": "Renovação de contrato", "tipo": "receita", "valor": Decimal("1500.00"), "status": "pendente", "categoria": "Serviços", "dias": 10},
            # Despesas pagas
            {"descricao": "Aluguel do mês", "tipo": "despesa", "valor": Decimal("2500.00"), "status": "pago", "categoria": "Aluguel", "dias": -15},
            {"descricao": "Compra de estoque", "tipo": "despesa", "valor": Decimal("3200.00"), "status": "pago", "categoria": "Fornecedores", "dias": -12},
            {"descricao": "Google Ads", "tipo": "despesa", "valor": Decimal("600.00"), "status": "pago", "categoria": "Marketing", "dias": -8},
            {"descricao": "Energia elétrica", "tipo": "despesa", "valor": Decimal("380.00"), "status": "pago", "categoria": "Aluguel", "dias": -5},
            # Despesas pendentes / atrasadas
            {"descricao": "Reposição de estoque", "tipo": "despesa", "valor": Decimal("1800.00"), "status": "pendente", "categoria": "Fornecedores", "dias": -2},
            {"descricao": "Instagram Ads", "tipo": "despesa", "valor": Decimal("400.00"), "status": "pendente", "categoria": "Marketing", "dias": 3},
            {"descricao": "Aluguel próximo mês", "tipo": "despesa", "valor": Decimal("2500.00"), "status": "pendente", "categoria": "Aluguel", "dias": 15},
            {"descricao": "Manutenção equipamentos", "tipo": "despesa", "valor": Decimal("750.00"), "status": "pendente", "categoria": "Fornecedores", "dias": 7},
        ]
        for l in lancamentos_data:
            data_venc = HOJE + timedelta(days=l["dias"])
            data_pag = data_venc if l["status"] == "pago" else None
            Lancamento.objects.get_or_create(
                empresa=empresa,
                descricao=l["descricao"],
                defaults={
                    "tipo": l["tipo"],
                    "valor": l["valor"],
                    "status": l["status"],
                    "categoria": categorias_fin[l["categoria"]],
                    "data_vencimento": data_venc,
                    "data_pagamento": data_pag,
                    "criado_por": admin,
                },
            )
        print(f"✓ {len(lancamentos_data)} lançamentos financeiros")

        # ── Categorias de Estoque ────────────────────────────────
        cats_est = [
            {"nome": "Eletrônicos", "descricao": "Produtos eletrônicos em geral"},
            {"nome": "Acessórios", "descricao": "Acessórios e periféricos"},
            {"nome": "Cabos e Adaptadores", "descricao": "Cabos, adaptadores e conectores"},
        ]
        categorias_est = {}
        for c in cats_est:
            obj, _ = CategoriaEstoque.objects.get_or_create(
                empresa=empresa, nome=c["nome"],
                defaults={"descricao": c["descricao"]},
            )
            categorias_est[c["nome"]] = obj
        print(f"✓ {len(categorias_est)} categorias de estoque")

        # ── Produtos ─────────────────────────────────────────────
        produtos_data = [
            {"nome": "Smartphone Samsung A54", "sku": "SAMS-A54-001", "preco_venda": Decimal("1299.90"), "preco_custo": Decimal("850.00"), "estoque_atual": 12, "estoque_minimo": 5, "categoria": "Eletrônicos"},
            {"nome": "Notebook Dell Inspiron 15", "sku": "DELL-INS15-001", "preco_venda": Decimal("3499.00"), "preco_custo": Decimal("2600.00"), "estoque_atual": 4, "estoque_minimo": 3, "categoria": "Eletrônicos"},
            {"nome": "Fone Bluetooth JBL", "sku": "JBL-BT-001", "preco_venda": Decimal("299.90"), "preco_custo": Decimal("180.00"), "estoque_atual": 25, "estoque_minimo": 10, "categoria": "Acessórios"},
            {"nome": "Capa para Smartphone", "sku": "CAPA-UNIV-001", "preco_venda": Decimal("49.90"), "preco_custo": Decimal("15.00"), "estoque_atual": 2, "estoque_minimo": 20, "categoria": "Acessórios"},
            {"nome": "Carregador USB-C 65W", "sku": "CARR-USBC-65W", "preco_venda": Decimal("89.90"), "preco_custo": Decimal("45.00"), "estoque_atual": 18, "estoque_minimo": 10, "categoria": "Cabos e Adaptadores"},
            {"nome": "Cabo HDMI 2m", "sku": "CABO-HDMI-2M", "preco_venda": Decimal("39.90"), "preco_custo": Decimal("12.00"), "estoque_atual": 30, "estoque_minimo": 15, "categoria": "Cabos e Adaptadores"},
            {"nome": "Mouse Sem Fio Logitech", "sku": "LOG-MOUSE-001", "preco_venda": Decimal("149.90"), "preco_custo": Decimal("90.00"), "estoque_atual": 8, "estoque_minimo": 5, "categoria": "Acessórios"},
            {"nome": "Teclado Mecânico Redragon", "sku": "RED-TEC-001", "preco_venda": Decimal("249.90"), "preco_custo": Decimal("150.00"), "estoque_atual": 1, "estoque_minimo": 5, "categoria": "Acessórios"},
        ]
        produtos = {}
        for p in produtos_data:
            obj, criado = Produto.objects.get_or_create(
                empresa=empresa, sku=p["sku"],
                defaults={
                    "nome": p["nome"],
                    "preco_venda": p["preco_venda"],
                    "preco_custo": p["preco_custo"],
                    "estoque_atual": p["estoque_atual"],
                    "estoque_minimo": p["estoque_minimo"],
                    "categoria": categorias_est[p["categoria"]],
                    "ativo": True,
                },
            )
            produtos[p["sku"]] = obj
        print(f"✓ {len(produtos)} produtos")

        # ── Clientes ─────────────────────────────────────────────
        clientes_data = [
            {"nome": "Carlos Eduardo Silva", "email": "carlos@empresa.com", "telefone": "(11) 98765-4321", "status_funil": "fechado", "segmento": "varejo"},
            {"nome": "Ana Paula Ferreira", "email": "ana@startup.io", "telefone": "(21) 97654-3210", "status_funil": "proposta", "segmento": "tecnologia"},
            {"nome": "Roberto Mendes", "email": "roberto@construtora.com", "telefone": "(31) 96543-2109", "status_funil": "negociacao", "segmento": "construção"},
            {"nome": "Juliana Costa", "email": "juliana@moda.com", "telefone": "(41) 95432-1098", "status_funil": "lead", "segmento": "moda"},
            {"nome": "Marcos Oliveira", "email": "marcos@logistica.com", "telefone": "(51) 94321-0987", "status_funil": "contato", "segmento": "logística"},
            {"nome": "Fernanda Lima", "email": "fernanda@saude.com", "telefone": "(61) 93210-9876", "status_funil": "fechado", "segmento": "saúde"},
        ]
        clientes = []
        for c in clientes_data:
            obj, _ = Cliente.objects.get_or_create(
                empresa=empresa, email=c["email"],
                defaults={
                    "nome": c["nome"],
                    "telefone": c["telefone"],
                    "status_funil": c["status_funil"],
                    "segmento": c["segmento"],
                    "ativo": True,
                    "criado_por": admin,
                },
            )
            clientes.append(obj)
        print(f"✓ {len(clientes)} clientes")

        # ── Interações com Clientes ───────────────────────────────
        interacoes = [
            (clientes[0], "reuniao", "Reunião de alinhamento sobre próximo pedido"),
            (clientes[0], "email", "Envio de catálogo de novos produtos"),
            (clientes[1], "ligacao", "Apresentação da proposta comercial"),
            (clientes[1], "email", "Follow-up da proposta enviada"),
            (clientes[2], "reuniao", "Negociação de desconto para pedido em volume"),
            (clientes[3], "ligacao", "Primeiro contato - demonstração de interesse"),
            (clientes[4], "email", "Envio de material informativo"),
            (clientes[5], "reuniao", "Revisão de contrato anual"),
            (clientes[5], "ligacao", "Suporte técnico pós-venda"),
            (clientes[2], "email", "Envio de contrato revisado"),
        ]
        for cliente, tipo, descricao in interacoes:
            InteracaoCliente.objects.get_or_create(
                empresa=empresa,
                cliente=cliente,
                descricao=descricao,
                defaults={
                    "tipo": tipo,
                    "data_interacao": HOJE - timedelta(days=interacoes.index((cliente, tipo, descricao))),
                    "criado_por": admin,
                },
            )
        print(f"✓ {len(interacoes)} interações com clientes")

        # ── Categorias de Fornecedores ────────────────────────────
        cats_forn = [
            {"nome": "Eletrônicos", "cor": "#3b82f6"},
            {"nome": "Acessórios", "cor": "#8b5cf6"},
            {"nome": "Cabos e Conectores", "cor": "#22c55e"},
        ]
        categorias_forn = {}
        for c in cats_forn:
            obj, _ = CategoriaFornecedor.objects.get_or_create(
                empresa=empresa, nome=c["nome"],
                defaults={"cor": c["cor"]},
            )
            categorias_forn[c["nome"]] = obj

        # ── Fornecedores ─────────────────────────────────────────
        fornecedores_data = [
            {"nome": "TechDistrib Ltda", "email": "compras@techdistrib.com", "telefone": "(11) 3333-4444", "cnpj": "11.222.333/0001-44", "categoria": "Eletrônicos"},
            {"nome": "Acessórios Brasil", "email": "vendas@acessoriosbr.com", "telefone": "(21) 4444-5555", "cnpj": "22.333.444/0001-55", "categoria": "Acessórios"},
            {"nome": "Cabos & Cia", "email": "pedidos@cabosecia.com", "telefone": "(31) 5555-6666", "cnpj": "33.444.555/0001-66", "categoria": "Cabos e Conectores"},
        ]
        for f in fornecedores_data:
            Fornecedor.objects.get_or_create(
                empresa=empresa, cnpj=f["cnpj"],
                defaults={
                    "nome": f["nome"],
                    "email": f["email"],
                    "telefone": f["telefone"],
                    "categoria": categorias_forn[f["categoria"]],
                    "ativo": True,
                    "criado_por": admin,
                },
            )
        print(f"✓ {len(fornecedores_data)} fornecedores")

        # ── Projetos e Tarefas ───────────────────────────────────
        projeto1, _ = Projeto.objects.get_or_create(
            empresa=empresa,
            nome="Lançamento Linha Premium",
            defaults={
                "descricao": "Preparação e lançamento da nova linha de produtos premium para o próximo trimestre.",
                "status": "em_andamento",
                "prioridade": "alta",
                "data_inicio": HOJE - timedelta(days=15),
                "data_prazo": HOJE + timedelta(days=45),
                "responsavel": admin,
                "criado_por": admin,
            },
        )
        projeto2, _ = Projeto.objects.get_or_create(
            empresa=empresa,
            nome="Migração do Sistema de PDV",
            defaults={
                "descricao": "Migração do sistema de ponto de venda para nova plataforma integrada.",
                "status": "planejamento",
                "prioridade": "media",
                "data_inicio": HOJE + timedelta(days=5),
                "data_prazo": HOJE + timedelta(days=60),
                "responsavel": admin,
                "criado_por": admin,
            },
        )

        tarefas_p1 = [
            ("Pesquisa de mercado", "concluido", "alta", -10),
            ("Definir mix de produtos", "concluido", "alta", -5),
            ("Negociar com fornecedores", "em_andamento", "alta", 10),
            ("Criar materiais de marketing", "em_andamento", "media", 15),
            ("Treinamento da equipe de vendas", "a_fazer", "media", 30),
            ("Lançamento oficial", "a_fazer", "alta", 45),
        ]
        for titulo, status, prioridade, dias in tarefas_p1:
            t, criada = Tarefa.objects.get_or_create(
                projeto=projeto1,
                titulo=titulo,
                defaults={
                    "empresa": empresa,
                    "status": status,
                    "prioridade": prioridade,
                    "data_prazo": HOJE + timedelta(days=dias),
                    "responsavel": admin,
                    "criado_por": admin,
                },
            )
            if criada and status == "concluido":
                Comentario.objects.create(
                    tarefa=t,
                    empresa=empresa,
                    autor=admin,
                    texto=f"Tarefa '{titulo}' concluída com sucesso.",
                )

        tarefas_p2 = [
            ("Levantamento de requisitos", "a_fazer", "alta", 10),
            ("Avaliação de fornecedores de PDV", "a_fazer", "media", 20),
            ("Plano de migração de dados", "a_fazer", "alta", 35),
        ]
        for titulo, status, prioridade, dias in tarefas_p2:
            Tarefa.objects.get_or_create(
                projeto=projeto2,
                titulo=titulo,
                defaults={
                    "empresa": empresa,
                    "status": status,
                    "prioridade": prioridade,
                    "data_prazo": HOJE + timedelta(days=dias),
                    "responsavel": admin,
                    "criado_por": admin,
                },
            )
        print(f"✓ 2 projetos com {len(tarefas_p1) + len(tarefas_p2)} tarefas")

        # ── Membros de Equipe ────────────────────────────────────
        membros_data = [
            {"nome": "Maria Santos", "email": "maria@synapse.demo", "cargo": "Gerente de Vendas", "departamento": "Comercial"},
            {"nome": "João Pereira", "email": "joao@synapse.demo", "cargo": "Analista de Estoque", "departamento": "Operações"},
            {"nome": "Lucia Alves", "email": "lucia@synapse.demo", "cargo": "Designer", "departamento": "Marketing"},
        ]
        membros = []
        for m in membros_data:
            usuario, _ = CustomUser.objects.get_or_create(
                email=m["email"],
                defaults={
                    "nome": m["nome"],
                    "empresa": empresa,
                    "is_active": True,
                    "perfil": "colaborador",
                },
            )
            if _:
                usuario.set_password("Synapse@2025")
                usuario.save()
            membro, _ = MembroEquipe.objects.get_or_create(
                empresa=empresa,
                usuario=usuario,
                defaults={
                    "cargo": m["cargo"],
                    "departamento": m["departamento"],
                    "ativo": True,
                },
            )
            membros.append(membro)

        # Metas para o primeiro membro
        if membros:
            MetaMembro.objects.get_or_create(
                membro=membros[0],
                empresa=empresa,
                titulo="Atingir R$ 50.000 em vendas no mês",
                defaults={
                    "descricao": "Meta mensal de vendas para o time comercial.",
                    "tipo": "vendas",
                    "valor_meta": Decimal("50000.00"),
                    "valor_atual": Decimal("32000.00"),
                    "periodo": "mensal",
                    "data_inicio": HOJE,
                    "data_fim": HOJE + timedelta(days=30),
                },
            )
        print(f"✓ {len(membros)} membros de equipe")

        # ── Documentos ───────────────────────────────────────────
        docs_data = [
            {"titulo": "Manual de Procedimentos de Vendas", "tipo": "manual", "conteudo": "# Manual de Vendas\n\nEste documento descreve os procedimentos padrão para a equipe de vendas..."},
            {"titulo": "Política de Devolução e Troca", "tipo": "politica", "conteudo": "# Política de Devolução\n\nNossa política de devolução segue o Código de Defesa do Consumidor..."},
            {"titulo": "Contrato Padrão de Fornecimento", "tipo": "contrato", "conteudo": "# Contrato de Fornecimento\n\nEntre as partes: Loja Demo Synapse (Contratante) e Fornecedor (Contratado)..."},
        ]
        for d in docs_data:
            doc, criado = Documento.objects.get_or_create(
                empresa=empresa,
                titulo=d["titulo"],
                defaults={
                    "tipo": d["tipo"],
                    "descricao": d["conteudo"][:255],
                    "criado_por": admin,
                    "status": "aprovado",
                },
            )
            if criado:
                VersaoDocumento.objects.create(
                    documento=doc,
                    empresa=empresa,
                    notas=d["conteudo"][:500],
                    numero_versao=1,
                    criado_por=admin,
                )
        print(f"✓ {len(docs_data)} documentos")

        # ── Notificações ─────────────────────────────────────────
        notifs = [
            {"titulo": "Estoque crítico: Capa para Smartphone", "mensagem": "O produto 'Capa para Smartphone' está com estoque abaixo do mínimo (2 unidades, mínimo: 20).", "tipo": "alerta_estoque", "prioridade": "alta"},
            {"titulo": "Lançamento vencido: Reposição de estoque", "mensagem": "O lançamento 'Reposição de estoque' de R$ 1.800,00 está vencido há 2 dias.", "tipo": "vencimento", "prioridade": "alta"},
            {"titulo": "Tarefa vencendo: Negociar com fornecedores", "mensagem": "A tarefa 'Negociar com fornecedores' vence em 10 dias.", "tipo": "prazo_tarefa", "prioridade": "media"},
            {"titulo": "Follow-up pendente: Ana Paula Ferreira", "mensagem": "O cliente Ana Paula Ferreira está aguardando retorno sobre a proposta há 3 dias.", "tipo": "followup_cliente", "prioridade": "media"},
            {"titulo": "Bem-vindo ao Synapse!", "mensagem": "Sua conta foi configurada com sucesso. Explore todos os módulos disponíveis.", "tipo": "sistema", "prioridade": "baixa"},
        ]
        for n in notifs:
            Notificacao.objects.get_or_create(
                empresa=empresa,
                titulo=n["titulo"],
                defaults={
                    "mensagem": n["mensagem"],
                    "tipo": n["tipo"],
                    "prioridade": n["prioridade"],
                    "lida": False,
                    "usuario": admin,
                },
            )
        print(f"✓ {len(notifs)} notificações")

    print()
    print("=" * 60)
    print("✅ Seed do Piloto concluído com sucesso!")
    print()
    print("Credenciais de acesso:")
    print("  URL:   http://localhost:3000")
    print("  Email: admin@synapse.demo")
    print("  Senha: Synapse@2025")
    print("=" * 60)


if __name__ == "__main__":
    seed()
