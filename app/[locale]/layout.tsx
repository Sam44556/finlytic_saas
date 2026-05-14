import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import { AuthProvider } from "@/contexts/AuthContext";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { Toaster } from "@/components/ui/sonner";
import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

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
