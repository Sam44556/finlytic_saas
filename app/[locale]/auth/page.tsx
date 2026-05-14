"use client"

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from 'next-intl';

export default function AuthPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { user, signIn, signUp } = useAuth();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (user) {
      router.push(`/${locale}/dashboard`);
    }
  }, [user, router, locale]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, name);
      toast.success(t('createAccount'));
      router.replace(`/${locale}/dashboard`);
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success(t('welcomeBack'));
      router.replace(`/${locale}/dashboard`);
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-md">
        <Link href={`/${locale}`} className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-2xl">Finlytic</span>
        </Link>
        <Card className="p-6 shadow-elegant">
          <div className="flex gap-2 mb-6">
            <Button
              variant={!isSignUp ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIsSignUp(false)}
            >
              {t('signIn')}
            </Button>
            <Button
              variant={isSignUp ? "default" : "outline"}
              className="flex-1"
              onClick={() => setIsSignUp(true)}
            >
              {t('signUp')}
            </Button>
          </div>

          {isSignUp ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('fullName')}</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('enterFullName')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('enterEmail')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('password')}</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('enterPassword')}
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-primary"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('signUpButton')
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('enterEmail')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('password')}</Label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('enterPassword')}
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-primary"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('signInButton')
                )}
              </Button>
            </form>
          )}
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href={`/${locale}`} className="hover:text-foreground">
            ← {t('backToHome')}
          </Link>
        </p>
      </div>
    </div>
  );
}
