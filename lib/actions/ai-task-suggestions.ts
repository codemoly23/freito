"use server";

import { saveTask } from "@/lib/actions/tasks";

// Thin wrapper so a plain <form action={...}> (no useActionState) can call
// saveTask -- saveTask's (prevState, formData) => Promise<ActionState> shape
// is for the useActionState pattern; a plain form action needs
// (formData) => Promise<void>. saveTask's own redirect() on success still
// works through this wrapper.
export async function acceptTaskSuggestion(formData: FormData) {
  await saveTask({}, formData);
}
