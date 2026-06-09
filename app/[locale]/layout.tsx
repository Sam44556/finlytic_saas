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
  title: 'Finlytic - AI Finance Tracker SaaS',
  description: 'Smart personal finance management with AI-powered insights. Track spending, create budgets, set goals, and get instant answers from your AI financial assistant.',
  icons: {
    icon: '/finalitic.png',
    shortcut: '/finalitic.png',
    apple: '/finalitic.png',
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
