'use client';

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wallet, BarChart3, Bot, Shield, Zap, Check, ArrowRight, TrendingUp, Target } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from 'next-intl';
import { useAuth } from "@/contexts/AuthContext";
import { stripeApi } from "@/lib/api-client";
import { toast } from "sonner";
import { useState } from "react";

export default function LandingPage() {
  const t = useTranslations('landing');
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  
  const features = [
    { icon: BarChart3, titleKey: "feature1Title", descKey: "feature1Desc" },
    { icon: TrendingUp, titleKey: "feature2Title", descKey: "feature2Desc" },
    { icon: Target, titleKey: "feature3Title", descKey: "feature3Desc" },
    { icon: Bot, titleKey: "feature4Title", descKey: "feature4Desc" },
    { icon: Shield, titleKey: "feature5Title", descKey: "feature5Desc" },
    { icon: Zap, titleKey: "feature6Title", descKey: "feature6Desc" },
  ];

  const tiers = [
    { 
      nameKey: "pricingFreeName", 
      price: "$0", 
      descKey: "pricingFreeDesc", 
      featuresKeys: ["pricingFreeFeature1", "pricingFreeFeature2", "pricingFreeFeature3", "pricingFreeFeature4"], 
      ctaKey: "pricingFreeCta",
      priceId: null,
    },
    { 
      nameKey: "pricingProName", 
      price: "$9", 
      period: "/mo", 
      descKey: "pricingProDesc", 
      featuresKeys: ["pricingProFeature1", "pricingProFeature2", "pricingProFeature3", "pricingProFeature4", "pricingProFeature5"], 
      ctaKey: "pricingProCta", 
      featured: true,
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
    },
    { 
      nameKey: "pricingLifetimeName", 
      price: "$199", 
      descKey: "pricingLifetimeDesc", 
      featuresKeys: ["pricingLifetimeFeature1", "pricingLifetimeFeature2", "pricingLifetimeFeature3", "pricingLifetimeFeature4"], 
      ctaKey: "pricingLifetimeCta",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME,
    },
  ];

  /**
   * Handle checkout button click
   * 
   * WHAT THIS DOES:
   * 1. Check if user is logged in
   * 2. If not logged in, redirect to auth page
   * 3. If logged in, call API to create Stripe checkout session
   * 4. Redirect user to Stripe payment page
   */
  const handleCheckout = async (priceId: string | null, tierName: string) => {
    // Free tier - just redirect to signup
    if (!priceId) {
      window.location.href = `/${locale}/auth`;
      return;
    }

    // Check if user is logged in
    if (!user) {
      toast.error('Please sign in first');
      window.location.href = `/${locale}/auth`;
      return;
    }

    try {
      setLoading(tierName);
      
      // Call API to create checkout session
      const { url } = await stripeApi.createCheckout(priceId, user.id);
      
      // Redirect to Stripe checkout page
      window.location.href = url;
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
      setLoading(null);
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 z-40 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Finlytic</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground">{t('features')}</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">{t('pricing')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" asChild><Link href={`/${locale}/auth`}>{t('signIn')}</Link></Button>
            <Button asChild className="bg-gradient-primary hover:opacity-90"><Link href={`/${locale}/auth`}>{t('getStarted')}</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="container mx-auto relative py-20 md:py-32 text-center px-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm shadow-card mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span>{t('tagline')}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            {t('hero')}<br />
            <span className="text-gradient">{t('heroHighlight')}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('heroDesc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild className="bg-gradient-primary hover:opacity-90 shadow-elegant">
              <Link href={`/${locale}/auth`}>{t('startFree')} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild><a href="#features">{t('seeFeatures')}</a></Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{t('everythingYouNeed')}</h2>
          <p className="text-muted-foreground">{t('powerfulTools')}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, idx) => (
            <Card key={idx} className="p-6 hover:shadow-elegant transition-shadow">
              <div className="h-11 w-11 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{t(f.titleKey)}</h3>
              <p className="text-muted-foreground text-sm">{t(f.descKey)}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{t('simplePricing')}</h2>
          <p className="text-muted-foreground">{t('freeForever')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier, idx) => (
            <Card key={idx} className={`p-8 relative ${tier.featured ? "border-primary shadow-elegant scale-105" : ""}`}>
              {tier.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">{t('mostPopular')}</div>}
              <h3 className="font-semibold text-lg">{t(tier.nameKey)}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t(tier.descKey)}</p>
              <div className="mb-6"><span className="text-4xl font-bold">{tier.price}</span><span className="text-muted-foreground">{tier.period}</span></div>
              <Button 
                onClick={() => handleCheckout(tier.priceId || null, tier.nameKey)}
                disabled={loading === tier.nameKey}
                className={`w-full mb-6 ${tier.featured ? "bg-gradient-primary" : ""}`} 
                variant={tier.featured ? "default" : "outline"}
              >
                {loading === tier.nameKey ? 'Loading...' : t(tier.ctaKey)}
              </Button>
              <ul className="space-y-2.5 text-sm">
                {tier.featuresKeys.map((fKey, i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" />{t(fKey)}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 Finlytic. {t('footer')}
      </footer>
    </div>
  );
}
