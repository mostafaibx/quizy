import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header } from "@/components/header";
import { locales, localeDirections, Locale } from '@/i18n/config';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as string as Locale)) {
    notFound();
  }

  const messages = await getMessages();
  const direction = localeDirections[locale as keyof typeof localeDirections];

  return (
    <NextIntlClientProvider messages={messages}>
      <div dir={direction}>
        <Header />
        {children}
      </div>
    </NextIntlClientProvider>
  );
}