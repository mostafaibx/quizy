import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/${locale}/auth/signin?callbackUrl=/${locale}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}