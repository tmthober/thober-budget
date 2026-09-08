# Orçamento Familiar

App de controle financeiro pessoal no método de orçamento por envelopes
(o mesmo princípio do YNAB — *You Need A Budget*): toda categoria recebe um
valor no início do mês, e cada gasto desconta desse valor. Feito pra uso
familiar, com apenas login de email/senha para os dois usuários.

Substitui um fluxo anterior de Google Forms + Google Sheets por um app
próprio, com backend em Supabase e hospedagem estática no GitHub Pages.

## Funcionalidades

- **Orçamento mensal** — categorias agrupadas (obrigações fixas, gastos
  variáveis, gastos anuais, poupança de longo prazo), com "pronto para
  orçar" calculado a partir da renda lançada.
- **Barra de progresso por categoria** — visualização de gasto vs. orçado,
  além de um resumo agregado do mês inteiro.
- **Edição inline do orçamento** — toque no valor orçado de qualquer
  categoria para ajustá-lo.
- **Lançamento de despesas/receitas** — com busca por categoria (digite para
  filtrar, ou role a lista completa) e campo de valor no estilo calculadora
  de banco (a formatação em R$ aparece sozinha, sem precisar digitar vírgula).
- **Edição e exclusão de lançamentos passados**, com confirmação antes de
  excluir.
- **Instalável como app** (PWA) — ícone e nome próprios na tela inicial do
  celular, tanto Android quanto iOS.

## Stack

| Camada        | Tecnologia                          |
|---------------|--------------------------------------|
| Frontend      | React 18 + Vite                      |
| Estilo        | CSS puro (sem framework)              |
| Backend/dados | [Supabase](https://supabase.com) (Postgres + Auth + REST) |
| Hospedagem    | GitHub Pages, via GitHub Actions      |

Sem framework de UI e sem backend próprio de propósito — o app é pequeno o
bastante pra não precisar da complexidade extra, e o Supabase cobre banco de
dados, autenticação e API de uma vez.

## Estrutura do projeto

```
├── public/
│   ├── icons/                  # ícones do PWA (gerados por scripts/make_icons.py)
│   └── manifest.webmanifest    # manifesto do PWA
├── src/
│   ├── components/
│   │   ├── AddTransactionForm.jsx
│   │   ├── BudgetView.jsx        # tela de orçamento (categorias + progresso)
│   │   ├── CategoryPicker.jsx    # combobox de categoria com busca
│   │   ├── CurrencyInput.jsx     # input de valor estilo "calculadora de banco"
│   │   ├── EditTransactionForm.jsx
│   │   ├── icons.jsx             # ícones SVG inline usados na navegação
│   │   ├── Login.jsx
│   │   └── TransactionsView.jsx  # registro de lançamentos
│   ├── lib/
│   │   └── budget.js           # cálculo de orçado/gasto/disponível por mês
│   ├── App.jsx                 # navegação por abas + estado de sessão
│   ├── main.jsx
│   └── supabaseClient.js
├── supabase/
│   └── schema.sql              # tabelas, RLS e seed de categorias
├── docs/
│   └── DEPLOY_GUIDE.md         # passo a passo detalhado de deploy
└── .github/workflows/deploy.yml
```

## Modelo de dados

- `category_groups` — agrupamento de categorias (ex: "Immediate Obligations")
- `categories` — categorias individuais, com flag `is_income` para a
  categoria de renda
- `budget_entries` — valor orçado por categoria, por mês (`category_id` +
  `month` são únicos juntos)
- `transactions` — lançamentos (`category_id`, `date`, `amount`, `note`)

`ACTIVITY` (gasto do mês) e `AVAILABLE` (disponível, com rollover entre
meses) não são colunas armazenadas — são calculados em `src/lib/budget.js` a
partir de `budget_entries` + `transactions` toda vez que a tela carrega.

## Começando

### Pré-requisitos
- Node.js 20+
- Uma conta gratuita no [Supabase](https://supabase.com)

### Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run dev
```

### Deploy

Veja o [guia de deploy completo](docs/DEPLOY_GUIDE.md) para o passo a passo
detalhado (Supabase, GitHub, variáveis de ambiente e GitHub Pages).

## Roadmap

- [ ] Separar lançamentos por conta (corrente, cartão, dinheiro)
- [ ] Registrar quem lançou cada transação
- [ ] Captura automática de notificações de banco/carteira digital (fila de
      "para categorizar")
- [ ] Gráficos de gasto por categoria/mês

## Licença

Projeto pessoal, sem licença definida — sinta-se livre pra usar como
referência.
