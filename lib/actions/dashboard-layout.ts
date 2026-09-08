"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { dashboardLayoutSchema } from "@/lib/validators/dashboard-layout";
import { audit, getScopedCompanyId, getString } from "@/lib/actions/helpers";

export async function saveDashboardLayout(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("dashboard:view");

  let orderRaw: unknown;
  let hiddenRaw: unknown;
  try {
    orderRaw = JSON.parse(getString(formData, "order") || "[]");
    hiddenRaw = JSON.parse(getString(formData, "hidden") || "[]");
  } catch {
    return;
  }

  const parsed = dashboardLayoutSchema.safeParse({ order: orderRaw, hidden: hiddenRaw });
  if (!parsed.success) return;

  await prisma.userdashboardlayout.upsert({
    where: { companyId_userId: { companyId, userId: user.id } },
    create: {
      id: crypto.randomUUID(),
      companyId,
      userId: user.id,
      layoutJson: JSON.stringify(parsed.data),
      updatedAt: new Date(),
    },
    update: {
      layoutJson: JSON.stringify(parsed.data),
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "dashboard_layout.updated",
    entityType: "UserDashboardLayout",
    entityId: user.id,
    metadata: parsed.data,
  });

  revalidatePath("/dashboard");
}

export async function resetDashboardLayout(formData: FormData) {
  void formData;
  const { user, companyId } = await getScopedCompanyId("dashboard:view");

  await prisma.userdashboardlayout.deleteMany({
    where: { companyId, userId: user.id },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "dashboard_layout.reset",
    entityType: "UserDashboardLayout",
    entityId: user.id,
  });

  revalidatePath("/dashboard");
}
