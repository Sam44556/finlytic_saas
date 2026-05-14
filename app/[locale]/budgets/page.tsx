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
import { Plus, Trash2, AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addYears, addWeeks, isAfter, isBefore } from "date-fns";
import { budgetsApi, transactionsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { useTranslations } from 'next-intl';

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: string;
  created_at: string;
}

function BudgetsContent() {
  const t = useTranslations('budgets');
  const tCommon = useTranslations('common');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [form, setForm] = useState({ category: "", customCategory: "", amount: "", period: "monthly" });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
      
      const [budgetRes, txRes] = await Promise.all([
        budgetsApi.getAll(),
        transactionsApi.getAll(),
      ]);

      setBudgets(budgetRes.data || []);

      // Calculate spent per category for selected month
      const s: Record<string, number> = {};
      (txRes.data || []).forEach((tx: any) => {
        if (tx.type === "expense" && tx.date >= monthStart && tx.date <= monthEnd && tx.category) {
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
        period: form.period,
      });
      toast.success(t('successAdd'));
      setOpen(false);
      setShowCustomCategory(false);
      setForm({ category: "", customCategory: "", amount: "", period: "monthly" });
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

  // Group budgets by period
  const weeklyBudgets = budgets.filter(b => b.period === 'weekly');
  const monthlyBudgets = budgets.filter(b => b.period === 'monthly');
  const yearlyBudgets = budgets.filter(b => b.period === 'yearly');

  // Get category icon/emoji
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Food & Dining': '🍽️',
      'Transportation': '🚗',
      'Shopping': '🛍️',
      'Entertainment': '🎬',
      'Bills & Utilities': '💡',
      'Healthcare': '🏥',
      'Education': '📚',
      'Travel': '✈️',
      'Groceries': '🛒',
      'Rent': '🏠',
      'Insurance': '🛡️',
      'Fitness': '💪',
      'Gifts': '🎁',
      'Eating out': '🍽️',
      'Other': '📌',
    };
    return icons[category] || '💰';
  };

  const renderBudgetCard = (b: Budget, period: string) => {
    const sp = spent[b.category] || 0;
    const pct = Math.min((sp / Number(b.amount)) * 100, 100);
    const remaining = Number(b.amount) - sp;
    const over = sp > Number(b.amount);
    
    // Calculate date range based on period and creation date
    let periodStart: string;
    let periodEnd: string;
    let endDate: Date;
    const createdDate = new Date(b.created_at);
    const today = new Date();
    
    if (period === 'weekly') {
      // From creation date to 1 week later
      endDate = addWeeks(createdDate, 1);
      periodStart = format(createdDate, "MM/dd/yyyy");
      periodEnd = format(endDate, "MM/dd/yyyy");
    } else if (period === 'yearly') {
      // From creation date to 1 year later
      endDate = addYears(createdDate, 1);
      periodStart = format(createdDate, "MM/dd/yyyy");
      periodEnd = format(endDate, "MM/dd/yyyy");
    } else {
      // monthly - from creation date to 1 month later (or use current month)
      endDate = endOfMonth(new Date());
      periodStart = format(startOfMonth(new Date()), "MM/dd/yyyy");
      periodEnd = format(endDate, "MM/dd/yyyy");
    }
    
    // Check if budget period has expired
    const isExpired = isAfter(today, endDate);
    
    return (
      <Card key={b.id} className={`p-6 ${isExpired ? 'opacity-60 border-2 border-dashed' : ''}`}>
        {/* Expired Badge */}
        {isExpired && (
          <div className="mb-3 px-3 py-1 bg-gray-200 text-gray-700 text-sm font-medium rounded-full inline-block">
            ⏰ Period Ended - {periodEnd}
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="h-14 w-14 rounded-full flex items-center justify-center text-2xl" 
              style={{ backgroundColor: over ? '#fee2e2' : isExpired ? '#e5e7eb' : '#f3e8ff' }}
            >
              {getCategoryIcon(b.category)}
            </div>
            <div>
              <h3 className="text-xl font-medium">{b.category}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span>{periodStart}</span>
                <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
                <span>{periodEnd}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
              <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                isExpired ? 'bg-gray-400' : over ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${pct}%` }}
            />
            {/* Black marker at budget limit */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-black"
              style={{ left: '100%', transform: 'translateX(-50%)' }}
            />
          </div>
        </div>

        {/* Amount Details */}
        <div className="flex items-center justify-between text-lg">
          <span className="text-muted-foreground">${sp.toFixed(2)}</span>
          <span className="font-medium">${Number(b.amount).toFixed(2)}</span>
        </div>

        {/* Residual Amount or Final Status */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          {isExpired ? (
            <>
              <span className="text-sm text-muted-foreground">
                {over ? 'Exceeded by:' : 'Saved:'}
              </span>
              <span className={`text-lg font-medium ${over ? 'text-red-600' : 'text-green-600'}`}>
                ${Math.abs(remaining).toFixed(2)}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {over ? 'Over budget:' : 'Residual amount:'}
              </span>
              <span className={`text-lg font-medium ${over ? 'text-red-600' : 'text-green-600'}`}>
                ${Math.abs(remaining).toFixed(2)}
              </span>
            </>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
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
                    <SelectValue placeholder="Select category">
                      {form.category || "Select category"}
                    </SelectValue>
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
                <Label>{t('period')}</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                  <SelectTrigger>
                    <SelectValue>
                      {form.period === 'weekly' ? 'Weekly' : form.period === 'monthly' ? 'Monthly' : 'Yearly'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{form.period === 'weekly' ? 'Weekly Budget' : form.period === 'monthly' ? t('monthly') : 'Yearly Budget'}</Label>
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

      <div className="space-y-8">
        {budgets.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {t('noBudgets')}
          </Card>
        ) : (
          <>
            {/* Weekly Budgets */}
            {weeklyBudgets.length > 0 && (
              <div>
                <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  Weekly Budgets
                </h2>
                <div className="space-y-4">
                  {weeklyBudgets.map((b) => renderBudgetCard(b, 'weekly'))}
                </div>
              </div>
            )}

            {/* Monthly Budgets */}
            {monthlyBudgets.length > 0 && (
              <div>
                <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
                  <span className="text-2xl">📆</span>
                  Monthly Budgets
                </h2>
                <div className="space-y-4">
                  {monthlyBudgets.map((b) => renderBudgetCard(b, 'monthly'))}
                </div>
              </div>
            )}

            {/* Yearly Budgets */}
            {yearlyBudgets.length > 0 && (
              <div>
                <h2 className="text-xl font-medium mb-4 flex items-center gap-2">
                  <span className="text-2xl">🗓️</span>
                  Yearly Budgets
                </h2>
                <div className="space-y-4">
                  {yearlyBudgets.map((b) => renderBudgetCard(b, 'yearly'))}
                </div>
              </div>
            )}
          </>
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
