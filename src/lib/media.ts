import { Directory, File, Paths } from "expo-file-system";

function safeFileName(name: string, fallbackExtension: string): string {
  const baseName = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .slice(0, 80);
  if (baseName.includes(".")) return baseName;
  return `${baseName || "media"}.${fallbackExtension}`;
}

export async function copyToAppStorage(
  sourceUri: string,
  folder: "images" | "sounds",
  originalName: string,
  fallbackExtension: string,
): Promise<string> {
  // Web URIs are already durable from the browser's point of view.
  if (process.env.EXPO_OS === "web") return sourceUri;

  const directory = new Directory(Paths.document, folder);
  if (!directory.exists) directory.create({ intermediates: true });

  const fileName = `${Date.now()}-${safeFileName(originalName, fallbackExtension)}`;
  const destination = new File(directory, fileName);
  await new File(sourceUri).copy(destination);
  return destination.uri;
}
