"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { ErrorAlert } from "@/components/auth/error-alert";
import { Divider } from "@/components/auth/divider";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";

function SignInForm() {
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params.locale as string;
  const callbackUrl = searchParams.get("callbackUrl") || `/${locale}/dashboard`;
  const tAuth = useTranslations('auth');
  const tNav = useTranslations('navigation');
  const [error, setError] = useState("");

  return (
    <AuthCard
      title={tAuth('loginTitle')}
      description={tAuth('loginDescription')}
      footerText={tAuth('noAccount')}
      footerLinkText={tNav('signup')}
      footerLinkHref={`/auth/signup`}
      locale={locale}
    >
      <ErrorAlert message={error} />
      <GoogleSignInButton callbackUrl={callbackUrl} />
      <Divider />
      <CredentialsForm callbackUrl={callbackUrl} onError={setError} />
    </AuthCard>
  );
}

export default function SignInPage() {
  const t = useTranslations('common');
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">{t('loading')}</div>
          </CardContent>
        </Card>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}