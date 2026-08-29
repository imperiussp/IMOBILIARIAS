import { supabaseBrowser } from "./supabaseBrowser";

function isExternalPhotoUrl(path: string | null | undefined) {
  return Boolean(path && /^https?:\/\//i.test(path));
}

export async function getPropertyPhotoUrl(path: string | null | undefined, expiresIn = 3600) {
  if (!path) return "";
  // A demonstração usa algumas capas permanentes por URL pública. Elas não
  // pertencem ao bucket e, portanto, não devem passar pelo createSignedUrl.
  if (isExternalPhotoUrl(path)) return path;
  if (!supabaseBrowser) return "";
  const { data, error } = await supabaseBrowser.storage.from("property-photos").createSignedUrl(path, expiresIn);
  if (error) return "";
  return data.signedUrl || "";
}

export async function getPropertyPhotoUrls(paths: Array<string | null | undefined>, expiresIn = 3600) {
  const localPaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path) && !isExternalPhotoUrl(path))));
  const signed = new Map<string, string>();

  if (supabaseBrowser && localPaths.length) {
    const { data, error } = await supabaseBrowser.storage.from("property-photos").createSignedUrls(localPaths, expiresIn);
    if (!error && data) {
      data.forEach((item, index) => {
        const path = localPaths[index];
        if (path && item?.signedUrl) signed.set(path, item.signedUrl);
      });
    } else {
      const fallbackUrls = await Promise.all(localPaths.map((path) => getPropertyPhotoUrl(path, expiresIn)));
      localPaths.forEach((path, index) => {
        const url = fallbackUrls[index];
        if (url) signed.set(path, url);
      });
    }
  }

  return paths.map((path) => {
    if (!path) return "";
    if (isExternalPhotoUrl(path)) return path;
    return signed.get(path) || "";
  });
}
