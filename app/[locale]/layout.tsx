import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import { AuthProvider } from "@/contexts/AuthContext";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { Toaster } from "@/components/ui/sonner";
import { Inter } from "next/font/google";
import type { Metadata } from 'next';
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://finlytic-saas.vercel.app'),
  title: {
    default: 'Finlytic - AI Finance Tracker SaaS | Smart Personal Finance Management',
    template: '%s | Finlytic'
  },
  description: 'Smart personal finance management with AI-powered insights. Track spending, create budgets, set goals, and get instant answers from your AI financial assistant. Beautiful charts, automated reports, and secure data protection.',
  keywords: [
    'personal finance',
    'finance tracker',
    'budget management',
    'expense tracker',
    'AI financial assistant',
    'money management',
    'financial planning',
    'SaaS finance tool',
    'spending tracker',
    'financial goals',
    'budget planner',
    'income tracker',
    'financial reports',
    'expense management',
    'smart budgeting'
  ],
  authors: [{ name: 'Finlytic' }],
  creator: 'Finlytic',
  publisher: 'Finlytic',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/finalitic.png',
    shortcut: '/finalitic.png',
    apple: '/finalitic.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['am_ET'],
    url: 'https://finlytic-saas.vercel.app',
    siteName: 'Finlytic',
    title: 'Finlytic - AI Finance Tracker SaaS',
    description: 'Smart personal finance management with AI-powered insights. Track spending, create budgets, and achieve financial goals.',
    images: [
      {
        url: '/finalitic.png',
        width: 1200,
        height: 630,
        alt: 'Finlytic - AI Finance Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finlytic - AI Finance Tracker SaaS',
    description: 'Smart personal finance management with AI-powered insights. Track spending, create budgets, and achieve financial goals.',
    images: ['/finalitic.png'],
    creator: '@finlytic',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code', // Add your Google Search Console verification
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
};

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Pass the locale to getMessages to load the correct translations
  const messages = await getMessages({locale});

  return (
    <html lang={locale}>
      <head>
        <link rel="icon" href="/finalitic.png" type="image/png" />
        <link rel="apple-touch-icon" href="/finalitic.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Finlytic',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web Browser',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '150',
              },
              description:
                'Smart personal finance management with AI-powered insights. Track spending, create budgets, set goals, and get instant answers from your AI financial assistant.',
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            {children}
            <FloatingAssistant />
            <Toaster />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
