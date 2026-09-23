# Multi-Household Setup — Guia Completo

Este guia explica como ativar o suporte a múltiplos usuários com orçamentos isolados.

## 📋 Pré-requisitos

- Projeto já com dados de setembro/2026
- Acesso ao painel SQL do Supabase
- Novas telas: `HouseholdSelector`, `CreateHouseholdForm`, `JoinHouseholdForm`

## 🚀 Passos de Setup

### 1. Executar a Migration Principal

No painel SQL do Supabase:

1. Abra **SQL Editor** → **New Query**
2. Copie o conteúdo de `supabase/migration_households.sql`
3. Cole no editor
4. Clique em **Run** (ícone de play)

Isso cria:
- Tabelas `households` e `household_members`
- Adiciona coluna `household_id` às 5 tabelas existentes
- Define RLS policies de isolamento

**Status esperado**: ✅ Query executed successfully

---

### 2. Migrar Dados Existentes

No mesmo painel SQL:

1. Abra **SQL Editor** → **New Query**
2. Copie o conteúdo de `supabase/migrate_existing_data.sql`
3. Cole no editor
4. Clique em **Run**

Isso:
- Cria um household inicial chamado "Meu Orçamento"
- Adiciona `household_id` a todas as 35 categorias, grupos, orçamentos, transações, e movimentos de estouro
- Te adiciona como admin do household

**Status esperado**: ✅ Query executed successfully + mensagem "Migração concluída!"

---

### 3. Verificar Migração (Opcional)

Ainda no SQL Editor, rode este SELECT pra confirmar que os dados foram migrados:

```sql
SELECT 
  (SELECT COUNT(*) FROM category_groups WHERE household_id IS NOT NULL) as "Groups",
  (SELECT COUNT(*) FROM categories WHERE household_id IS NOT NULL) as "Categories",
  (SELECT COUNT(*) FROM budget_entries WHERE household_id IS NOT NULL) as "Budget Entries",
  (SELECT COUNT(*) FROM transactions WHERE household_id IS NOT NULL) as "Transactions",
  (SELECT COUNT(*) FROM overspend_moves WHERE household_id IS NOT NULL) as "Overspend Moves";
```

**Resultado esperado**: Todos os counts devem ser > 0 (seus dados de set/2026)

---

## 🧪 Testar Fluxo Multi-Household

### Teste 1: Sua Conta Existente

1. Faça login com sua conta existente
2. Você deve ver a tela **HouseholdSelector**
3. Ele mostra: **"Seu(s) household(s)"** com **"Meu Orçamento"**
4. Clique nele → entra no app com seus dados de set/2026 intactos

### Teste 2: Criar Novo Usuário + Orçamento

1. **Logout**
2. Vá pra tela de **Sign up** e crie uma conta nova (ex: `amigo@example.com`)
3. Faça login
4. Você vê tela **HouseholdSelector** vazia com duas opções:
   - **"Criar Novo Orçamento"** → abre `CreateHouseholdForm`
   - **"Entrar com Código"** → abre `JoinHouseholdForm`
5. Clique em **"Criar Novo Orçamento"**
6. Digite um nome (ex: "Orçamento do Amigo")
7. Clique em **Criar**
8. Você vê tela de sucesso com um **código de acesso** (ex: ABC123)
9. **Copie o código**
10. Clique em **Continuar** → entra no app
11. **Importante**: categorias devem estar **todas zeradas** (não herdou seus dados)

### Teste 3: Entrar com Código

1. Logout (ou abra em navegador anônimo)
2. Faça login com **outra conta nova** (ex: `outro@example.com`)
3. Na tela **HouseholdSelector**, clique em **"Entrar com Código"**
4. Digite o código que você copiou no Teste 2 (ex: ABC123)
5. Clique em **Entrar**
6. Você agora vê o orçamento do amigo — **mesmas categorias zeradas**
7. Se ambos adicionarem transações, **não se veem** (isolados por RLS)

### Teste 4: Verificar Isolamento (RLS)

1. **Usuário A** cria orçamento "Orçamento A"
2. **Usuário B** cria orçamento "Orçamento B"
3. Ambos têm dados completamente isolados
4. Se **Usuário C** tenta entrar com código inválido → erro "Código de acesso inválido"
5. Se **Usuário C** tenta acessar dados de A via banco direto (hack) → RLS nega (política de segurança)

---

## ⚙️ Dados Importante

### Household ID

Cada household tem:
- `id`: UUID único (ex: `550e8400-e29b-41d4-a716-446655440000`)
- `name`: nome amigável (ex: "Meu Orçamento")
- `access_code`: código de 6 chars (ex: `ABC123`) — compartilhável, único
- `created_by`: UID do criador
- `created_at`: timestamp

### Access Code

- **Gerado automaticamente** ao criar household (caracteres aleatórios)
- **Não pode ter espaços** (máx 8 chars, alfanuméricos)
- **Compartilhável** — dê a alguém pra entrar no seu orçamento
- **Não pode ser alterado** após criação (é a chave de join)

### RLS Policies

Cada tabela (categories, transactions, etc.) tem policies que garantem:
- ✅ Você só vê dados do household que é membro
- ✅ Você só pode inserir/atualizar/deletar dados do seu household
- ❌ Você não consegue ver/tocar em dados de outros households (mesmo admin do Supabase vê, mas app nega)

---

## 🐛 Troubleshooting

### "Erro na migração: household_id already exists"

Significa que você rodou o script 2 vezes. Seguro — é uma operação idempotente (ON CONFLICT DO NOTHING).

**Solução**: Ignore e rode de novo, tudo funciona.

---

### "Depois de fazer login, vejo tela branca"

Significa que o HouseholdContext tá carregando mas não achou household.

**Debug**: Abra **DevTools** (F12) → **Console** e procure por erros de fetch/supabase.

**Solução comum**: Verifique que `migration_households.sql` rodou sem erros (tabelas foram criadas).

---

### "Criei household, mas categorias não vêm zeradas"

Significa que `createDefaultCategories` no HouseholdContext não rodou ou falhou silenciosamente.

**Debug**: 
1. Abra DevTools → Network → procure por requisição POST pra `categories` (insert)
2. Se não tem, significa que a função não foi chamada
3. Se tem erro 400+, significa que RLS rejeitou (improvável se você é admin)

**Solução**: Crie as categorias manualmente via painel Supabase (Table Editor → categories → Insert Row)

---

### "Não consigo entrar com código de acesso válido"

Possíveis causas:

1. **Código está errado**
   - Access codes são **case-insensitive** (ABC123 = abc123)
   - Sem espaços em branco

2. **Você já é membro desse household**
   - Erro: "Você já é membro deste household"
   - Solução: Faça logout, entre em outro household, ou teste com outra conta

3. **RLS está bloqueando**
   - Raro, mas possível se RLS policy tá bugada
   - Debug: Abra painel Supabase → RLS → `households` → verifique policies

---

## 📚 Arquivos Modificados

**Schema (Supabase):**
- `supabase/migration_households.sql` — nova
- `supabase/migrate_existing_data.sql` — nova (rode manual)

**Frontend (React):**
- `src/lib/HouseholdContext.jsx` — novo
- `src/lib/supabaseQueries.js` — novo (helpers)
- `src/components/HouseholdSelector.jsx` — novo
- `src/components/CreateHouseholdForm.jsx` — novo
- `src/components/JoinHouseholdForm.jsx` — novo
- `src/main.jsx` — HouseholdProvider adicionado
- `src/App.jsx` — fluxo com AppContent refatorado

**Componentes atualizados:**
- BudgetView.jsx
- AddTransactionForm.jsx
- TransactionsView.jsx
- EditTransactionForm.jsx
- ReportsView.jsx
- OverspendWarning.jsx
- overspend.js
- overspendHistory.js

---

## ✅ Checklist de Deploy

- [ ] Rodou `migration_households.sql` no Supabase
- [ ] Rodou `migrate_existing_data.sql` no Supabase
- [ ] Fez build do projeto (`npm run build`)
- [ ] Atualizou código no GitHub (via drag-and-drop ou git)
- [ ] Testou Teste 1 (sua conta com dados antigos)
- [ ] Testou Teste 2 (novo usuário criando orçamento)
- [ ] Testou Teste 3 (novo usuário entrando com código)
- [ ] Verificou isolamento (cada household vê só seus dados)

---

## 🎉 Pronto!

Seu app agora suporta múltiplos usuários com orçamentos isolados.

**Próximos passos** (não são críticos, mas legal ter):
- Botão "Sair do Household" em SettingsView
- Mostrar access_code em SettingsView pra compartilhar depois
- Log de "quem" criou cada transação (opcionalmente)
- Análise de tendências automática entre households (pra comparar com amigos)
