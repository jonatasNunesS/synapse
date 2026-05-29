# Checklist Final — Piloto Synapse ✅

Este documento atesta a conclusão de todas as correções de runtime e validações finais antes do lançamento do Piloto.

## 1. Correções de Runtime (Frontend)

| ID | Descrição | Status | Detalhes |
|---|---|---|---|
| **Bug A** | Erro `res.data.data` | ✅ Corrigido | Removidos os wrappers `ApiResponse<T>` redundantes em 7 hooks (`useEstoque`, `useFornecedores`, `useFinanceiro`, `useEquipe`, `useDocumentos`, `useNotificacoes`, `useProjetos`). O padrão agora é `api.get<T>` onde `T` é o tipo do dado interno. |
| **Bug B** | Categoria vazia no ProdutoForm | ✅ Corrigido | Implementado `Controller` do `react-hook-form` no select de categoria. Valores vazios (`""`) são convertidos para `null` antes do envio, evitando erro 400 no backend. |
| **Bug D** | ProjetoCard invisível no Dark Mode | ✅ Corrigido | Substituídas classes exclusivas do light mode (`bg-white`, `text-gray-900`) por equivalentes compatíveis com dark mode (`bg-[#0d1117]`, `text-white`, `border-white/10`). |
| **Bug E** | Falta do `ConvidarModal` | ✅ Corrigido | Criado o componente `ConvidarModal.tsx` e integrado à página `/equipe`. O modal envia o payload correto (`email`, `nome`, `cargo`, `permissoes`) para a API. |
| **Bug F** | Páginas 404 no Sidebar | ✅ Corrigido | Criadas as páginas `/perfil` (com formulário de troca de senha e atualização de dados) e `/configuracoes` (com dados da empresa e plano atual). |
| **Extra** | Gestão de Categorias de Estoque | ✅ Corrigido | Criado o `CategoriaEstoqueModal.tsx` e integrado à página `/estoque` através do botão "Categorias", permitindo CRUD completo. |

## 2. Correções de Backend e Infraestrutura

| ID | Descrição | Status | Detalhes |
|---|---|---|---|
| **Bug C** | Upload de Imagem do Produto | ✅ Corrigido | Adicionada a action `upload_imagem` no `ProdutoViewSet`. O endpoint `POST /api/estoque/produtos/{id}/upload-imagem/` aceita `multipart/form-data`, valida tipo (JPEG/PNG/WebP/GIF) e tamanho (max 5MB), e salva no `default_storage` (`/media/estoque/produtos/...`). |
| **Infra** | Validação `GROQ_API_KEY` | ✅ Corrigido | Adicionado um *guard* no `__init__` do `GroqClient`. Se a chave não estiver definida no `.env`, o sistema lança um `ValueError` claro imediatamente, em vez de falhar silenciosamente ou com erro genérico de autenticação na hora da geração. |
| **Infra** | Celery Beat Schedule | ✅ Verificado | Confirmado que todas as tasks agendadas no `celery.py` correspondem exatamente aos nomes registrados nos decorators `@shared_task(name="...")` de cada módulo. |

## 3. Status dos Testes

- **Backend (pytest):** 509/509 testes passando (100% de sucesso).
- **Frontend (tsc):** 0 erros de tipagem (`tsc --noEmit` executado com sucesso).

O sistema está estável, seguro e pronto para o Piloto Real. 🚀
