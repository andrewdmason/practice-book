"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JournalMediaType, JournalPhotoSource } from "@/lib/types";
import {
  createSignedPhotoUrl,
  deleteEntryPhoto,
} from "@/app/(journal)/journal/actions";
import {
  MAX_UPLOAD_BYTES,
  detectMediaType,
  formatBytes,
  uploadJournalMedia,
} from "@/lib/journal/photo-upload";

type Media = {
  id: string;
  mediaType: JournalMediaType;
  source?: JournalPhotoSource;
  displayUrl: string;
  videoUrl: string | null;
};
type Pending = { tempId: string; previewUrl: string; mediaType: JournalMediaType };
type PhotoGenerationStatus = "pending" | "generating";

export function JournalPhotoGallery({
  entryId,
  initialPhotos,
  editable,
  showAttachAction = true,
  actionSlot = null,
  photoGenerationStatus = null,
  containerClassName = "mx-auto w-full max-w-2xl px-6 pt-6",
}: {
  entryId: string;
  initialPhotos: Media[];
  editable: boolean;
  showAttachAction?: boolean;
  actionSlot?: React.ReactNode;
  photoGenerationStatus?: PhotoGenerationStatus | null;
  containerClassName?: string;
}) {
  const router = useRouter();
  const [media, setMedia] = useState<Media[]>(initialPhotos);
  const [pending, setPending] = useState<Pending[]>([]);
  const [activeGenerationStatus, setActiveGenerationStatus] =
    useState<PhotoGenerationStatus | null>(photoGenerationStatus);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Media | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPhotos[0]?.id ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMedia(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    setActiveGenerationStatus(photoGenerationStatus);
  }, [photoGenerationStatus]);

  useEffect(() => {
    const onGenerationStarted = (event: Event) => {
      const detail = (event as CustomEvent<{ entryId?: string }>).detail;
      if (detail?.entryId === entryId) {
        setActiveGenerationStatus("generating");
      }
    };
    const onGenerationFinished = (event: Event) => {
      const detail = (event as CustomEvent<{ entryId?: string }>).detail;
      if (detail?.entryId === entryId) {
        setActiveGenerationStatus(null);
      }
    };

    window.addEventListener(
      "journal:photo-generation-started",
      onGenerationStarted
    );
    window.addEventListener(
      "journal:photo-generation-finished",
      onGenerationFinished
    );
    return () => {
      window.removeEventListener(
        "journal:photo-generation-started",
        onGenerationStarted
      );
      window.removeEventListener(
        "journal:photo-generation-finished",
        onGenerationFinished
      );
    };
  }, [entryId]);

  useEffect(() => {
    if (!activeGenerationStatus) return;
    const id = window.setInterval(() => router.refresh(), 1500);
    return () => window.clearInterval(id);
  }, [activeGenerationStatus, router]);

  useEffect(() => {
    if (media.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !media.some((m) => m.id === selectedId)) {
      setSelectedId(media[0].id);
    }
  }, [media, selectedId]);

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
        const { id, displayPath, originalPath } = await uploadJournalMedia(
          entryId,
          file
        );
        const displayUrl = await createSignedPhotoUrl(displayPath);
        const videoUrl = isVideo
          ? await createSignedPhotoUrl(originalPath)
          : null;
        setMedia((ms) => {
          const next = [
            ...ms,
            { id, mediaType, source: "uploaded" as const, displayUrl, videoUrl },
          ];
          if (ms.length === 0) setSelectedId(id);
          return next;
        });
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
    setMedia((ms) => {
      const next = ms.filter((m) => m.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
    void deleteEntryPhoto(id).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to delete item");
    });
  };

  const isGeneratingPhoto = activeGenerationStatus !== null;
  const hasContent = media.length > 0 || pending.length > 0 || isGeneratingPhoto;
  const selected = media.find((m) => m.id === selectedId) ?? media[0] ?? null;

  return (
    <>
      {editable && dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-foreground/40 px-10 py-8 font-serif text-sm text-muted-foreground">
            Drop photo or video to attach
          </div>
        </div>
      )}

      {((editable && showAttachAction) || actionSlot || hasContent || error) && (
        <div className={containerClassName}>
          {error && (
            <p className="mb-3 font-serif text-xs text-destructive">{error}</p>
          )}
          {(editable || actionSlot || hasContent) && (
            <div className="flex flex-col items-start gap-3">
              {hasContent && (
                <div className="w-full space-y-3">
                  {selected ? (
                    <FeaturedMedia
                      media={selected}
                      editable={editable}
                      onDelete={() => handleDelete(selected.id)}
                      onOpen={() => setLightbox(selected)}
                    />
                  ) : isGeneratingPhoto ? (
                    <GeneratingFeaturedPlaceholder />
                  ) : null}
                  {(media.length > 1 ||
                    pending.length > 0 ||
                    (isGeneratingPhoto && media.length > 0)) && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {media.map((item) => (
                        <MediaThumb
                          key={item.id}
                          media={item}
                          selected={item.id === selected?.id}
                          onSelect={() => setSelectedId(item.id)}
                        />
                      ))}
                      {pending.map((p) => (
                        <PendingThumb key={p.tempId} pending={p} />
                      ))}
                      {isGeneratingPhoto && media.length > 0 && (
                        <GeneratingThumb />
                      )}
                    </div>
                  )}
                </div>
              )}
              {((editable && showAttachAction) || actionSlot) && (
                <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                  {editable && showAttachAction && (
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
                        aria-label="Attach a photo or video"
                        className="font-serif text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        Attach a photo
                      </button>
                    </>
                  )}
                  {actionSlot}
                </div>
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
                alt=""
                className="max-h-[85vh] max-w-full rounded-lg object-contain"
              />
            )}
          </figure>
        </div>
      )}
    </>
  );
}

function FeaturedMedia({
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
  return (
    <figure className="group/photo w-full">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-border bg-muted">
        <button
          type="button"
          onClick={onOpen}
          aria-label={media.mediaType === "video" ? "Play video" : "View photo"}
          className="block h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.displayUrl}
            alt=""
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
            <X className="size-4" />
          </button>
        )}
      </div>
    </figure>
  );
}

function GeneratingFeaturedPlaceholder() {
  return (
    <figure className="w-full">
      <div className="relative flex aspect-[3/2] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 font-serif text-sm italic text-muted-foreground">
        <span className="relative flex size-12 items-center justify-center">
          <Loader2 className="size-10 animate-spin opacity-50" />
        </span>
        <span>making a photo...</span>
      </div>
    </figure>
  );
}

function MediaThumb({
  media,
  selected,
  onSelect,
}: {
  media: Media;
  selected: boolean;
  onSelect: () => void;
}) {
  const generated = media.source === "ai_generated";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      aria-label={media.mediaType === "video" ? "Select video" : "Select photo"}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border bg-muted transition",
        generated ? "h-16 w-24" : "h-16 w-16",
        selected
          ? "border-foreground/70 ring-2 ring-foreground/15"
          : "border-border opacity-70 hover:opacity-100"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.displayUrl}
        alt=""
        className="h-full w-full object-cover"
      />
      {media.mediaType === "video" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-1.5">
            <Play className="size-3 fill-white text-white" />
          </span>
        </span>
      )}
    </button>
  );
}

function GeneratingThumb() {
  return (
    <div className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40">
      <Loader2 className="size-6 animate-spin text-foreground/45" />
    </div>
  );
}

function PendingThumb({ pending }: { pending: Pending }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {pending.mediaType === "video" ? (
        <video
          src={pending.previewUrl}
          muted
          className="h-full w-full object-cover opacity-50"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pending.previewUrl}
          alt=""
          className="h-full w-full object-cover opacity-50"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="size-4 animate-spin text-foreground" />
      </div>
    </div>
  );
}
