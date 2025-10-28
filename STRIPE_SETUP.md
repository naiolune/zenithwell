# Stripe Setup Guide for ZenithWell

This guide will walk you through setting up Stripe payments for the ZenithWell AI wellness platform.

## 🚀 Quick Setup Overview

1. Create Stripe account
2. Get API keys
3. Create products and prices
4. Configure webhooks
5. Update environment variables
6. Test the integration

## 📋 Step-by-Step Setup

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Click "Start now" or "Sign up"
3. Fill in your business information:
   - Business name: "ZenithWell" (or your company name)
   - Business type: "Software/SaaS"
   - Country: Select your country
   - Business website: Your domain (can be localhost for testing)

### 2. Get API Keys

1. In your Stripe Dashboard, go to **Developers** → **API Keys**
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_` for test mode)
   - **Secret key** (starts with `sk_test_` for test mode)

3. Copy both keys - you'll need them for your environment variables

### 3. Create Products and Prices

#### Create the Pro Subscription Product

1. Go to **Products** in your Stripe Dashboard
2. Click **"Add product"**
3. Fill in the product details:
   - **Name**: "ZenithWell Pro Subscription"
   - **Description**: "Unlimited AI wellness sessions, group wellness, and advanced features"
   - **Pricing model**: "Recurring"
   - **Price**: $29.00 USD
   - **Billing period**: Monthly

4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_`) - you'll need this

#### Optional: Create Annual Plan

1. Create another product for annual billing:
   - **Name**: "ZenithWell Pro Annual"
   - **Price**: $290.00 USD (10 months for the price of 12)
   - **Billing period**: Yearly

### 4. Configure Webhooks

Webhooks are essential for handling subscription events automatically.

#### Create Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. **Endpoint URL**: `https://yourdomain.com/api/stripe/webhook`
   - For local development: `https://your-ngrok-url.ngrok.io/api/stripe/webhook`
4. **Events to send**: Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Click **"Add endpoint"**
6. Copy the **Webhook signing secret** (starts with `whsec_`)

### 5. Update Environment Variables

Update your `.env.local` file with the Stripe keys:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
```

### 6. Update Price ID in Code

Update the price ID in your code:

**File**: `src/lib/stripe/server.ts`
```typescript
export const STRIPE_PRICE_ID = 'price_your_actual_price_id_here'; // Replace with your actual price ID
```

## 🧪 Testing the Integration

### Test Mode Setup

1. Make sure you're in **Test mode** in Stripe Dashboard (toggle in top-left)
2. Use test card numbers for testing:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - **Requires authentication**: `4000 0025 0000 3155`

### Test the Flow

1. Start your development server: `npm run dev`
2. Go to your app and try to upgrade to Pro
3. Use test card `4242 4242 4242 4242` with any future date and CVC
4. Check your Stripe Dashboard for the test payment
5. Verify the user's subscription status in your app

## 🔧 Local Development with Webhooks

For local development, you'll need to expose your local server to the internet so Stripe can send webhooks.

### Using ngrok (Recommended)

1. Install ngrok: `npm install -g ngrok`
2. Start your Next.js app: `npm run dev`
3. In another terminal, run: `ngrok http 3001`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Use this URL for your webhook endpoint: `https://abc123.ngrok.io/api/stripe/webhook`

### Using Stripe CLI (Alternative)

1. Install Stripe CLI from [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:3001/api/stripe/webhook`
4. Use the webhook secret provided by the CLI

## 🚀 Production Setup

### 1. Switch to Live Mode

1. In Stripe Dashboard, toggle to **Live mode**
2. Get your live API keys
3. Update environment variables with live keys
4. Create live products and prices

### 2. Update Webhook Endpoint

1. Update webhook URL to your production domain
2. Test the webhook endpoint
3. Monitor webhook delivery in Stripe Dashboard

### 3. Security Considerations

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Enable webhook signature verification
- Monitor failed webhook deliveries

## 📊 Monitoring and Analytics

### Stripe Dashboard

Monitor your payments and subscriptions:
- **Payments**: View all transactions
- **Customers**: Manage customer data
- **Subscriptions**: Track active subscriptions
- **Webhooks**: Monitor webhook delivery

### Key Metrics to Track

- Monthly Recurring Revenue (MRR)
- Customer acquisition cost
- Churn rate
- Average revenue per user (ARPU)

## 🔍 Troubleshooting

### Common Issues

#### Webhook Not Receiving Events
- Check webhook URL is accessible
- Verify webhook secret is correct
- Check webhook event types are selected
- Look at webhook delivery logs in Stripe Dashboard

#### Payment Fails
- Verify API keys are correct
- Check if you're using test/live mode correctly
- Verify price ID exists and is active
- Check customer email is valid

#### Subscription Not Updating
- Check webhook handler code
- Verify database connection
- Check RLS policies in Supabase
- Look at server logs for errors

### Debug Mode

Enable debug logging in your webhook handler:

```typescript
// In src/app/api/stripe/webhook/route.ts
console.log('Webhook received:', event.type);
console.log('Event data:', event.data.object);
```

## 📚 Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Next.js Stripe Integration](https://stripe.com/docs/payments/accept-a-payment?platform=nextjs)
- [Webhook Testing](https://stripe.com/docs/webhooks/test)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

## 🎯 Next Steps

After completing this setup:

1. Test all payment flows thoroughly
2. Set up monitoring and alerts
3. Create customer support processes
4. Plan for subscription management features
5. Consider adding more payment methods

## 📞 Support

If you encounter issues:

1. Check Stripe Dashboard for error details
2. Review webhook delivery logs
3. Check your application logs
4. Consult Stripe documentation
5. Contact Stripe support if needed

---

**Remember**: Always test thoroughly in test mode before going live!
