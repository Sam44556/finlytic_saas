'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Crown, Zap, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { stripeApi, profileApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function SubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) || 'en';
  const { user } = useAuth();
  const t = useTranslations('subscription');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Fetch user's current subscription
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await profileApi.get();
        setProfile(data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleCheckout = async (priceId: string, tierName: string) => {
    if (!user) {
      toast.error(t('signInFirst'));
      return;
    }

    console.log('🔍 Starting checkout:', { 
      priceId, 
      tierName, 
      userId: user.id,
      userEmail: user.email 
    });

    try {
      setLoading(tierName);
      const { url } = await stripeApi.createCheckout(priceId, user.id);
      console.log('✅ Checkout URL received:', url);
      window.location.href = url;
    } catch (error: any) {
      console.error('❌ Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
      setLoading(null);
    }
  };

  const tiers = [
    {
      name: t('proMonthly'),
      nameKey: 'pro',
      price: '$9',
      period: t('perMonth'),
      description: t('proDesc'),
      features: [
        t('proFeature1'),
        t('proFeature2'),
        t('proFeature3'),
        t('proFeature4'),
        t('proFeature5'),
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
      tier: 'pro',
      featured: true,
    },
    {
      name: t('lifetimeAccess'),
      nameKey: 'lifetime',
      price: '$199',
      period: t('oneTime'),
      description: t('lifetimeDesc'),
      features: [
        t('lifetimeFeature1'),
        t('lifetimeFeature2'),
        t('lifetimeFeature3'),
        t('lifetimeFeature4'),
        t('lifetimeFeature5'),
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME,
      tier: 'lifetime',
      featured: false,
    },
  ];

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentTier = profile?.subscription_tier || 'free';
  const subscriptionStatus = profile?.subscription_status || 'inactive';

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon('back')}
        </Button>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('subtitle')}
          </p>
          
          {/* Current Plan Badge */}
          {currentTier !== 'free' && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg">
              <Crown className="h-4 w-4" />
              <span className="font-semibold">
                {t('currentPlan')}: {currentTier === 'pro' ? t('proMonthly') : t('lifetimeAccess')}
              </span>
              {subscriptionStatus === 'past_due' && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-xs rounded-full">
                  {t('paymentFailed')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {tiers.map((tier) => {
            const isCurrentPlan = currentTier === tier.tier;
            const canUpgrade = 
              (currentTier === 'free') || 
              (currentTier === 'pro' && tier.tier === 'lifetime');
            const isDowngrade = currentTier === 'lifetime' && tier.tier === 'pro';

            return (
              <Card
                key={tier.nameKey}
                className={`p-8 relative ${
                  tier.featured
                    ? 'border-primary shadow-elegant scale-105'
                    : 'border-border'
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold px-4 py-1 rounded-full shadow-lg">
                    {t('mostPopular')}
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
                    {t('currentPlan')}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {tier.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">/{tier.period}</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleCheckout(tier.priceId!, tier.nameKey)}
                  disabled={loading === tier.nameKey || isCurrentPlan || isDowngrade}
                  className={`w-full mb-6 ${
                    tier.featured
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90'
                      : ''
                  }`}
                  variant={tier.featured ? 'default' : 'outline'}
                  size="lg"
                >
                  {loading === tier.nameKey ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('processing')}
                    </>
                  ) : isCurrentPlan ? (
                    t('currentPlanBtn')
                  ) : isDowngrade ? (
                    t('notAvailable')
                  ) : canUpgrade ? (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {currentTier === 'free' ? t('getStarted') : t('upgradeNow')}
                    </>
                  ) : (
                    t('notAvailable')
                  )}
                </Button>

                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            {t('needHelp')}
          </p>
          {currentTier === 'pro' && subscriptionStatus === 'active' && (
            <p className="text-sm text-muted-foreground mt-4">
              {t('renewalInfo')}
              <br />
              {t('cancelInfo')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
