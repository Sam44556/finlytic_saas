import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client (server-side only)
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
 * POST /api/stripe/create-checkout
 * 
 * Creates a Stripe Checkout Session for subscription or one-time payment
 * 
 * WHAT THIS DOES:
 * 1. Receives priceId (monthly or lifetime) and userId from frontend
 * 2. Gets user's email from database
 * 3. Creates or retrieves Stripe customer
 * 4. Creates Stripe Checkout Session
 * 5. Returns checkout URL to redirect user to Stripe payment page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { priceId, userId } = body;

    console.log('🔍 Checkout request received:', { priceId, userId });

    // Validate required fields
    if (!priceId || !userId) {
      console.error('❌ Missing required fields:', { priceId, userId });
      return NextResponse.json(
        { error: 'Missing priceId or userId' },
        { status: 400 }
      );
    }

    // Get user's profile from database to get email
    // Try to get all columns, but handle if Stripe columns don't exist yet
    console.log('🔍 Querying database for user:', userId);
    
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId);

    console.log('📊 Database query result:', { 
      profilesCount: profiles?.length || 0,
      error: profileError,
      firstProfile: profiles?.[0]
    });

    if (profileError) {
      console.error('❌ Profile error:', profileError);
      return NextResponse.json(
        { error: `Database error: ${profileError.message}` },
        { status: 404 }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.error('❌ No profiles found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Use the first profile if multiple exist (shouldn't happen, but handle it)
    const profile = profiles[0];

    if (!profile.email) {
      console.error('❌ Profile missing email');
      return NextResponse.json(
        { error: 'User profile missing email' },
        { status: 404 }
      );
    }

    console.log('✅ User found:', profile.email);

    // Prevent downgrade from lifetime to monthly (only if column exists)
    if (profile.subscription_tier === 'lifetime' && priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
      return NextResponse.json(
        { error: 'You already have lifetime access. No need to subscribe!' },
        { status: 400 }
      );
    }

    let customerId = profile.stripe_customer_id || null;

    // If user doesn't have a Stripe customer ID, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          supabase_user_id: userId,
        },
      });
      customerId = customer.id;

      // Save Stripe customer ID to database
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Determine if this is a subscription (monthly) or one-time payment (lifetime)
    const isSubscription = priceId === process.env.STRIPE_PRICE_PRO_MONTHLY;

    console.log('💰 Price comparison:', {
      receivedPriceId: priceId,
      envProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      envLifetime: process.env.STRIPE_PRICE_LIFETIME,
      isSubscription
    });

    // Create Stripe Checkout Session
    console.log('🔨 Creating Stripe checkout session...');

    const sessionParams: any = {
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/en?canceled=true`,
      // Metadata on the session (available in checkout.session.completed)
      metadata: {
        user_id: userId,
        price_id: priceId,
      },
    };

    // For subscriptions, also embed user_id in the subscription metadata
    // This is critical so customer.subscription.updated/deleted events
    // can identify the user even without session context
    if (isSubscription) {
      sessionParams.subscription_data = {
        metadata: {
          user_id: userId,
          price_id: priceId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Return the checkout URL to frontend
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
