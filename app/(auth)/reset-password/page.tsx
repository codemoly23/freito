import Link from "next/link";
import { Anchor } from "lucide-react";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
              <Anchor className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">Create a new password</CardTitle>
            <CardDescription>
              Use a strong password with uppercase, lowercase, and a number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {token ? (
              <ResetPasswordForm token={token} />
            ) : (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Reset token is missing. Request a new password reset link.
              </div>
            )}
            <Link
              href="/login"
              className="block text-center text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </section>

      <section
        aria-label="FreightFast System hero"
        className="hidden min-h-screen bg-slate-950 lg:block"
        style={{
          backgroundImage: "url('/images/login-freight-hero.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <span className="sr-only">
          Welcome to FreightFast System. Smarter freight forwarding, faster
          operations, full control.
        </span>
      </section>
    </main>
  );
}
