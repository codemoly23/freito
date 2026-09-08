import Link from "next/link";
import { Anchor } from "lucide-react";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
              <Anchor className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">Reset your password</CardTitle>
            <CardDescription>
              Enter your work email. If an active account exists, a reset link
              will be prepared.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ForgotPasswordForm />
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
        aria-label="Freito System hero"
        className="hidden min-h-screen bg-slate-950 lg:block"
        style={{
          backgroundImage: "url('/images/login-freight-hero.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <span className="sr-only">
          Welcome to Freito System. Smarter freight forwarding, faster
          operations, full control.
        </span>
      </section>
    </main>
  );
}
