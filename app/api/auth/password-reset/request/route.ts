import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  createPasswordResetToken,
  getPasswordResetUrl,
} from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db/prisma";
import { forgotPasswordSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid work email." },
      { status: 400 },
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const genericMessage =
    "If an active account exists for this email, password reset instructions are ready.";

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      companyId: true,
      email: true,
      status: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ message: genericMessage });
  }

  const { token, expiresAt } = await createPasswordResetToken(user.id);
  const resetUrl = getPasswordResetUrl(token);

  await prisma.auditlog.create({
    data: {
      id: crypto.randomUUID(),
      companyId: user.companyId,
      actorId: user.id,
      action: "auth.password_reset.requested",
      entityType: "User",
      entityId: user.id,
      metadata: JSON.stringify({
        email: user.email,
        expiresAt: expiresAt.toISOString(),
      }),
    },
  });

  return NextResponse.json({
    message: genericMessage,
    resetUrl: process.env.NODE_ENV === "production" ? null : resetUrl,
    expiresAt,
  });
}
