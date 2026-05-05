"use client"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth } from "date-fns";
import { budgetsApi, transactionsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { useTranslations } from 'next-intl';

interface Budget {
  id: string;
  category: string;
  amount: number;
}

function BudgetsContent() {
  const t = useTranslations('budgets');
  const tCommon = useTranslations('common');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [form, setForm] = useState({ category: "", customCategory: "", amount: "" });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
      const [budgetRes, txRes] = await Promise.all([
        budgetsApi.getAll(),
        transactionsApi.getAll(),
      ]);

      setBudgets(budgetRes.data || []);

      // Calculate spent per category this month
      const s: Record<string, number> = {};
      (txRes.data || []).forEach((tx: any) => {
        if (tx.type === "expense" && tx.date >= monthStart && tx.category) {
          s[tx.category] = (s[tx.category] || 0) + Number(tx.amount);
        }
      });
      setSpent(s);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCategoryChange = (value: string) => {
    setForm({ ...form, category: value });
    if (value === "Other") {
      setShowCustomCategory(true);
    } else {
      setShowCustomCategory(false);
      setForm({ ...form, category: value, customCategory: "" });
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCategory = form.category === "Other" ? form.customCategory : form.category;
    
    if (form.category === "Other" && !form.customCategory.trim()) {
      toast.error(tCommon('error'));
      return;
    }
    
    try {
      await budgetsApi.upsert({
        category: finalCategory,
        amount: Number(form.amount),
        period: "monthly",
      });
      toast.success(t('successAdd'));
      setOpen(false);
      setShowCustomCategory(false);
      setForm({ category: "", customCategory: "", amount: "" });
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await budgetsApi.delete(id);
      toast.success(t('successDelete'));
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const overBudgets = budgets.filter((b) => (spent[b.category] || 0) > Number(b.amount));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('startBudgeting')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              {t('addNew')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addNew')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label>{tCommon('category')}</Label>
                <Select value={form.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showCustomCategory && (
                <div className="space-y-2">
                  <Label>Custom Category</Label>
                  <Input 
                    required
                    value={form.customCategory} 
                    onChange={(e) => setForm({ ...form, customCategory: e.target.value })} 
                    placeholder="Enter custom category"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('monthly')}</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={form.amount} 
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                  placeholder="0.00"
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary">
                {tCommon('save')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {overBudgets.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('overBudget')} {overBudgets.length} {overBudgets.length === 1 ? t('category') : t('category')}!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {budgets.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground md:col-span-2">
            {t('noBudgets')}
          </Card>
        ) : (
          budgets.map((b) => {
            const sp = spent[b.category] || 0;
            const pct = Math.min((sp / Number(b.amount)) * 100, 100);
            const over = sp > Number(b.amount);
            return (
              <Card key={b.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-semibold" 
                      style={{ backgroundColor: over ? '#ef4444' : '#8b5cf6' }}
                    >
                      {b.category.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{b.category}</p>
                      <p className="text-xs text-muted-foreground">
                        ${sp.toFixed(2)} of ${Number(b.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Progress 
                  value={pct} 
                  className={over ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-yellow-500" : ""} 
                />
                <p className={`text-xs mt-2 ${over ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {over 
                    ? `Over by $${(sp - Number(b.amount)).toFixed(2)}` 
                    : `$${(Number(b.amount) - sp).toFixed(2)} remaining`
                  }
                </p>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <BudgetsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
