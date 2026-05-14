"use client"

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Wallet2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { transactionsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslations } from 'next-intl';
import { useParams } from "next/navigation";

const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#3b82f6", "#ec4899", "#ef4444", "#10b981", "#14b8a6"];

interface Transaction {
  id: string;
  amount: number;
  type: string;
  date: string;
  description: string | null;
  category: string | null;
}

function DashboardContent() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const params = useParams();
  const locale = (params.locale as string) || 'en';
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
      const k = t.category || "Other";
      byCat.set(k, { name: k, value: (byCat.get(k)?.value || 0) + Number(t.amount) });
    });
  const pieData = Array.from(byCat.values()).sort((a, b) => b.value - a.value);

  const stats = [
    { label: t('totalIncome'), value: income, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: t('totalExpenses'), value: expenses, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
    { label: t('netBalance'), value: savings, icon: Wallet2, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Savings rate", value: `${savingsRate.toFixed(0)}%`, icon: Wallet, color: "text-blue-600", bg: "bg-blue-50", isPct: true },
  ];

  if (loading) return <div className="text-muted-foreground">{tCommon('loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('overview')} — {format(new Date(), "MMMM yyyy")}</p>
      </div>

      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-medium mt-1">
              {s.isPct ? s.value : `$${Number(s.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </Card>
        ))}
      </div>

      {/* Main Content Grid - 2 columns */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Takes 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Income vs Expenses Line Chart */}
          <Card className="p-6">
            <h3 className="font-medium mb-4">{t('incomeVsExpenses')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    background: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))", 
                    borderRadius: 8 
                  }} 
                />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", r: 4 }} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} dot={{ fill: "#ef4444", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Recent Transactions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">{t('recentTransactions')}</h3>
              <a href={`/${locale}/transactions`} className="text-sm text-primary hover:underline">
                {t('viewAll')}
              </a>
            </div>
            {txns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('addFirst')}</p>
            ) : (
              <div className="space-y-1">
                {txns.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div 
                        className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium`}
                        style={{ backgroundColor: tx.type === 'income' ? '#10b981' : '#8b5cf6' }}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.description || tx.category || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <span className={`font-medium ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "income" ? "+" : "-"}${Number(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Takes 1/3 width */}
        <div className="space-y-6">
          {/* Spending by Category Pie Chart */}
          <Card className="p-6">
            <h3 className="font-medium mb-4">{t('spendingByCategory')}</h3>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-sm h-[200px] flex items-center justify-center">{t('noData')}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie 
                      data={pieData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={80}
                      innerRadius={50}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))", 
                        borderRadius: 8 
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {pieData.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Quick Stats Summary */}
          <Card className="p-6">
            <h3 className="font-medium mb-4">This Month</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Income</span>
                  <span className="text-sm font-medium text-green-600">${income.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full" 
                    style={{ width: income > 0 ? '100%' : '0%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Expenses</span>
                  <span className="text-sm font-medium text-red-600">${expenses.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full" 
                    style={{ width: income > 0 ? `${Math.min((expenses / income) * 100, 100)}%` : '0%' }}
                  />
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Net Balance</span>
                  <span className={`text-lg font-medium ${savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${savings.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
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
