import { createClient } from "@/lib/supabase/client";
import {
  attachEntryPhoto,
  createPhotoUploadUrls,
} from "@/app/(journal)/journal/actions";

const PHOTOS_BUCKET = "journal-photos";
const MAX_DISPLAY_EDGE = 2000;

/**
 * Build a downscaled JPEG copy for display. Falls back to the original bytes
 * when the browser can't decode the format to a canvas (e.g. HEIC).
 */
export async function makeDisplayBlob(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DISPLAY_EDGE / Math.max(bitmap.width, bitmap.height)
    );
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) throw new Error("toBlob failed");
    return blob;
  } catch {
    return file;
  }
}

/**
 * Upload one photo to an entry: signs upload URLs, pushes the original plus a
 * downscaled display copy to storage, and records the DB row. Returns the new
 * photo id and the display path (for minting a signed view URL afterward).
 */
export async function uploadJournalPhoto(
  entryId: string,
  file: File
): Promise<{ id: string; displayPath: string }> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const photoId = crypto.randomUUID();
  const urls = await createPhotoUploadUrls(entryId, photoId, ext);
  const displayBlob = await makeDisplayBlob(file);
  const supabase = createClient();

  const original = await supabase.storage
    .from(PHOTOS_BUCKET)
    .uploadToSignedUrl(urls.originalPath, urls.originalToken, file, {
      contentType: file.type || undefined,
    });
  if (original.error) throw original.error;

  const display = await supabase.storage
    .from(PHOTOS_BUCKET)
    .uploadToSignedUrl(urls.displayPath, urls.displayToken, displayBlob, {
      contentType: displayBlob.type || "image/jpeg",
    });
  if (display.error) throw display.error;

  const id = await attachEntryPhoto(
    entryId,
    urls.originalPath,
    urls.displayPath
  );
  return { id, displayPath: urls.displayPath };
}
