import { supabaseBrowser } from "./supabaseBrowser";

export async function getPropertyPhotoUrl(path: string | null | undefined, expiresIn = 3600) {
  if (!path || !supabaseBrowser) return "";
  const { data, error } = await supabaseBrowser.storage.from("property-photos").createSignedUrl(path, expiresIn);
  if (error) return "";
  return data.signedUrl || "";
}

export async function getPropertyPhotoUrls(paths: Array<string | null | undefined>, expiresIn = 3600) {
  if (!supabaseBrowser) return paths.map(() => "");
  const validPaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  if (!validPaths.length) return paths.map(() => "");

  const { data, error } = await supabaseBrowser.storage.from("property-photos").createSignedUrls(validPaths, expiresIn);
  if (error || !data) return Promise.all(paths.map((path) => getPropertyPhotoUrl(path, expiresIn)));

  const signed = new Map<string, string>();
  data.forEach((item, index) => {
    const path = validPaths[index];
    if (path && item?.signedUrl) signed.set(path, item.signedUrl);
  });
  return paths.map((path) => path ? signed.get(path) || "" : "");
}
