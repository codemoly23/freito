"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  isSavedViewPageKey,
  savedViewNameSchema,
  savedViewPagePaths,
  savedViewPagePermissions,
  savedViewPageSchemas,
} from "@/lib/validators/saved-views";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

/**
 * Creates a new view from the current page's live URL search string, or
 * updates an existing one. Passing a non-empty `search` field (even "") always
 * re-derives filterJson from that query string; omitting it (a plain rename)
 * keeps the view's existing filters untouched.
 */
export async function saveSavedView(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const pageKeyRaw = getString(formData, "pageKey");
  if (!isSavedViewPageKey(pageKeyRaw)) {
    return validationError("Unknown page.");
  }
  const pageKey = pageKeyRaw;

  const { user, companyId } = await getScopedCompanyId(savedViewPagePermissions[pageKey]);

  const id = getString(formData, "id") || undefined;
  const nameParsed = savedViewNameSchema.safeParse(getString(formData, "name"));
  if (!nameParsed.success) {
    return validationError("Please enter a view name.", {
      name: nameParsed.error.flatten().formErrors,
    });
  }
  const name = nameParsed.data;
  const isDefault = getString(formData, "isDefault") === "on";

  let filterJson: string | undefined;
  if (formData.has("search")) {
    const query = new URLSearchParams(getString(formData, "search"));
    const candidate: Record<string, string> = {};
    for (const key of Object.keys(savedViewPageSchemas[pageKey].shape)) {
      const value = query.get(key);
      if (value) candidate[key] = value;
    }
    const filtersParsed = savedViewPageSchemas[pageKey].safeParse(candidate);
    if (!filtersParsed.success) {
      return validationError("This filter could not be saved.");
    }
    filterJson = JSON.stringify(filtersParsed.data);
  }

  if (!id && filterJson === undefined) {
    return validationError("Nothing to save.");
  }

  try {
    const view = await prisma.$transaction(async (tx) => {
      const saved = id
        ? await (async () => {
            const existing = await tx.savedview.findUnique({ where: { id } });
            if (!existing || existing.companyId !== companyId || existing.userId !== user.id || existing.deletedAt) {
              throw new Error("SAVED_VIEW_NOT_FOUND");
            }
            return tx.savedview.update({
              where: { id },
              data: {
                name,
                isDefault,
                ...(filterJson !== undefined ? { filterJson } : {}),
                updatedAt: new Date(),
              },
            });
          })()
        : await tx.savedview.create({
            data: {
              id: crypto.randomUUID(),
              companyId,
              userId: user.id,
              pageKey,
              name,
              filterJson: filterJson!,
              isDefault,
              updatedAt: new Date(),
            },
          });

      if (isDefault) {
        await tx.savedview.updateMany({
          where: {
            companyId,
            userId: user.id,
            pageKey,
            isDefault: true,
            deletedAt: null,
            id: { not: saved.id },
          },
          data: { isDefault: false },
        });
      }

      return saved;
    });

    await audit({
      companyId,
      actorId: user.id,
      action: id ? "savedview.updated" : "savedview.created",
      entityType: "SavedView",
      entityId: view.id,
      metadata: { pageKey, name: view.name },
    });

    revalidatePath(savedViewPagePaths[pageKey]);
    return successState(id ? "View updated." : "View saved.");
  } catch (error) {
    if (error instanceof Error && error.message === "SAVED_VIEW_NOT_FOUND") {
      return validationError("View was not found or you don't have access to it.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return validationError("You already have a saved view with this name.", {
        name: ["Name already used."],
      });
    }
    throw error;
  }
}

export async function deleteSavedView(formData: FormData) {
  const pageKeyRaw = getString(formData, "pageKey");
  if (!isSavedViewPageKey(pageKeyRaw)) return;
  const pageKey = pageKeyRaw;

  const { user, companyId } = await getScopedCompanyId(savedViewPagePermissions[pageKey]);

  const id = getString(formData, "id");
  const existing = await prisma.savedview.findUnique({ where: { id } });
  if (!existing || existing.companyId !== companyId || existing.userId !== user.id) return;

  await prisma.savedview.update({
    where: { id },
    data: { deletedAt: new Date(), isDefault: false },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "savedview.deleted",
    entityType: "SavedView",
    entityId: id,
    metadata: { pageKey, name: existing.name },
  });

  revalidatePath(savedViewPagePaths[pageKey]);
}
