"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, User, Phone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PhoneUpdateModal } from "@/components/phone-update-modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [hasPhone, setHasPhone] = useState(true);
  const { data: session } = useSession();
  const t = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tPhone = useTranslations('phoneUpdate');
  const locale = useLocale();

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/user/phone')
        .then(res => res.json() as Promise<{ phone: string | null }>)
        .then(data => {
          setHasPhone(!!data.phone);
        })
        .catch(console.error);
    }
  }, [session]);

  const navItems = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('tryNow'), href: `/${locale}/try` },
    { label: tNav('pricing'), href: `/${locale}/pricing` },
    { label: tNav('services'), href: `/${locale}/services` },
    { label: tNav('contact'), href: `/${locale}/contact` },
  ];

  return (
    <>
      {session && !hasPhone && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-warning/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{tPhone('notificationMessage')}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPhoneModal(true)}
              className="ml-4"
            >
              <Phone className="h-4 w-4 mr-2" />
              {tPhone('addPhone')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/vercel.svg"
            alt="Quizy Logo"
            width={32}
            height={32}
            className="dark:invert"
          />
          <span className="text-xl font-bold">{t('appName')}</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <LanguageSwitcher />
          {session ? (
            <>
              <Button variant="ghost" asChild>
                <Link href={`/${locale}/dashboard`}>{tNav('dashboard')}</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {session.user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/dashboard`}>{tNav('dashboard')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: `/${locale}` })}
                    className="text-destructive"
                  >
                    {tNav('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href={`/${locale}/auth/signin`}>{tNav('login')}</Link>
              </Button>
              <Button asChild>
                <Link href={`/${locale}/auth/signup`}>{tNav('signup')}</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t">
          <nav className="container py-4 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md hover:bg-accent"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t">
              <LanguageSwitcher />
              {session ? (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    asChild
                  >
                    <Link href={`/${locale}/dashboard`} onClick={() => setIsMobileMenuOpen(false)}>
                      {tNav('dashboard')}
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      signOut({ callbackUrl: `/${locale}` });
                    }}
                  >
                    {tNav('logout')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    asChild
                  >
                    <Link href={`/${locale}/auth/signin`} onClick={() => setIsMobileMenuOpen(false)}>
                      {tNav('login')}
                    </Link>
                  </Button>
                  <Button
                    className="w-full justify-start"
                    asChild
                  >
                    <Link href={`/${locale}/auth/signup`} onClick={() => setIsMobileMenuOpen(false)}>
                      {tNav('signup')}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
      </header>
      <PhoneUpdateModal
        open={showPhoneModal}
        onOpenChange={setShowPhoneModal}
        onSuccess={() => {
          setHasPhone(true);
          setShowPhoneModal(false);
        }}
      />
    </>
  );
}