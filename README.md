# Orçamento familiar

App simples de controle financeiro no estilo YNAB (envelope budgeting), feito
para você e sua esposa lançarem despesas e acompanharem o orçamento mensal
pelo celular. Substitui o Google Forms + planilha por um app próprio.

**MVP atual:** sem contas bancárias separadas e sem campo "quem lançou" —
igual à sua planilha hoje. Dá para adicionar depois sem quebrar nada.

## Como funciona

- **Orçamento**: tela principal, mostra "pronto para orçar" e cada categoria
  agrupada (Immediate Obligations, Variable Expenses, True Expenses,
  Long-term Savings, Wish Farm). Toque no valor "Orçado" de uma categoria
  para editar quanto você quer atribuir a ela no mês.
- **+ Lançar**: formulário para registrar uma despesa (ou renda, escolhendo a
  categoria "💰 Renda").
- **Transações**: lista de todos os lançamentos, mais recentes primeiro.

## Passo a passo para colocar no ar

### 1. Criar o banco de dados (Supabase, gratuito)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. No painel do projeto, vá em **SQL Editor** → **New query**.
3. Cole todo o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql)
   deste projeto e clique em **Run**. Isso cria as tabelas e já popula com as
   suas categorias e o orçamento de setembro/2026, extraídos da sua planilha.
4. Vá em **Authentication → Users** e crie duas contas (uma para você, uma
   para sua esposa), com email e senha. É esse login que vocês vão usar no
   app — não precisa de nenhuma tela de "criar conta" pública.
5. Vá em **Project Settings → API** e anote dois valores: **Project URL** e
   a chave **anon public**. Você vai precisar deles nos próximos passos.

### 2. Colocar o código no GitHub

1. Crie um repositório novo no GitHub (pode ser privado).
2. Suba os arquivos deste projeto para o repositório (pelo site do GitHub,
   arrastando os arquivos, ou via `git push` se preferir linha de comando).

### 3. Configurar as chaves do Supabase como segredo do GitHub

1. No repositório, vá em **Settings → Secrets and variables → Actions**.
2. Clique em **New repository secret** e crie:
   - `VITE_SUPABASE_URL` → cole o Project URL do Supabase.
   - `VITE_SUPABASE_ANON_KEY` → cole a chave anon public do Supabase.

Isso mantém suas chaves fora do código público.

### 4. Ativar o GitHub Pages

1. No repositório, vá em **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Pronto — o workflow em `.github/workflows/deploy.yml` já está configurado
   para buildar e publicar o app automaticamente a cada `push` na branch
   `main`. Se o primeiro deploy não disparar sozinho, vá na aba **Actions**
   do repositório e rode o workflow "Deploy to GitHub Pages" manualmente.
4. Depois do primeiro deploy, o link do app aparece em **Settings → Pages**
   (algo como `https://seu-usuario.github.io/nome-do-repo/`).

### 5. Usar no celular

Abra o link do app no navegador do celular (seu e da sua esposa) e, no menu
do navegador, escolha **"Adicionar à tela inicial"**. Fica com cara de app,
sem precisar publicar em loja nenhuma.

## Rodando localmente (opcional, para testar antes de publicar)

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves do Supabase
npm run dev
```

## Próximos passos possíveis

- Separar lançamentos por conta (corrente, cartão, dinheiro).
- Registrar quem lançou cada transação (você / esposa).
- Editar e excluir transações já lançadas (hoje só é possível criar).
- Gráficos de gasto por categoria/mês.
