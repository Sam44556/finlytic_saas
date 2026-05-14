import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateGeminiText } from '@/lib/gemini-generate';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const TX_LIMIT = 2000;

export async function POST(request: NextRequest) {
  try {
    const authHeader =
      request.headers.get('authorization') ?? request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: empty token' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      return NextResponse.json({ error: 'Unauthorized: ' + authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: No user found' }, { status: 401 });
    }

    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const userMessage = message.trim().slice(0, 4000);

    const [profileRes, transactionsRes, budgetsRes, goalsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', user.id).single(),
      supabaseAdmin
        .from('transactions')
        .select('type, amount, date, category, description')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(TX_LIMIT),
      supabaseAdmin.from('budgets').select('*').eq('user_id', user.id),
      supabaseAdmin.from('goals').select('*').eq('user_id', user.id),
    ]);

    const profile = profileRes.data;
    const transactions = transactionsRes.data || [];
    const budgets = budgetsRes.data || [];
    const goals = goalsRes.data || [];

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netBalance = totalIncome - totalExpenses;

    const spendingByCategory: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense' && t.category)
      .forEach((t) => {
        spendingByCategory[t.category!] =
          (spendingByCategory[t.category!] || 0) + Number(t.amount);
      });

    const incomeByCategory: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'income' && t.category)
      .forEach((t) => {
        incomeByCategory[t.category!] =
          (incomeByCategory[t.category!] || 0) + Number(t.amount);
      });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTransactions = transactions.filter((t) => t.date.startsWith(currentMonth));
    const monthlyIncome = monthlyTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const budgetStatus = budgets.map((budget) => {
      const spent = monthlyTransactions
        .filter((t) => t.type === 'expense' && t.category === budget.category)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const cap = Number(budget.amount);
      const percentage = cap > 0 ? (spent / cap) * 100 : 0;
      return {
        category: budget.category,
        budget: cap,
        spent,
        remaining: cap - spent,
        percentage: Math.round(percentage),
        status: percentage > 100 ? 'over' : percentage > 80 ? 'warning' : 'good',
      };
    });

    const goalProgress = goals.map((goal) => {
      const target = Number(goal.target_amount);
      const current = Number(goal.current_amount);
      const progress = target > 0 ? (current / target) * 100 : 0;
      return {
        name: goal.name,
        target,
        current,
        remaining: target - current,
        progress: Math.round(progress),
        deadline: goal.deadline,
      };
    });

    const topExpenseCategories = Object.entries(spendingByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([category, amount]) => ({ category, amount }));

    const topIncomeCategories = Object.entries(incomeByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, amount]) => ({ category, amount }));

    const recentLines = transactions.slice(0, 40).map((t) => {
      const sign = t.type === 'income' ? '+' : '-';
      const desc = t.description ? ` — ${String(t.description).slice(0, 60)}` : '';
      return `${t.date} | ${t.type} | ${t.category || 'Uncategorized'} | ${sign}$${Number(t.amount).toFixed(2)}${desc}`;
    });

    const dataNote =
      transactions.length >= TX_LIMIT
        ? `(Totals and lists use your ${TX_LIMIT} most recent transactions by date; older activity is not in this snapshot.)`
        : `(All figures below are from your ${transactions.length} stored transactions.)`;

    const prompt = `You are Finley, a sharp personal-finance copilot. You ONLY use the DATABASE CONTEXT below — never invent transactions, balances, or categories. If the user asks something you cannot answer from this data (tax law, stock tips, other apps), answer briefly then tie back to what their numbers suggest.

${dataNote}

## DATABASE CONTEXT

**Profile:** ${profile?.full_name || 'User'}${profile?.email ? ` (${profile.email})` : ''}

**Across loaded transactions**
- Total income: $${totalIncome.toFixed(2)}
- Total expenses: $${totalExpenses.toFixed(2)}
- Net (income − expenses): $${netBalance.toFixed(2)}

**Calendar month ${currentMonth} (subset of loaded txs)**
- Income this month: $${monthlyIncome.toFixed(2)}
- Expenses this month: $${monthlyExpenses.toFixed(2)}
- Net this month: $${(monthlyIncome - monthlyExpenses).toFixed(2)}

**Top expense categories (loaded data)**  
${topExpenseCategories.length ? topExpenseCategories.map((c) => `- ${c.category}: $${c.amount.toFixed(2)}`).join('\n') : '- None (no categorized expenses in snapshot)'}

**Top income categories (loaded data)**  
${topIncomeCategories.length ? topIncomeCategories.map((c) => `- ${c.category}: $${c.amount.toFixed(2)}`).join('\n') : '- None'}

**Budgets vs this month’s spending**  
${budgetStatus.length ? budgetStatus.map((b) => `- ${b.category}: spent $${b.spent.toFixed(2)} / budget $${b.budget.toFixed(2)} (${b.percentage}% used) — ${b.status}`).join('\n') : '- No budgets configured'}

**Savings goals**  
${goalProgress.length ? goalProgress.map((g) => `- ${g.name}: $${g.current.toFixed(2)} / $${g.target.toFixed(2)} (${g.progress}% done)${g.deadline ? `, deadline ${g.deadline}` : ''}`).join('\n') : '- No goals configured'}

**Recent transactions (newest first, up to 40)**  
${recentLines.length ? recentLines.join('\n') : '- No transactions'}

---

## USER MESSAGE
"""${userMessage.replace(/"/g, '\\"')}"""

## HOW TO REPLY
1. **Direct first:** In the opening sentence(s), answer what they asked (or acknowledge greeting / small talk naturally).
2. **Use numbers:** When relevant, cite specific dollar amounts or categories from the context — not generic advice only.
3. **Match depth:** Short question → concise reply (roughly 4–12 lines). Complex question → structured reply with short sections or bullet lists.
4. **Tone:** Clear, friendly, professional — not salesy. Avoid repeating the same canned “try asking me…” suggestions; only offer 1–2 follow-up ideas if they help this user.
5. **Formatting:** Use Markdown (## for section titles when needed, **bold** sparingly for key numbers, lists when comparing items). No ASCII art walls.
6. **Emojis:** At most one emoji in the whole reply unless the user is very casual.
7. **Empty data:** If they have no transactions, say so once and suggest one concrete next step (add income + a few expenses).

Write your reply now:`;

    let aiResponse: string;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
      }

      aiResponse = await generateGeminiText(genAI, prompt);
    } catch {
      if (transactions.length === 0) {
        aiResponse =
          'I do not see any transactions in your account yet. Add a few income and expense entries on the **Transactions** page, then ask again — I can break down spending, budgets, and goals from your real data.';
      } else {
        aiResponse = `Here is a quick snapshot from your data (AI unavailable right now): net **$${netBalance.toFixed(2)}** on **${transactions.length}** loaded transactions — **$${monthlyIncome.toFixed(2)}** income and **$${monthlyExpenses.toFixed(2)}** expenses this month (**${currentMonth}**). Try again in a moment for a fuller analysis.`;
      }
    }

    return NextResponse.json(
      {
        response: aiResponse,
        context: {
          totalIncome,
          totalExpenses,
          netBalance,
          monthlyIncome,
          monthlyExpenses,
          budgetStatus,
          goalProgress,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('AI Assistant Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get AI response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
