"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";

interface GoogleSignInButtonProps {
  callbackUrl: string;
  text?: string;
  className?: string;
}

export function GoogleSignInButton({
  callbackUrl,
  text,
  className = ""
}: GoogleSignInButtonProps) {
  const t = useTranslations('auth');
  const buttonText = text || t('continueWithGoogle');
  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <Button
      onClick={handleGoogleSignIn}
      variant="outline"
      className={`w-full ${className}`}
      type="button"
    >
      <Chrome className="mr-2 h-4 w-4" />
      {buttonText}
    </Button>
  );
}