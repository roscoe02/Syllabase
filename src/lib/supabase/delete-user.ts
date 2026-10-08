import "server-only";
import { createAdminClient } from "./admin";

/** Deletes a user's uploaded files (Storage doesn't cascade), then the auth user, which cascades to every table. */
export async function deleteUserAndFiles(userId: string) {
  const admin = createAdminClient();
  const bucket = admin.storage.from("documents");
  const { data: folders } = await bucket.list(userId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${userId}/${folder.name}`, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${userId}/${folder.name}/${f.name}`);
    if (paths.length) await bucket.remove(paths);
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  return error;
}
