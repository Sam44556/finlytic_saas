import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * POST /api/stripe/cancel-subscription
 * 
 * Cancels user's monthly subscription
 * 
 * WHAT THIS DOES:
 * 1. Gets user's subscription_id from database
 * 2. Calls Stripe API to cancel subscription
 * 3. Stripe sends webhook to update database
 * 4. User is downgraded to free tier
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Get user's subscription ID from database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_subscription_id, subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has a subscription to cancel
    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Lifetime users cannot cancel (they paid once)
    if (profile.subscription_tier === 'lifetime') {
      return NextResponse.json(
        { error: 'Lifetime subscriptions cannot be canceled' },
        { status: 400 }
      );
    }

    // Cancel subscription in Stripe
    // cancel_at_period_end: true = User keeps access until end of billing period
    // cancel_at_period_end: false = User loses access immediately
    const subscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        cancel_at_period_end: true, // Let them use it until month ends
      }
    );

    // Stripe will send webhook when subscription actually ends
    // Webhook will update database to downgrade user to free

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancel_at: subscription.cancel_at,
    });

  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
