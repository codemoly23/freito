import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { hashPortalActivationToken } from "@/lib/client-portal/activation";
import { prisma } from "@/lib/db/prisma";
import { resetPasswordSchema } from "@/lib/validators/auth";

export async function POST(request: Request, context: { params: Promise<{ companySlug: string }> }) {
  const { companySlug } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Enter a valid strong password." }, { status: 400 });
  const tokenHash = hashPortalActivationToken(parsed.data.token);
  const activation = await prisma.customerportalactivationtoken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      deletedAt: null,
      expiresAt: { gt: new Date() },
      company: { portalSlug: companySlug, portalEnabled: true },
      clientportalaccount: { deletedAt: null },
    },
    include: { clientportalaccount: true },
  });
  if (!activation) return NextResponse.json({ message: "Activation link is invalid, expired, or already used." }, { status: 400 });

  await prisma.$transaction([
    prisma.clientportalaccount.update({
      where: { id: activation.clientPortalAccountId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        plainPassword: parsed.data.password,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    }),
    prisma.customerportalactivationtoken.update({
      where: { id: activation.id },
      data: { usedAt: new Date() },
    }),
    prisma.auditlog.create({
      data: {
        id: crypto.randomUUID(),
        companyId: activation.companyId,
        action: "PORTAL_ACCESS_ACTIVATED",
        entityType: "ClientPortalAccount",
        entityId: activation.clientPortalAccountId,
        metadata: JSON.stringify({ customerId: activation.customerId }),
      },
    }),
  ]);
  return NextResponse.json({ message: "Portal access activated. You can now sign in." });
}
