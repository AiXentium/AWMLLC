/**
 * Carries a blueprint File from the Import Blueprint dialog to the newly
 * created project's workspace, where the upload queue picks it up.
 * Module-scoped on purpose: it only needs to survive one client-side navigation.
 */
let pending: File | null = null;

export function setPendingBlueprintFile(file: File | null) {
  pending = file;
}

export function takePendingBlueprintFile(): File | null {
  const file = pending;
  pending = null;
  return file;
}
