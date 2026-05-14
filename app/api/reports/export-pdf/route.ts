import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { generateGeminiText } from '@/lib/gemini-generate';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';
export const maxDuration = 120;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFallbackHtml(params: {
  type: string;
  periodLabel: string;
  dateRangeLabel: string;
  userName: string;
  includes: { income: boolean; expenses: boolean; budgets: boolean };
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number;
  transactionCount: number;
  incomeRows: [string, { amount: number; count: number }][];
  expenseRows: [string, { amount: number; count: number }][];
  budgetRows: { category: string; budgeted: number; spent: number; percentage: number; status: string }[];
}): string {
  const money = (n: number) => `$${n.toFixed(2)}`;
  const rows = (r: [string, { amount: number; count: number }][]) =>
    r
      .map(
        ([cat, d]) =>
          `<tr><td>${escapeHtml(cat)}</td><td style="text-align:right">${money(d.amount)}</td><td>${d.count}</td></tr>`
      )
      .join('');

  const budgetTable = params.budgetRows
    .map(
      (b) =>
        `<tr><td>${escapeHtml(b.category)}</td><td style="text-align:right">${money(b.budgeted)}</td><td style="text-align:right">${money(b.spent)}</td><td>${b.percentage}%</td><td>${escapeHtml(b.status)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Financial report</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 16px;color:#111}
h1{border-bottom:2px solid #1976d2;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f5f5f5}
.summary{background:#e3f2fd;padding:16px;border-radius:8px;margin:16px 0}
.note{color:#666;font-size:14px;margin-top:24px}
</style></head><body>
<h1>${escapeHtml(params.type)} — ${escapeHtml(params.periodLabel)}</h1>
<p>${escapeHtml(params.userName)} · ${escapeHtml(params.dateRangeLabel)}</p>
<div class="summary">
<p><strong>Total income:</strong> ${money(params.totalIncome)}</p>
<p><strong>Total expenses:</strong> ${money(params.totalExpenses)}</p>
<p><strong>Net balance:</strong> ${money(params.netBalance)}</p>
<p><strong>Savings rate:</strong> ${params.savingsRate.toFixed(1)}%</p>
<p><strong>Transactions:</strong> ${params.transactionCount}</p>
</div>
${params.includes.income && params.incomeRows.length ? `<h2>Income by category</h2><table><tr><th>Category</th><th>Amount</th><th>#</th></tr>${rows(params.incomeRows)}</table>` : ''}
${params.includes.expenses && params.expenseRows.length ? `<h2>Expenses by category</h2><table><tr><th>Category</th><th>Amount</th><th>#</th></tr>${rows(params.expenseRows)}</table>` : ''}
${params.includes.budgets && params.budgetRows.length ? `<h2>Budgets</h2><table><tr><th>Category</th><th>Budgeted</th><th>Spent</th><th>%</th><th>Status</th></tr>${budgetTable}</table>` : ''}
<p class="note">Use <strong>Print</strong> (Ctrl+P / ⌘P) and choose <strong>Save as PDF</strong> if you need a PDF file.</p>
</body></html>`;
}

function sanitizeDownloadableHtml(html: string): string {
  let h = html.trim().replace(/^\uFEFF/, '');
  const low = h.toLowerCase();
  const docStart = low.indexOf('<!doctype');
  const htmlStart = low.indexOf('<html');
  const start = docStart >= 0 ? docStart : htmlStart >= 0 ? htmlStart : 0;
  const htmlEnd = low.lastIndexOf('</html>');
  h = htmlEnd >= 0 ? h.slice(start, htmlEnd + 7) : h.slice(start);
  h = h.trim();
  if (!h) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Report</title></head><body><p>No content generated.</p></body></html>';
  }
  const hasHtml = h.toLowerCase().includes('<html');
  if (!hasHtml) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Financial report</title></head><body>${h}</body></html>`;
  }
  if (!h.toLowerCase().startsWith('<!doctype')) {
    return `<!DOCTYPE html>\n${h}`;
  }
  return h;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');

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

    const { type, period, includes } = await request.json();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const periodDate = new Date(period);
    const startDate = format(startOfMonth(periodDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(periodDate), 'yyyy-MM-dd');

    const [transactionsRes, budgetsRes] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabaseAdmin
        .from('budgets')
        .select('*')
        .eq('user_id', user.id),
    ]);

    const transactions = transactionsRes.data || [];
    const budgets = budgetsRes.data || [];

    const incomeTransactions = transactions.filter((t) => t.type === 'income');
    const expenseTransactions = transactions.filter((t) => t.type === 'expense');

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const netBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    const expensesByCategory: Record<string, { amount: number; count: number }> = {};
    expenseTransactions.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      if (!expensesByCategory[cat]) {
        expensesByCategory[cat] = { amount: 0, count: 0 };
      }
      expensesByCategory[cat].amount += Number(t.amount);
      expensesByCategory[cat].count += 1;
    });

    const incomeByCategory: Record<string, { amount: number; count: number }> = {};
    incomeTransactions.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      if (!incomeByCategory[cat]) {
        incomeByCategory[cat] = { amount: 0, count: 0 };
      }
      incomeByCategory[cat].amount += Number(t.amount);
      incomeByCategory[cat].count += 1;
    });

    const budgetPerformance = budgets.map((budget) => {
      const spent = expenseTransactions
        .filter((t) => t.category === budget.category)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const percentage = (spent / Number(budget.amount)) * 100;
      return {
        category: budget.category,
        budgeted: Number(budget.amount),
        spent,
        percentage: Math.round(percentage),
        status: percentage > 100 ? 'Over Budget' : percentage > 80 ? 'Warning' : 'On Track',
      };
    });

    const inc = Boolean(includes?.income);
    const exp = Boolean(includes?.expenses);
    const bud = Boolean(includes?.budgets);

    const incomeEntries = Object.entries(incomeByCategory);
    const expenseEntries = Object.entries(expensesByCategory);

    const prompt = `You are a professional financial report generator. Create a beautiful, detailed HTML financial report.

**REPORT DETAILS:**
- Report Type: ${type}
- Period: ${format(periodDate, 'MMMM yyyy')}
- User: ${profile?.full_name || 'User'}
- Date Range: ${format(parseISO(startDate), 'MMM dd, yyyy')} - ${format(parseISO(endDate), 'MMM dd, yyyy')}

**FINANCIAL SUMMARY:**
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Net Balance: $${netBalance.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Number of Transactions: ${transactions.length}

${inc ? `**INCOME BREAKDOWN:**
${incomeEntries.map(([cat, data]) => `- ${cat}: $${data.amount.toFixed(2)} (${data.count} transactions)`).join('\n')}` : ''}

${exp ? `**EXPENSE BREAKDOWN:**
${expenseEntries.map(([cat, data]) => {
  const pct = totalExpenses > 0 ? ((data.amount / totalExpenses) * 100).toFixed(1) : '0.0';
  return `- ${cat}: $${data.amount.toFixed(2)} (${data.count} transactions, ${pct}% of total)`;
}).join('\n')}` : ''}

${bud && budgetPerformance.length > 0 ? `**BUDGET PERFORMANCE:**
${budgetPerformance.map((b) => `- ${b.category}: $${b.spent.toFixed(2)} / $${b.budgeted.toFixed(2)} (${b.percentage}%) - ${b.status}`).join('\n')}` : ''}

**REQUIREMENTS:**
1. Create a complete, standalone HTML document with embedded CSS
2. Use a professional, modern design with a clean layout
3. Include a header with report title and date
4. Use a color scheme: green tones for income/positive, red tones for expenses, neutral for summary
5. Use tables with readable typography
6. Include summary cards or highlighted metrics at the top
7. Add a short insights / recommendations section at the end
8. At the bottom, note: "To save as PDF: use Print (Ctrl+P or ⌘+P) and choose Save as PDF / Microsoft Print to PDF."
9. Use system fonts (system-ui, Segoe UI, sans-serif)
10. Make it print-friendly

Generate ONLY the complete HTML code, no markdown fences and no explanations.`;

    let rawHtml: string;
    if (process.env.GEMINI_API_KEY) {
      try {
        const htmlContent = await generateGeminiText(genAI, prompt);
        rawHtml = htmlContent.trim();
        if (rawHtml.startsWith('```html')) {
          rawHtml = rawHtml.replace(/```html\n?/, '').replace(/```\s*$/, '');
        } else if (rawHtml.startsWith('```')) {
          rawHtml = rawHtml.replace(/```\n?/, '').replace(/```\s*$/, '');
        }
      } catch {
        rawHtml = buildFallbackHtml({
          type: type || 'Report',
          periodLabel: format(periodDate, 'MMMM yyyy'),
          dateRangeLabel: `${format(parseISO(startDate), 'MMM dd, yyyy')} - ${format(parseISO(endDate), 'MMM dd, yyyy')}`,
          userName: profile?.full_name || 'User',
          includes: { income: inc, expenses: exp, budgets: bud },
          totalIncome,
          totalExpenses,
          netBalance,
          savingsRate,
          transactionCount: transactions.length,
          incomeRows: incomeEntries,
          expenseRows: expenseEntries,
          budgetRows: budgetPerformance,
        });
      }
    } else {
      rawHtml = buildFallbackHtml({
        type: type || 'Report',
        periodLabel: format(periodDate, 'MMMM yyyy'),
        dateRangeLabel: `${format(parseISO(startDate), 'MMM dd, yyyy')} - ${format(parseISO(endDate), 'MMM dd, yyyy')}`,
        userName: profile?.full_name || 'User',
        includes: { income: inc, expenses: exp, budgets: bud },
        totalIncome,
        totalExpenses,
        netBalance,
        savingsRate,
        transactionCount: transactions.length,
        incomeRows: incomeEntries,
        expenseRows: expenseEntries,
        budgetRows: budgetPerformance,
      });
    }

    const cleanHtml = sanitizeDownloadableHtml(rawHtml);

    return new NextResponse(cleanHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="financial-report-${format(periodDate, 'yyyy-MM')}.html"`,
      },
    });
  } catch (error: unknown) {
    console.error('Report export error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
