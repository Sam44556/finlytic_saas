"use client"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { goalsApi } from "@/lib/api-client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslations } from 'next-intl';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

function GoalsContent() {
  const t = useTranslations('goals');
  const tCommon = useTranslations('common');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", target_amount: "", current_amount: "0", deadline: "" });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const { data } = await goalsApi.getAll();
      setGoals(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await goalsApi.create({
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount || 0),
        deadline: form.deadline || null,
      });
      toast.success(t('successAdd'));
      setOpen(false);
      setForm({ name: "", target_amount: "", current_amount: "0", deadline: "" });
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateAmount = async (id: string, current: number) => {
    const v = prompt(t('addAmount') + ":", String(current));
    if (v === null) return;
    try {
      await goalsApi.update(id, { current_amount: Number(v) });
      toast.success(t('successEdit'));
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await goalsApi.delete(id);
      toast.success(t('successDelete'));
      load();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('startSaving')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="h-4 w-4" />
              {t('addNew')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addNew')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('name')}</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emergency fund" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('targetAmount')}</Label>
                  <Input type="number" step="0.01" required value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('currentAmount')}</Label>
                  <Input type="number" step="0.01" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('deadline')} ({tCommon('optional')})</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary">
                {t('addNew')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {goals.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground md:col-span-2">{t('noGoals')}</Card>
        ) : (
          goals.map((g) => {
            const pct = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100);
            return (
              <Card key={g.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Target className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${Number(g.current_amount).toFixed(2)} of ${Number(g.target_amount).toFixed(2)}
                        {g.deadline ? ` • by ${format(new Date(g.deadline), "MMM d, yyyy")}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(g.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Progress value={pct} />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm font-medium">{pct.toFixed(0)}% {t('progress')}</span>
                  <Button size="sm" variant="outline" onClick={() => updateAmount(g.id, Number(g.current_amount))}>
                    {t('updateProgress')}
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function GoalsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <GoalsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
