# Assistente de IA (Gemini) — instalação

## O que foi adicionado
- `supabase/functions/assistant/index.ts` — Edge Function. Guarda a API key do Gemini, lê o orçamento com o JWT do usuário (RLS continua valendo) e devolve só o texto da resposta.
- `src/lib/assistant.js` — chamada do frontend.
- `src/components/AssistantView.jsx` — a aba nova.

## 1. Pegar a API key do Gemini
1. Acesse https://aistudio.google.com/apikey e clique em **Create API key**.
2. O plano gratuito da API é separado da assinatura Gemini Plus e é de sobra para 2 pessoas.

## 2. Publicar a Edge Function
Precisa do Supabase CLI uma única vez (`npm install -g supabase`):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF      # está na URL do painel do Supabase
supabase secrets set GEMINI_API_KEY=cole_a_key_aqui
supabase functions deploy assistant
```

`SUPABASE_URL` e `SUPABASE_ANON_KEY` já existem automaticamente no ambiente das functions — não precisa configurar.

> Se preferir não instalar o CLI: no painel do Supabase, **Edge Functions → Deploy a new function**, nome `assistant`, e cole o conteúdo de `index.ts`. A key vai em **Edge Functions → Secrets**.

## 3. Ligar a aba no `App.jsx`
Três edições manuais:

**a) import, junto dos outros:**
```js
import AssistantView from './components/AssistantView'
```

**b) onde as abas são renderizadas** (no mesmo lugar onde já existe `{tab === 'reports' && <ReportsView ... />}`):
```jsx
{tab === 'assistant' && <AssistantView month={month} />}
```
Se a variável do mês visível tiver outro nome (ex.: `currentMonth`), use o nome existente. O formato esperado é `'YYYY-MM'`; se no app ela for `'YYYY-MM-01'`, passe `month={month.slice(0, 7)}`.

**c) no menu de abas**, adicionar o botão `assistant` com rótulo "Assistente" (ícone sugerido: ✨). A barra hoje tem 2 abas + botão flutuante + 2 abas; para não desequilibrar, o mais simples é colocar o Assistente dentro da aba **Ajustes/Menu** como um item de lista, ou trocar uma aba de lugar. Me diga qual layout prefere que eu ajusto.

## 4. Testar
Rode local (`npm run dev`), faça login e pergunte "quanto posso gastar em mercado?".
Se der erro, veja os logs em **Edge Functions → assistant → Logs** no painel do Supabase.

## Como ele responde
O contexto enviado ao Gemini tem: dia do mês e quantos dias faltam, orçado/gasto/disponível de cada categoria (com rollover), média de gasto dos últimos 3 meses por categoria, totais, "pronto para orçar", lista de categorias estouradas e lista das com mais folga. O prompt manda ele dar o valor disponível, o conselho conforme o ponto do mês e — quando não cabe — sugerir de qual categoria tirar, preferindo gastos flexíveis (Variable Expenses, Wish Farm) e evitando contas fixas e poupança de longo prazo.

Nenhum valor é inventado: se o dado não está no contexto, ele deve dizer que não tem a informação.
