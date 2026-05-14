"use client"

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { profileApi } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslations } from 'next-intl';

function SettingsContent() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await profileApi.get();
      if (data) {
        setProfile(data);
        setName(data.full_name || "");
        setCurrency(data.currency || "USD");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const save = async () => {
    try {
      await profileApi.update({ full_name: name, currency });
      toast.success(t('successUpdate'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('profile')}</p>
      </div>
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>{tCommon('email')}</Label>
          <Input disabled value={user?.email || ""} />
        </div>
        <div className="space-y-2">
          <Label>{tCommon('name')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('currency')}</Label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </div>
        <div className="space-y-2">
          <Label>{t('theme')}</Label>
          <Input disabled value={profile?.subscription_tier || "free"} className="capitalize" />
        </div>
        <Button onClick={save} className="bg-gradient-primary">
          {t('saveChanges')}
        </Button>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <SettingsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
