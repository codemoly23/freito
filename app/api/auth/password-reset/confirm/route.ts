import crypto from "crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { hashResetToken } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db/prisma";
import { resetPasswordSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Password reset request is invalid.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const resetToken = await prisma.passwordresettoken.findUnique({
    where: { tokenHash },
    include: {
      user: true,
    },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date() ||
    resetToken.user.status !== "ACTIVE"
  ) {
    return NextResponse.json(
      { message: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordresettoken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
    prisma.auditlog.create({
      data: {
        id: crypto.randomUUID(),
        companyId: resetToken.user.companyId,
        actorId: resetToken.userId,
        action: "auth.password_reset.completed",
        entityType: "User",
        entityId: resetToken.userId,
      },
    }),
  ]);

  return NextResponse.json({
    message: "Password updated. You can sign in with your new password.",
  });
}
