# Stripe Quick Reference - ZenithWell

## 🔑 Required Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 📦 Product Configuration

**Product Name**: ZenithWell Pro Subscription  
**Price**: $29.00/month  
**Price ID**: `price_...` (copy from Stripe Dashboard)

## 🔗 Webhook Events Required

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 🧪 Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

## 🚀 Quick Test Steps

1. Update `.env.local` with your Stripe keys
2. Update `STRIPE_PRICE_ID` in `src/lib/stripe/server.ts`
3. Start app: `npm run dev`
4. Try upgrade to Pro with test card
5. Check Stripe Dashboard for payment

## 🔧 Local Webhook Setup

```bash
# Using ngrok
npm install -g ngrok
npm run dev
ngrok http 3001
# Use ngrok URL for webhook endpoint
```

## 📍 Key Files to Update

- `.env.local` - Environment variables
- `src/lib/stripe/server.ts` - Price ID
- Webhook endpoint: `/api/stripe/webhook`

## ⚠️ Common Issues

- **Webhook not working**: Check URL accessibility and secret
- **Payment fails**: Verify API keys and price ID
- **Subscription not updating**: Check webhook handler and database
