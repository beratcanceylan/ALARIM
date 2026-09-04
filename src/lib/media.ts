import { Directory, File, Paths } from "expo-file-system";

export type MediaFolder = "images" | "sounds";

function safeFileName(name: string, fallbackExtension: string): string {
  const baseName = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .slice(0, 80);
  if (baseName.includes(".")) return baseName;
  return `${baseName || "media"}.${fallbackExtension}`;
}

function appMediaDirectory(folder: MediaFolder): Directory {
  return new Directory(Paths.document, folder);
}

function isInsideDirectory(uri: string, directory: Directory): boolean {
  try {
    const baseUri = decodeURIComponent(directory.uri.replace(/\/$/, ""));
    const decodedUri = decodeURIComponent(uri);
    const segments = decodedUri.split("/");
    return decodedUri.startsWith(`${baseUri}/`) && !segments.some((segment) => segment === ".." || segment === ".");
  } catch {
    return false;
  }
}

export function isManagedMediaUri(uri: string | null, folder?: MediaFolder): boolean {
  if (!uri || process.env.EXPO_OS === "web") return false;
  const folders: MediaFolder[] = folder ? [folder] : ["images", "sounds"];
  return folders.some((candidate) => isInsideDirectory(uri, appMediaDirectory(candidate)));
}

export async function copyToAppStorage(
  sourceUri: string,
  folder: MediaFolder,
  originalName: string,
  fallbackExtension: string,
): Promise<string> {
  // Browser-selected URIs are the only durable representation available in the web fallback.
  // Native pickers return temporary/cache URIs, so copy those into Documents.
  if (process.env.EXPO_OS === "web") return sourceUri;

  const directory = appMediaDirectory(folder);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });

  const fileName = `${Date.now()}-${safeFileName(originalName, fallbackExtension)}`;
  const destination = new File(directory, fileName);
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

export async function deleteManagedMedia(uri: string | null, folder?: MediaFolder): Promise<void> {
  if (!uri || !isManagedMediaUri(uri, folder)) return;

  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Media cleanup is best-effort. Never let a stale file prevent alarm data from saving.
  }
}
