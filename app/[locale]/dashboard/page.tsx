"use client"

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { transactionsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslations } from 'next-intl';

const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#3b82f6", "#ec4899", "#ef4444", "#10b981", "#14b8a6"];

interface Transaction {
  id: string;
  amount: number;
  type: string;
  date: string;
  description: string | null;
  category_id: string | null;
  categories?: { name: string; color: string } | null;
}

function DashboardContent() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await transactionsApi.getAll();
      setTxns(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
  const thisMonth = txns.filter((t) => t.date >= monthStart);
  const income = thisMonth.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = thisMonth.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  // 6-month trend
  const trend = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const ms = startOfMonth(d).toISOString().slice(0, 10);
    const me = startOfMonth(subMonths(d, -1)).toISOString().slice(0, 10);
    const monthTx = txns.filter((t) => t.date >= ms && t.date < me);
    return {
      month: format(d, "MMM"),
      income: monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
      expenses: monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  // by-category pie (this month, expenses)
  const byCat = new Map<string, { name: string; value: number }>();
  thisMonth
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const k = t.categories?.name || "Other";
      byCat.set(k, { name: k, value: (byCat.get(k)?.value || 0) + Number(t.amount) });
    });
  const pieData = Array.from(byCat.values()).sort((a, b) => b.value - a.value);

  const stats = [
    { label: t('totalIncome'), value: income, icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: t('totalExpenses'), value: expenses, icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: t('netBalance'), value: savings, icon: PiggyBank, color: "text-primary", bg: "bg-primary/10" },
    { label: "Savings rate", value: `${savingsRate.toFixed(0)}%`, icon: Wallet, color: "text-accent", bg: "bg-accent/10", isPct: true },
  ];

  if (loading) return <div className="text-muted-foreground">{tCommon('loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('overview')} — {format(new Date(), "MMMM yyyy")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1">
              {s.isPct ? s.value : `$${Number(s.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">{t('incomeVsExpenses')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="income" stroke="hsl(var(--success))" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-4">{t('spendingByCategory')}</h3>
          {pieData.length === 0 ? (
            <p className="text-muted-foreground text-sm h-[260px] flex items-center justify-center">{t('noData')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.name}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">{t('recentTransactions')}</h3>
        {txns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('addFirst')}</p>
        ) : (
          <div className="space-y-2">
            {txns.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full" style={{ backgroundColor: (t.categories?.color || "#8b5cf6") + "20" }} />
                  <div>
                    <p className="font-medium text-sm">{t.description || t.categories?.name || "Transaction"}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.categories?.name} • {format(new Date(t.date), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                  {t.type === "income" ? "+" : "-"}${Number(t.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
