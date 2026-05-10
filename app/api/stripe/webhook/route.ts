import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Supabase Admin Client
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
 * POST /api/stripe/webhook
 * 
 * Receives events from Stripe when payments succeed, fail, or subscriptions change
 * 
 * WHAT THIS DOES:
 * 1. Verifies the webhook signature (ensures request is really from Stripe)
 * 2. Handles different event types:
 *    - checkout.session.completed: User completed payment
 *    - customer.subscription.updated: Subscription status changed
 *    - customer.subscription.deleted: Subscription canceled
 *    - invoice.payment_failed: Monthly payment failed
 * 3. Updates database with new subscription status
 */

// Test endpoint - just to verify webhook is accessible
export async function GET() {
  return NextResponse.json({ 
    message: 'Webhook endpoint is working! Use POST to send webhook events.',
    webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET
  });
}

export async function POST(request: NextRequest) {
  console.log('🔔 Webhook received!');
  
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  console.log('📦 Webhook data:', {
    bodyLength: body.length,
    hasSignature: !!signature,
    timestamp: new Date().toISOString()
  });

  if (!signature) {
    console.error('❌ No signature in webhook request');
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature (security check)
    console.log('🔐 Verifying webhook signature...');
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log('✅ Signature verified! Event type:', event.type);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log('📨 Processing event:', {
    type: event.type,
    id: event.id,
    created: new Date(event.created * 1000).toISOString()
  });

  // Handle different event types
  try {
    console.log('🔄 Handling event type:', event.type);
    
    switch (event.type) {
      // When user completes checkout (first payment)
      case 'checkout.session.completed': {
        console.log('💳 Checkout session completed!');
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Session data:', {
          customer: session.customer,
          subscription: session.subscription,
          payment_status: session.payment_status
        });
        await handleCheckoutCompleted(session);
        break;
      }

      // When monthly payment succeeds (renewal)
      case 'invoice.payment_succeeded': {
        console.log('💰 Invoice payment succeeded!');
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      // When subscription status changes (renewal, cancellation, etc.)
      case 'customer.subscription.updated': {
        console.log('🔄 Subscription updated!');
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      // When subscription is deleted/canceled
      case 'customer.subscription.deleted': {
        console.log('❌ Subscription deleted!');
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      // When monthly payment fails
      case 'invoice.payment_failed': {
        console.log('⚠️ Invoice payment failed!');
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful payment (monthly renewal)
 * Ensures subscription stays active
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Skip if this is the first payment (handled by checkout.session.completed)
  if (invoice.billing_reason === 'subscription_create') {
    return;
  }

  // Find user by Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    console.error('No user found for customer:', customerId);
    return;
  }

  // Ensure subscription is active (in case it was past_due)
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'active',
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Failed to update payment status:', error);
  } else {
    console.log(`✅ Payment succeeded for user ${profile.id}`);
  }
}

/**
 * Handle successful checkout completion
 * Updates user's subscription tier and status in database
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('🎯 handleCheckoutCompleted called');
  console.log('📋 Session metadata:', session.metadata);
  console.log('👤 Customer:', session.customer);
  console.log('📝 Subscription:', session.subscription);
  console.log('💰 Payment status:', session.payment_status);
  
  const userId = session.metadata?.user_id;
  const priceId = session.metadata?.price_id;

  console.log('🔍 Extracted data:', { userId, priceId });

  if (!userId) {
    console.error('❌ No user_id in session metadata - CANNOT UPDATE DATABASE');
    console.error('📦 Full session object:', JSON.stringify(session, null, 2));
    return;
  }

  console.log('✅ User ID found, querying database...');

  // Get user's current subscription status
  const { data: profile, error: queryError } = await supabaseAdmin
    .from('profiles')
    .select('stripe_subscription_id, subscription_tier')
    .eq('id', userId)
    .single();

  console.log('📊 Profile query result:', { profile, queryError });

  // Determine subscription tier based on price ID
  let subscriptionTier: 'pro' | 'lifetime' = 'pro';
  if (priceId === process.env.STRIPE_PRICE_LIFETIME) {
    subscriptionTier = 'lifetime';
  }

  console.log('🎫 Subscription tier determined:', subscriptionTier);

  // Update database
  const updateData: any = {
    subscription_tier: subscriptionTier,
    subscription_status: 'active',
    stripe_customer_id: session.customer as string,
  };

  // If it's a subscription (monthly), save subscription ID
  if (session.subscription) {
    updateData.stripe_subscription_id = session.subscription as string;
    console.log('💳 Adding subscription ID to update:', session.subscription);
  }

  console.log('📝 Update data prepared:', updateData);

  // If upgrading to lifetime and user has active monthly subscription, cancel it
  if (subscriptionTier === 'lifetime' && profile?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      console.log(`🔄 Canceled monthly subscription ${profile.stripe_subscription_id} - User upgraded to lifetime`);
      // Clear subscription ID since it's canceled
      updateData.stripe_subscription_id = null;
    } catch (error) {
      console.error('Failed to cancel old subscription:', error);
    }
  }

  console.log('🚀 Updating database...');
  const { error, data: updatedProfile } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select();

  console.log('📊 Update result:', { error, updatedProfile });

  if (error) {
    console.error('❌ Failed to update profile:', error);
  } else {
    console.log(`✅ User ${userId} upgraded to ${subscriptionTier}`);
    console.log('✅ Updated profile data:', updatedProfile);
  }
}

/**
 * Handle subscription updates (renewals, plan changes)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Try to find user by Stripe customer ID first
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  // Fallback: look up by user_id stored in subscription metadata
  if (!profile && subscription.metadata?.user_id) {
    const { data: metaProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', subscription.metadata.user_id)
      .single();
    profile = metaProfile;
  }

  if (!profile) {
    console.error('No user found for customer:', customerId);
    return;
  }

  // Map Stripe status to our status
  let status: 'active' | 'inactive' | 'canceled' | 'past_due' = 'active';
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    status = 'canceled';
  } else if (subscription.status === 'past_due') {
    status = 'past_due';
  }

  // Update database
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: status,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId, // ensure customer ID is always saved
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Failed to update subscription:', error);
  } else {
    console.log(`✅ Subscription updated for user ${profile.id}: ${status}`);
  }
}

/**
 * Handle subscription deletion/cancellation
 * Downgrade user to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Try to find user by Stripe customer ID first
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  // Fallback: look up by user_id stored in subscription metadata
  if (!profile && subscription.metadata?.user_id) {
    const { data: metaProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', subscription.metadata.user_id)
      .single();
    profile = metaProfile;
  }

  if (!profile) {
    console.error('No user found for customer:', customerId);
    return;
  }

  // Downgrade to free tier
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Failed to downgrade user:', error);
  } else {
    console.log(`✅ User ${profile.id} downgraded to free`);
  }
}

/**
 * Handle failed payment
 * Mark subscription as past_due
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find user by Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    console.error('No user found for customer:', customerId);
    return;
  }

  // Mark as past_due (payment failed but Stripe is retrying)
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Failed to update payment status:', error);
  } else {
    console.log(`⚠️ Payment failed for user ${profile.id}`);
  }
}
