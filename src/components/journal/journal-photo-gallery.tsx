"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Play, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JournalMediaType } from "@/lib/types";
import {
  attachEntryPhoto,
  createPhotoUploadUrls,
  createSignedPhotoUrl,
  deleteEntryPhoto,
  updatePhotoCaption,
} from "@/app/(journal)/journal/actions";

const PHOTOS_BUCKET = "journal-photos";
const MAX_DISPLAY_EDGE = 2000;
// Mirrors the storage bucket's file_size_limit (see migration 00044).
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

type Media = {
  id: string;
  mediaType: JournalMediaType;
  displayUrl: string;
  videoUrl: string | null;
  caption: string | null;
};
type Pending = { tempId: string; previewUrl: string; mediaType: JournalMediaType };

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

const VIDEO_EXTENSIONS = ["mov", "mp4", "m4v", "webm", "ogv"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

/**
 * Classify a dropped/picked file as photo or video. Falls back to the file
 * extension because drag sources (notably macOS Photos) sometimes hand over
 * files with an empty or misleading MIME type.
 */
function detectMediaType(file: File): JournalMediaType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "photo";
  const ext = file.name.includes(".")
    ? (file.name.split(".").pop() ?? "").toLowerCase()
    : "";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "photo";
  return null;
}

/**
 * Build a downscaled JPEG copy of an image for display. Falls back to the
 * original bytes when the browser can't decode the format to a canvas (e.g.
 * HEIC).
 */
async function makeImageDisplayBlob(file: File): Promise<Blob> {
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
 * Extract a poster frame from a video as a downscaled JPEG. Used as the
 * display copy so galleries and history covers can render a thumbnail.
 */
async function makeVideoPosterBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  try {
    video.src = url;
    video.muted = true;
    video.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Couldn't read that video file."));
    });
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Couldn't read that video file."));
      // Seek slightly in to avoid a black opening frame.
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    });
    const scale = Math.min(
      1,
      MAX_DISPLAY_EDGE / Math.max(video.videoWidth, video.videoHeight)
    );
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't read that video file.");
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) throw new Error("Couldn't read that video file.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function JournalPhotoGallery({
  entryId,
  initialPhotos,
  editable,
}: {
  entryId: string;
  initialPhotos: Media[];
  editable: boolean;
}) {
  const [media, setMedia] = useState<Media[]>(initialPhotos);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Media | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMedia = useCallback(
    async (file: File) => {
      const mediaType = detectMediaType(file);
      if (!mediaType) {
        setError(`“${file.name}” isn't a supported photo or video format.`);
        return;
      }
      const isVideo = mediaType === "video";

      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `“${file.name}” is ${formatBytes(file.size)} — files must be under ${formatBytes(
            MAX_UPLOAD_BYTES
          )}.`
        );
        return;
      }

      const tempId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setPending((p) => [...p, { tempId, previewUrl, mediaType }]);
      setError(null);
      try {
        const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
        const photoId = crypto.randomUUID();
        const urls = await createPhotoUploadUrls(entryId, photoId, ext);
        const displayBlob = isVideo
          ? await makeVideoPosterBlob(file)
          : await makeImageDisplayBlob(file);
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
          urls.displayPath,
          mediaType
        );
        const displayUrl = await createSignedPhotoUrl(urls.displayPath);
        const videoUrl = isVideo
          ? await createSignedPhotoUrl(urls.originalPath)
          : null;
        setMedia((ms) => [
          ...ms,
          { id, mediaType, displayUrl, videoUrl, caption: null },
        ]);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : `Failed to upload ${isVideo ? "video" : "photo"}`
        );
      } finally {
        URL.revokeObjectURL(previewUrl);
        setPending((p) => p.filter((x) => x.tempId !== tempId));
      }
    },
    [entryId]
  );

  useEffect(() => {
    if (!editable) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        setDragging(false);
      }
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => detectMediaType(f) !== null
      );
      files.forEach((f) => void uploadMedia(f));
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [editable, uploadMedia]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setLightbox(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lightbox]);

  const handleDelete = (id: string) => {
    setMedia((ms) => ms.filter((m) => m.id !== id));
    void deleteEntryPhoto(id).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to delete item");
    });
  };

  const hasContent = media.length > 0 || pending.length > 0;

  return (
    <>
      {editable && dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-foreground/40 px-10 py-8 font-serif text-sm text-muted-foreground">
            Drop photo or video to attach
          </div>
        </div>
      )}

      {(editable || hasContent || error) && (
        <div className="mx-auto w-full max-w-2xl px-6 pt-6">
          {error && (
            <p className="mb-3 font-serif text-xs text-destructive">{error}</p>
          )}
          {(editable || hasContent) && (
            <div className="flex flex-wrap gap-4">
              {media.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  editable={editable}
                  onDelete={() => handleDelete(item.id)}
                  onOpen={() => setLightbox(item)}
                />
              ))}
              {pending.map((p) => (
                <div
                  key={p.tempId}
                  className="relative h-28 w-28 overflow-hidden rounded-md border border-border bg-muted"
                >
                  {p.mediaType === "video" ? (
                    <video
                      src={p.previewUrl}
                      muted
                      className="h-full w-full object-cover opacity-50"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-50"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-foreground" />
                  </div>
                </div>
              ))}
              {editable && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      Array.from(e.target.files ?? []).forEach(
                        (f) => void uploadMedia(f)
                      );
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add photo or video"
                    className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    <Plus className="size-5" />
                    <span className="font-serif text-[11px]">Add</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="size-5" />
          </button>
          <figure
            className="flex max-h-full max-w-full flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.mediaType === "video" && lightbox.videoUrl ? (
              <video
                src={lightbox.videoUrl}
                poster={lightbox.displayUrl}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-lg"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.displayUrl}
                alt={lightbox.caption ?? ""}
                className="max-h-[85vh] max-w-full rounded-lg object-contain"
              />
            )}
            {lightbox.caption && (
              <figcaption className="font-serif text-sm text-white/70">
                {lightbox.caption}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </>
  );
}

function MediaCard({
  media,
  editable,
  onDelete,
  onOpen,
}: {
  media: Media;
  editable: boolean;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [caption, setCaption] = useState(media.caption ?? "");
  const [savedCaption, setSavedCaption] = useState(media.caption ?? "");
  const [, startTransition] = useTransition();

  const saveCaption = () => {
    if (caption === savedCaption) return;
    setSavedCaption(caption);
    startTransition(async () => {
      await updatePhotoCaption(media.id, caption);
    });
  };

  return (
    <figure className="group/photo flex w-28 flex-col gap-1">
      <div className="relative h-28 w-28 overflow-hidden rounded-md border border-border">
        <button
          type="button"
          onClick={onOpen}
          aria-label={media.mediaType === "video" ? "Play video" : "View photo"}
          className="block h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.displayUrl}
            alt={media.caption ?? ""}
            className="h-full w-full object-cover"
          />
          {media.mediaType === "video" && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/55 p-2">
                <Play className="size-4 fill-white text-white" />
              </span>
            </span>
          )}
        </button>
        {editable && (
          <button
            type="button"
            aria-label={
              media.mediaType === "video" ? "Delete video" : "Delete photo"
            }
            onClick={onDelete}
            className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/photo:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {editable ? (
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
          placeholder="Add a caption…"
          className="w-full bg-transparent font-serif text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none"
        />
      ) : (
        media.caption && (
          <figcaption className="font-serif text-xs text-muted-foreground">
            {media.caption}
          </figcaption>
        )
      )}
    </figure>
  );
}
