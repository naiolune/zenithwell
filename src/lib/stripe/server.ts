import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export const STRIPE_PRICE_ID = 'price_1234567890'; // Replace with your actual price ID
