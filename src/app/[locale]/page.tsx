import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FileText, LogIn, Upload, Brain, Zap } from "lucide-react";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);
  const t = await getTranslations('landing');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Hero Section */}
      <section className="container py-12 md:py-24">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="space-y-4 max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              {t('heroTitle')}
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl">
              {t('heroDescription')}
            </p>
          </div>

          <div className="flex gap-4">
            {session ? (
              <Link href={`/${locale}/dashboard`}>
                <Button size="lg" className="font-semibold">
                  <Upload className="w-5 h-5 mr-2" />
                  {t('goToDashboard')}
                </Button>
              </Link>
            ) : (
              <>
                <Link href={`/${locale}/auth/signup`}>
                  <Button size="lg" className="font-semibold">
                    {t('getStarted')}
                  </Button>
                </Link>
                <Link href={`/${locale}/auth/signin`}>
                  <Button size="lg" variant="outline">
                    <LogIn className="w-5 h-5 mr-2" />
                    {t('signIn')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-12 md:py-20 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            {t('featuresTitle')}
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 rounded-full bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{t('feature1Title')}</h3>
            <p className="text-muted-foreground">
              {t('feature1Description')}
            </p>
          </div>

          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 rounded-full bg-primary/10">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{t('feature2Title')}</h3>
            <p className="text-muted-foreground">
              {t('feature2Description')}
            </p>
          </div>

          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 rounded-full bg-primary/10">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{t('feature3Title')}</h3>
            <p className="text-muted-foreground">
              {t('feature3Description')}
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container py-12 md:py-20 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            {t('howItWorksTitle')}
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              1
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{t('step1Title')}</h3>
              <p className="text-muted-foreground">{t('step1Description')}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              2
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{t('step2Title')}</h3>
              <p className="text-muted-foreground">{t('step2Description')}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              3
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{t('step3Title')}</h3>
              <p className="text-muted-foreground">{t('step3Description')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!session && (
        <section className="container py-12 md:py-20 border-t">
          <div className="bg-muted rounded-lg p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-4">
              {t('ctaTitle')}
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              {t('ctaDescription')}
            </p>
            <Link href={`/${locale}/auth/signup`}>
              <Button size="lg" className="font-semibold">
                {t('ctaButton')}
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}