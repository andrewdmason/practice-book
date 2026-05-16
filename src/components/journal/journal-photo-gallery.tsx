"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  attachEntryPhoto,
  createPhotoUploadUrls,
  createSignedPhotoUrl,
  deleteEntryPhoto,
  updatePhotoCaption,
} from "@/app/(journal)/journal/actions";

const PHOTOS_BUCKET = "journal-photos";
const MAX_DISPLAY_EDGE = 2000;

type Photo = { id: string; displayUrl: string; caption: string | null };
type Pending = { tempId: string; previewUrl: string };

/**
 * Build a downscaled JPEG copy for display. Falls back to the original bytes
 * when the browser can't decode the format to a canvas (e.g. HEIC).
 */
async function makeDisplayBlob(file: File): Promise<Blob> {
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

export function JournalPhotoGallery({
  entryId,
  initialPhotos,
  editable,
}: {
  entryId: string;
  initialPhotos: Photo[];
  editable: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const uploadPhoto = useCallback(
    async (file: File) => {
      const tempId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setPending((p) => [...p, { tempId, previewUrl }]);
      setError(null);
      try {
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
        const displayUrl = await createSignedPhotoUrl(urls.displayPath);
        setPhotos((ps) => [...ps, { id, displayUrl, caption: null }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to upload photo");
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
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      files.forEach((f) => void uploadPhoto(f));
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
  }, [editable, uploadPhoto]);

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
    setPhotos((ps) => ps.filter((p) => p.id !== id));
    void deleteEntryPhoto(id).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to delete photo");
    });
  };

  const hasContent = photos.length > 0 || pending.length > 0;

  return (
    <>
      {editable && dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-foreground/40 px-10 py-8 font-serif text-sm text-muted-foreground">
            Drop photo to attach
          </div>
        </div>
      )}

      {(hasContent || error) && (
        <div className="mx-auto w-full max-w-2xl px-6 pt-6">
          {error && (
            <p className="mb-3 font-serif text-xs text-destructive">{error}</p>
          )}
          {hasContent && (
            <div className="flex flex-wrap gap-4">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  editable={editable}
                  onDelete={() => handleDelete(photo.id)}
                  onOpen={() => setLightbox(photo)}
                />
              ))}
              {pending.map((p) => (
                <div
                  key={p.tempId}
                  className="relative h-28 w-28 overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-foreground" />
                  </div>
                </div>
              ))}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.displayUrl}
              alt={lightbox.caption ?? ""}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
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

function PhotoCard({
  photo,
  editable,
  onDelete,
  onOpen,
}: {
  photo: Photo;
  editable: boolean;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [savedCaption, setSavedCaption] = useState(photo.caption ?? "");
  const [, startTransition] = useTransition();

  const saveCaption = () => {
    if (caption === savedCaption) return;
    setSavedCaption(caption);
    startTransition(async () => {
      await updatePhotoCaption(photo.id, caption);
    });
  };

  return (
    <figure className="group/photo flex w-28 flex-col gap-1">
      <div className="relative h-28 w-28 overflow-hidden rounded-md border border-border">
        <button
          type="button"
          onClick={onOpen}
          aria-label="View photo"
          className="block h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.displayUrl}
            alt={photo.caption ?? ""}
            className="h-full w-full object-cover"
          />
        </button>
        {editable && (
          <button
            type="button"
            aria-label="Delete photo"
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
        photo.caption && (
          <figcaption className="font-serif text-xs text-muted-foreground">
            {photo.caption}
          </figcaption>
        )
      )}
    </figure>
  );
}
