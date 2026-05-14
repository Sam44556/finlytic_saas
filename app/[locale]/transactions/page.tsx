"use client"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { transactionsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getCategoriesByType } from "@/lib/categories";
import { useTranslations } from 'next-intl';

interface Tx {
  id: string;
  amount: number;
  type: string;
  date: string;
  description: string | null;
  category: string | null;
}

function TransactionsContent() {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const [txns, setTxns] = useState<Tx[]>([]);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    type: "expense",
    category: "",
    customCategory: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const txRes = await transactionsApi.getAll();
      setTxns(txRes.data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openNew = () => {
    setEditing(null);
    setShowCustomCategory(false);
    setForm({ 
      amount: "", 
      type: "expense", 
      category: "", 
      customCategory: "",
      description: "", 
      date: format(new Date(), "yyyy-MM-dd") 
    });
    setOpen(true);
  };

  const openEdit = (t: Tx) => {
    setEditing(t);
    const categories = getCategoriesByType(t.type as 'income' | 'expense');
    const isCustom = t.category && !categories.includes(t.category);
    
    setShowCustomCategory(isCustom);
    setForm({ 
      amount: String(t.amount), 
      type: t.type, 
      category: isCustom ? "Other" : (t.category || ""), 
      customCategory: isCustom ? (t.category || "") : "",
      description: t.description || "", 
      date: t.date 
    });
    setOpen(true);
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
    
    // Determine final category value
    const finalCategory = form.category === "Other" ? form.customCategory : form.category;
    
    if (form.category === "Other" && !form.customCategory.trim()) {
      toast.error("Please enter a custom category");
      return;
    }
    
    try {
      const payload = {
        amount: Number(form.amount),
        type: form.type,
        category: finalCategory || null,
        description: form.description || null,
        date: form.date,
      };
      
      if (editing) {
        await transactionsApi.update(editing.id, payload);
        toast.success(t('successEdit'));
      } else {
        await transactionsApi.create(payload);
        toast.success(t('successAdd'));
      }
      setOpen(false);
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await transactionsApi.delete(id);
      toast.success(t('successDelete'));
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filtered = filter === "all" ? txns : txns.filter((t) => t.type === filter);
  
  // Filter by current month
  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const monthFiltered = filtered.filter((t) => t.date >= monthStart && t.date <= monthEnd);
  
  // Calculate totals for the month
  const monthIncome = monthFiltered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const monthExpenses = monthFiltered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const monthTotal = monthIncome - monthExpenses;
  
  const availableCategories = getCategoriesByType(form.type as 'income' | 'expense');

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToCurrentMonth = () => setCurrentMonth(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('startTracking')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              {t('addNew')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? t('editTransaction') : t('addNew')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('type')}</Label>
                  <Select 
                    value={form.type} 
                    onValueChange={(v) => setForm({ ...form, type: v, category: "", customCategory: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('type')}>
                        {form.type === 'income' ? t('income') : t('expense')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{t('expense')}</SelectItem>
                      <SelectItem value="income">{t('income')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('amount')}</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={form.amount} 
                    onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>{t('category')}</Label>
                <Select value={form.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('category')}>
                      {form.category || t('category')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showCustomCategory && (
                <div className="space-y-2">
                  <Label>{t('category')}</Label>
                  <Input 
                    required
                    value={form.customCategory} 
                    onChange={(e) => setForm({ ...form, customCategory: e.target.value })} 
                    placeholder="Enter custom category"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>{t('description')} ({tCommon('optional')})</Label>
                <Input 
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                  placeholder="e.g., Lunch at restaurant" 
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('date')}</Label>
                <Input 
                  type="date" 
                  required 
                  value={form.date} 
                  onChange={(e) => setForm({ ...form, date: e.target.value })} 
                />
              </div>
              
              <Button type="submit" className="w-full bg-gradient-primary">
                {editing ? tCommon('save') : t('addNew')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Month Navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">{format(currentMonth, "MMMM yyyy")}</h2>
            {format(currentMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM") && (
              <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
                Today
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      {/* Summary Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Transactions:</span>
            <span className="font-medium">{monthFiltered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total:</span>
            <span className={`text-xl font-semibold ${monthTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(monthTotal).toFixed(2)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Income</p>
            <p className="text-lg font-medium text-green-600">+${monthIncome.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-lg font-medium text-red-600">-${monthExpenses.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        {(["all", "income", "expense"] as const).map((f) => (
          <Button 
            key={f} 
            size="sm" 
            variant={filter === f ? "default" : "outline"} 
            onClick={() => setFilter(f)} 
            className="capitalize"
          >
            {f === 'all' ? t('allTypes') : f === 'income' ? t('income') : t('expense')}
          </Button>
        ))}
      </div>

      <Card className="divide-y">
        {monthFiltered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {t('noTransactions')}
          </div>
        ) : (
          monthFiltered.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4 hover:bg-accent/5">
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-white font-medium" 
                  style={{ backgroundColor: t.type === 'income' ? '#10b981' : '#8b5cf6' }}
                >
                  {t.type === 'income' ? '+' : '-'}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.description || t.category || "Transaction"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category || "Uncategorized"} • {format(new Date(t.date), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                  {t.type === "income" ? "+" : "-"}${Number(t.amount).toFixed(2)}
                </span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TransactionsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
