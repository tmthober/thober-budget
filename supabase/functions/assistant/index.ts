// Supabase Edge Function: assistente de orçamento (Gemini)
//
// Por que existe: o repositório é público, então a API key do Gemini NÃO pode
// ficar no frontend. Esta função roda no Supabase, guarda a key em secret e
// devolve só a resposta em texto.
//
// Segurança: usa o JWT do próprio usuário (header Authorization) para ler o
// Supabase, então as políticas de RLS continuam valendo — a função não tem
// nenhum poder a mais que o usuário logado.
//
// CONVENÇÃO CRÍTICA DO PROJETO: datas são comparadas como STRING
// (YYYY-MM / YYYY-MM-DD). Nunca usar new Date('YYYY-MM-DD') + .getMonth(),
// porque em UTC-3 a data volta um dia e exclui transações do mês.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-2.5-flash";

const BRL = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------- contexto do orçamento ----------

type Ctx = {
  month: string;
  today: string;
  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;
  monthProgressPct: number;
  readyToAssign: number;
  totals: { budgeted: number; activity: number; available: number };
  categories: Array<{
    name: string;
    group: string;
    isIncome: boolean;
    budgeted: number;
    activity: number;
    available: number;
    avg3m: number;
  }>;
};

function daysInMonthOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // dia 0 do mês seguinte = último dia
}

function monthsBefore(month: string, n: number): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return out;
}

async function buildContext(supabase: any, month: string, today: string): Promise<Ctx> {
  const [groupsRes, catsRes, budgetsRes, txRes] = await Promise.all([
    supabase.from("category_groups").select("id, name, sort_order"),
    supabase.from("categories").select("id, group_id, name, sort_order, is_income"),
    supabase.from("budget_entries").select("category_id, month, budgeted_amount"),
    supabase.from("transactions").select("category_id, date, amount"),
  ]);

  for (const r of [groupsRes, catsRes, budgetsRes, txRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const groupName = new Map<number, string>(
    (groupsRes.data ?? []).map((g: any) => [g.id, g.name]),
  );
  const recent3 = monthsBefore(month, 3);

  const cats = (catsRes.data ?? [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c: any) => {
      // acumulado até o mês (rollover), tudo por comparação de string
      let budgetedCum = 0;
      let budgetedMonth = 0;
      for (const b of budgetsRes.data ?? []) {
        if (b.category_id !== c.id) continue;
        const bm = String(b.month).slice(0, 7);
        if (bm <= month) budgetedCum += Number(b.budgeted_amount) || 0;
        if (bm === month) budgetedMonth += Number(b.budgeted_amount) || 0;
      }

      let activityCum = 0;
      let activityMonth = 0;
      const perMonth = new Map<string, number>();
      for (const t of txRes.data ?? []) {
        if (t.category_id !== c.id) continue;
        const tm = String(t.date).slice(0, 7);
        const amt = Number(t.amount) || 0;
        if (tm <= month) activityCum += amt;
        if (tm === month) activityMonth += amt;
        perMonth.set(tm, (perMonth.get(tm) ?? 0) + amt);
      }

      const avg3m =
        recent3.reduce((s, m) => s + (perMonth.get(m) ?? 0), 0) / recent3.length;

      return {
        id: c.id,
        name: c.name,
        group: groupName.get(c.group_id) ?? "—",
        isIncome: !!c.is_income,
        budgeted: budgetedMonth,
        activity: activityMonth,
        available: c.is_income ? 0 : budgetedCum - activityCum,
        avg3m,
      };
    });

  // Pronto para orçar = receita acumulada − orçado acumulado (aproximação do app)
  let incomeCum = 0;
  for (const t of txRes.data ?? []) {
    const cat = cats.find((c: any) => c.id === t.category_id);
    if (cat?.isIncome && String(t.date).slice(0, 7) <= month) {
      incomeCum += Number(t.amount) || 0;
    }
  }
  let budgetedAllCum = 0;
  for (const b of budgetsRes.data ?? []) {
    if (String(b.month).slice(0, 7) <= month) {
      budgetedAllCum += Number(b.budgeted_amount) || 0;
    }
  }

  const spend = cats.filter((c: any) => !c.isIncome);
  const dim = daysInMonthOf(month);
  const day = today.slice(0, 7) === month ? Number(today.slice(8, 10)) : dim;

  return {
    month,
    today,
    dayOfMonth: day,
    daysInMonth: dim,
    daysLeft: Math.max(0, dim - day),
    monthProgressPct: Math.round((day / dim) * 100),
    readyToAssign: incomeCum - budgetedAllCum,
    totals: {
      budgeted: spend.reduce((s: number, c: any) => s + c.budgeted, 0),
      activity: spend.reduce((s: number, c: any) => s + c.activity, 0),
      available: spend.reduce((s: number, c: any) => s + c.available, 0),
    },
    categories: spend.map(({ id: _id, ...rest }: any) => rest),
  };
}

// ---------- prompt ----------

function renderContext(ctx: Ctx): string {
  const linhas = ctx.categories
    .map(
      (c) =>
        `- ${c.name} (${c.group}) | orçado ${BRL(c.budgeted)} | gasto ${BRL(c.activity)} | disponível ${BRL(c.available)} | média últimos 3 meses ${BRL(c.avg3m)}`,
    )
    .join("\n");

  const estouradas = ctx.categories.filter((c) => c.available < 0);
  const folgadas = ctx.categories
    .filter((c) => c.available > 0)
    .sort((a, b) => b.available - a.available)
    .slice(0, 8);

  return `DATA DE HOJE: ${ctx.today}
MÊS DO ORÇAMENTO: ${ctx.month} — dia ${ctx.dayOfMonth} de ${ctx.daysInMonth} (${ctx.monthProgressPct}% do mês passou, faltam ${ctx.daysLeft} dias)

TOTAIS (categorias de gasto):
- orçado no mês: ${BRL(ctx.totals.budgeted)}
- gasto no mês: ${BRL(ctx.totals.activity)}
- disponível agora (com rollover): ${BRL(ctx.totals.available)}
- pronto para orçar: ${BRL(ctx.readyToAssign)}

CATEGORIAS:
${linhas}

CATEGORIAS ESTOURADAS (disponível negativo): ${
    estouradas.length
      ? estouradas.map((c) => `${c.name} (${BRL(c.available)})`).join(", ")
      : "nenhuma"
  }

CATEGORIAS COM MAIS FOLGA (candidatas a ceder dinheiro): ${
    folgadas.length
      ? folgadas.map((c) => `${c.name} (${BRL(c.available)})`).join(", ")
      : "nenhuma"
  }`;
}

const SYSTEM = `Você é o assistente financeiro de um casal que usa um app de orçamento no método YNAB (envelope budgeting). Responda em português do Brasil, direto e curto.

Regras:
1. "Disponível" já inclui o rollover de meses anteriores. É o número que manda: é literalmente quanto pode ser gasto naquela categoria hoje.
2. Ao responder "quanto posso gastar em X", sempre diga: (a) o disponível da categoria em reais; (b) um conselho considerando o ponto do mês — se faltam muitos dias e o disponível é curto em relação à média de gasto dos últimos 3 meses, avise que o ritmo não fecha e sugira um limite diário; se o mês está acabando e sobrou dinheiro, diga que está folgado.
3. Se o valor que a pessoa quer gastar não cabe no disponível, sugira DE QUAL categoria tirar a diferença: escolha entre as categorias com folga, preferindo gastos flexíveis (Variable Expenses, Wish Farm) e evitando contas fixas (Immediate Obligations) e poupança de longo prazo. Diga o nome exato da categoria e o valor a mover. Se nenhuma categoria tiver folga suficiente, diga isso claramente em vez de inventar.
4. Use só os números do contexto. Nunca invente categorias, valores ou saldos. Se o dado não estiver no contexto, diga que não tem essa informação.
5. Formato: 3 a 6 linhas, sem tabelas, sem markdown pesado. Valores sempre em R$ com duas casas.`;

// ---------- handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY não configurada na função" }, 500);

    const body = await req.json().catch(() => ({}));
    const question = String(body.question ?? "").trim();
    if (!question) return json({ error: "Pergunta vazia" }, 400);
    if (question.length > 500) return json({ error: "Pergunta muito longa" }, 400);

    // O cliente manda a data local (evita o app achar que é outro mês em UTC)
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "")
      ? body.today
      : new Date().toISOString().slice(0, 10);
    const month = /^\d{4}-\d{2}$/.test(body.month ?? "") ? body.month : today.slice(0, 7);

    const ctx = await buildContext(supabase, month, today);

    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    const contents = [
      ...history
        .filter((h: any) => h && typeof h.text === "string")
        .map((h: any) => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: String(h.text).slice(0, 2000) }],
        })),
      {
        role: "user",
        parts: [
          {
            text: `CONTEXTO ATUAL DO ORÇAMENTO\n${renderContext(ctx)}\n\nPERGUNTA: ${question}`,
          },
        ],
      },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("Gemini error", res.status, detail);
      return json({ error: "O assistente não respondeu agora. Tente de novo." }, 502);
    }

    const data = await res.json();
    const answer = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? "")
      .join("")
      .trim();

    if (!answer) return json({ error: "Resposta vazia do assistente." }, 502);

    return json({ answer, context: { month: ctx.month, day: ctx.dayOfMonth } });
  } catch (err) {
    console.error(err);
    return json({ error: "Erro inesperado no assistente." }, 500);
  }
});
