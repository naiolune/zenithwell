# ZenithWell - AI-Powered Mental Wellness Platform

A comprehensive AI-powered mental wellness platform built with Next.js, Supabase, and Stripe. Features multiple AI providers, group wellness sessions, progress tracking, and subscription management.

## 🚀 Features

### Core Features
- **AI Wellness Support**: Multiple AI providers (OpenAI, Anthropic, Perplexity)
- **Individual Sessions**: One-on-one AI wellness coaching with streaming responses
- **Group Wellness**: Invite family and friends for collaborative wellness sessions (Pro feature)
- **Progress Tracking**: Automatic session summarization and wellness journey tracking
- **Subscription Management**: Free and Pro tiers with Stripe integration
- **Admin Panel**: Configure AI providers and manage the platform

### Technical Features
- **Real-time Chat**: Streaming AI responses for natural conversation
- **Secure Authentication**: Supabase Auth with protected routes
- **Database Security**: Row Level Security (RLS) policies
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Type Safety**: Full TypeScript implementation

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **AI Providers**: OpenAI, Anthropic, Perplexity
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Stripe account
- AI provider API keys (OpenAI, Anthropic, or Perplexity)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd therapy
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### 4. Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor
3. This will create all necessary tables and RLS policies

### 5. Stripe Setup

1. Create a Stripe account
2. Get your API keys from the Stripe dashboard
3. Create a product and price for the Pro subscription
4. Update the `STRIPE_PRICE_ID` in `src/lib/stripe/server.ts`

### 6. AI Provider Setup

1. Get API keys from your chosen AI providers
2. Access the admin panel at `/admin/ai-config`
3. Add your AI provider configurations
4. Set one as active

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📁 Project Structure

```
therapy/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Authentication pages
│   │   ├── (dashboard)/      # Main application pages
│   │   ├── admin/            # Admin panel
│   │   ├── api/              # API routes
│   │   └── page.tsx          # Landing page
│   ├── components/
│   │   └── ui/               # Reusable UI components
│   ├── lib/
│   │   ├── ai-providers/     # AI provider implementations
│   │   ├── supabase/         # Supabase client configuration
│   │   ├── stripe/           # Stripe configuration
│   │   └── subscription.ts   # Subscription utilities
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── supabase-schema.sql       # Database schema
└── README.md
```

## 🔧 Configuration

### AI Providers

The platform supports three AI providers:

1. **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
2. **Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus
3. **Perplexity**: Llama 3.1 Sonar models

Configure providers through the admin panel at `/admin/ai-config`.

### Subscription Tiers

- **Free**: 3 sessions/month, basic features
- **Pro**: Unlimited sessions, group wellness, advanced features

### Feature Gating

Pro features are automatically gated based on subscription status:
- Group wellness sessions
- Unlimited wellness sessions
- Session export
- Advanced analytics
- Priority support

## 🔒 Security

- **Row Level Security**: All database tables have RLS policies
- **Authentication**: Supabase Auth with protected routes
- **API Security**: Server-side validation and authorization
- **Data Privacy**: HIPAA-compliant data handling practices

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 📊 Database Schema

### Core Tables

- `users`: User profiles and subscription tiers
- `ai_config`: AI provider configurations
- `therapy_sessions`: Individual and group sessions
- `session_messages`: Chat messages
- `session_participants`: Group session participants
- `conversation_memory`: Session summaries and insights
- `subscriptions`: Stripe subscription data

## 🔄 API Routes

- `POST /api/chat`: Send messages to AI
- `POST /api/summarize`: Generate session summaries
- `POST /api/stripe/checkout`: Create Stripe checkout session
- `POST /api/stripe/webhook`: Handle Stripe webhooks

## 🎨 UI Components

Built with shadcn/ui components:
- Button, Card, Badge
- Form inputs and validation
- Responsive layouts
- Dark/light theme support

## 📱 Mobile Support

- Responsive design for all screen sizes
- Touch-friendly interface
- Mobile-optimized chat experience

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code comments

## 🔮 Future Enhancements

- [ ] Voice chat support
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Therapist marketplace
- [ ] Integration with health apps
- [ ] Multi-language support
- [ ] Advanced AI models
- [ ] Video therapy sessions

---

Built with ❤️ for better mental health