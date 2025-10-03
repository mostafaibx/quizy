import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
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