import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validators/auth";

const loginScopes = ["PLATFORM", "COMPANY", "CLIENT"] as const;

type LoginScope = (typeof loginScopes)[number];

function isLoginScope(value: unknown): value is LoginScope {
  return typeof value === "string" && loginScopes.includes(value as LoginScope);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse({
      email: body?.email,
      password: body?.password,
    });

    if (!parsed.success || !isLoginScope(body?.loginScope)) {
      return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS" });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: {
        passwordHash: true,
        scope: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.status !== "ACTIVE" || !user.passwordHash) {
      return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS" });
    }

    const isValidPassword = await verifyPassword(
      parsed.data.password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS" });
    }

    if (user.scope !== body.loginScope) {
      return NextResponse.json({ ok: false, code: "WRONG_LOGIN_PORTAL" });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login scope preflight failed", error);
    return NextResponse.json(
      { ok: false, code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
