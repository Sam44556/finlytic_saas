"use client"

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { transactionsApi, profileApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslations } from 'next-intl';

function ReportsContent() {
  const t = useTranslations('reports');
  const [tier, setTier] = useState<string>("free");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, txRes] = await Promise.all([profileApi.get(), transactionsApi.getAll()]);

      setTier(profileRes.data?.subscription_tier || "free");

      const txns = txRes.data || [];
      const months = Array.from({ length: 12 }).map((_, i) => {
        const d = subMonths(new Date(), 11 - i);
        const ms = startOfMonth(d).toISOString().slice(0, 10);
        const me = startOfMonth(subMonths(d, -1)).toISOString().slice(0, 10);
        const m = txns.filter((t: any) => t.date >= ms && t.date < me);
        return {
          month: format(d, "MMM"),
          income: m.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0),
          expenses: m.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0),
        };
      });
      setData(months);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  const isPro = tier === "pro" || tier === "lifetime";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('monthlyTrends')}</p>
      </div>

      {!isPro && (
        <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">{t('exportReport')}</h2>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Upgrade to Pro for 12-month trends, category analysis, exportable PDF/CSV reports, and AI-powered insights.
          </p>
          <Button className="bg-gradient-primary">
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Button>
        </Card>
      )}

      <Card className={`p-6 ${!isPro ? "opacity-50 pointer-events-none blur-sm" : ""}`}>
        <h3 className="font-semibold mb-4">{t('yearlyComparison')}</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="income" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ReportsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
