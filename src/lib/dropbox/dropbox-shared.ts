/**
 * Browser-safe Dropbox constants and types. No secrets here.
 */

export const DROPBOX_PROVIDER_ID = "dropbox" as const;

export const DROPBOX_RETURN_PATH = "/oauth/dropbox/return";

/**
 * Least-privilege scope set for the two shipped features:
 *  - files.metadata.read : browse folders and detect revisions
 *  - files.content.read  : copy selected plan sets into AWM storage
 *  - files.content.write : write approved deliverables back
 *  - account_info.read   : show which Dropbox account is connected
 */
export const DROPBOX_SCOPES = [
  "account_info.read",
  "files.metadata.read",
  "files.content.read",
  "files.content.write",
];

export const DROPBOX_ROOT_LABEL = "Dropbox";

export function dropboxProjectFolderSegments(projectName: string) {
  return ["AWM Coastal Windows", projectName?.trim() || "Project"];
}
