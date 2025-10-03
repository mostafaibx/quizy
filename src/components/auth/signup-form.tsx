"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { User, Mail, Lock, KeyRound, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SignUpRequest, SignUpResponse } from "@/types/auth.types";

interface SignUpFormProps {
  callbackUrl: string;
  onError: (error: string) => void;
}

export function SignUpForm({ callbackUrl, onError }: SignUpFormProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('auth');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (): boolean => {
    if (password !== confirmPassword) {
      onError(t('passwordsDoNotMatch'));
      return false;
    }
    if (password.length < 8) {
      onError(t('passwordTooShort'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    onError("");

    if (!validatePassword()) {
      setIsLoading(false);
      return;
    }

    try {
      const signUpData: SignUpRequest = { email, password, name, phone };
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signUpData),
      });

      const data = await response.json() as SignUpResponse;

      if (!response.ok) {
        onError(data.error || t('failedToCreateAccount'));
      } else {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          onError(t('accountCreatedButFailedSignIn'));
        } else {
          router.push(callbackUrl || `/${locale}/dashboard`);
          router.refresh();
        }
      }
    } catch {
      onError(t('anErrorOccurred'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {t('name')}
        </Label>
        <Input
          id="name"
          type="text"
          placeholder={t('namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {t('email')}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          {t('phone')}
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder={t('phonePlaceholder')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          {t('password')}
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          {t('confirmPassword')}
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? t('creatingAccount') : t('signupButton')}
      </Button>
    </form>
  );
}