# Guia de deploy — passo a passo

Guia detalhado para colocar o app no ar do zero, sem precisar saber programar.
Para uma visão geral do projeto, veja o [README](../README.md).

## 1. Criar o banco de dados (Supabase, gratuito)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. No painel do projeto, vá em **SQL Editor** → **New query**.
3. Cole todo o conteúdo do arquivo [`supabase/schema.sql`](../supabase/schema.sql)
   e clique em **Run**. Isso cria as tabelas e já popula com categorias e
   orçamento iniciais.
4. Vá em **Authentication → Users** → **Add user** → **Create new user** e
   crie uma conta para cada pessoa que vai usar o app (email + senha, com
   **Auto Confirm User** marcado). É esse login que abre o app — não existe
   tela de "criar conta" pública.
5. Pegue a **Project URL** e a chave **anon public**:
   - Vá em **Settings** (engrenagem) → **Data API** para ver a **Project URL**.
   - Vá em **Settings → API Keys → Legacy API Keys** para ver a chave **anon
     / public**. (Se essa aba não existir na sua versão do Supabase, use a
     chave `sb_publishable_...` da aba **API Keys** — funciona igual.)

## 2. Colocar o código no GitHub

1. Crie um repositório novo no GitHub.
2. Na página do repositório vazio, clique em **uploading an existing file**.
3. Descompacte o projeto no seu computador e arraste **todo o conteúdo** da
   pasta pra área de upload — incluindo as pastas `src`, `supabase` e
   `.github`. Essa última começa com ponto e costuma ficar **oculta**:
   - Windows: Explorador de Arquivos → "Exibir" → marque "Itens ocultos".
   - Mac: Finder → `Cmd + Shift + .`
4. Clique em **Commit changes**.

## 3. Guardar as chaves do Supabase como *secrets* do GitHub

1. **Settings → Secrets and variables → Actions → New repository secret**.
2. Crie `VITE_SUPABASE_URL` com a Project URL.
3. Crie `VITE_SUPABASE_ANON_KEY` com a chave anon/publishable.

## 4. Ativar o GitHub Pages

1. **Settings → Pages → Build and deployment → Source** → escolha
   **GitHub Actions**.
2. No plano gratuito do GitHub, isso só fica disponível se o repositório for
   **público** (Settings → parte inferior → Danger Zone → Change visibility).
   O único dado sensível do projeto (as chaves do Supabase) fica nos
   *secrets*, nunca no código, e o acesso aos dados é protegido por login —
   então tornar o repositório público não expõe nenhuma transação real.
   Se preferir manter o repositório privado, publique em **Netlify** ou
   **Vercel** em vez do GitHub Pages — ambos aceitam repositórios privados
   de graça.

## 5. Rodar o primeiro deploy

1. Aba **Actions** do repositório → deve aparecer um item **Deploy to
   GitHub Pages** (o texto em negrito maior é a mensagem do commit, o nome
   do workflow fica logo abaixo, em cinza).
2. Se não tiver rodado sozinho, clique nele → **Re-run all jobs**.
3. Espere o ícone ficar ✅ verde (leva menos de 1 minuto).
4. O link do app aparece em **Settings → Pages**
   (`https://seu-usuario.github.io/nome-do-repo/`).

## 6. Usar no celular

Abra o link no navegador do celular de cada pessoa e escolha **"Adicionar à
tela inicial"** no menu do navegador. Se o ícone aparecer genérico (só uma
letra), remova o atalho e adicione de novo — o navegador cacheia o ícone
antigo.

## Rodando localmente (opcional)

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves do Supabase
npm run dev
```

## Solução de problemas comuns

**"Column reference is ambiguous" ao rodar o `schema.sql`**
Já corrigido na versão atual do arquivo — se você baixou uma cópia antiga,
pegue a mais recente deste repositório.

**Não encontro "Project API Keys" no Supabase**
A interface mudou — veja o passo 1.5 acima (Settings → API Keys → Legacy
API Keys).

**Pages não aparece nas opções, ou pede plano pago**
Repositório precisa estar público (passo 4) ou publique via Netlify/Vercel.

**Não acho "Deploy to GitHub Pages" na aba Actions**
Confira, nesta ordem: (1) a pasta `.github/workflows/deploy.yml` realmente
foi enviada — veja pelo navegador de arquivos do repositório; (2) em
**Settings → Actions → General**, as Actions estão habilitadas; (3) o nome
da branch principal do repositório é `main` (o workflow só dispara nela).

**Lancei uma transação e o Orçamento não mudou nada**
Bug conhecido e corrigido: uma versão antiga do `src/lib/budget.js` tinha um
erro de fuso horário que fazia o app ignorar transações do mês atual em
fusos negativos (Brasil incluso). Atualize esse arquivo para a versão mais
recente do projeto.
