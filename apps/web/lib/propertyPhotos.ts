import { supabaseBrowser } from "./supabaseBrowser";

export async function getPropertyPhotoUrl(path: string | null | undefined, expiresIn = 3600) {
  if (!path || !supabaseBrowser) return "";
  const { data, error } = await supabaseBrowser.storage.from("property-photos").createSignedUrl(path, expiresIn);
  if (error) return "";
  return data.signedUrl || "";
}

export async function getPropertyPhotoUrls(paths: Array<string | null | undefined>, expiresIn = 3600) {
  return Promise.all(paths.map((path) => getPropertyPhotoUrl(path, expiresIn)));
}
