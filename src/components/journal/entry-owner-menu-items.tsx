"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ImagePlus,
  Loader2,
  Lock,
  Sparkles,
  Users,
} from "lucide-react";
import {
  generateAndAttachEntryPhoto,
  setEntryVisibility,
} from "@/app/(journal)/journal/actions";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MAX_UPLOAD_BYTES,
  detectMediaType,
  formatBytes,
  uploadJournalMedia,
} from "@/lib/journal/photo-upload";
import type { JournalVisibility } from "@/lib/types";

export function EntryOwnerMenuItems({
  entryId,
  initialVisibility,
}: {
  entryId: string;
  initialVisibility: JournalVisibility;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibility, setVisibility] =
    useState<JournalVisibility>(initialVisibility);
  const [isVisibilityPending, startVisibility] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const disabled = isVisibilityPending || isGenerating || isUploading;

  function chooseVisibility(next: JournalVisibility) {
    if (next === visibility || disabled) return;
    const previous = visibility;
    setVisibility(next);
    startVisibility(async () => {
      try {
        await setEntryVisibility(entryId, next);
        router.refresh();
      } catch (err) {
        setVisibility(previous);
        window.alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        const mediaType = detectMediaType(file);
        if (!mediaType) {
          throw new Error(
            `"${file.name}" isn't a supported photo or video format.`
          );
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(
            `"${file.name}" is ${formatBytes(
              file.size
            )} - files must be under ${formatBytes(MAX_UPLOAD_BYTES)}.`
          );
        }
        await uploadJournalMedia(entryId, file);
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  }

  function generatePhoto() {
    if (disabled) return;
    window.dispatchEvent(
      new CustomEvent("journal:photo-generation-started", {
        detail: { entryId },
      })
    );
    startGenerating(async () => {
      try {
        const result = await generateAndAttachEntryPhoto(entryId);
        if (!result.ok) {
          window.dispatchEvent(
            new CustomEvent("journal:photo-generation-finished", {
              detail: { entryId },
            })
          );
          window.alert(result.error);
          return;
        }
        router.refresh();
      } catch (err) {
        window.dispatchEvent(
          new CustomEvent("journal:photo-generation-finished", {
            detail: { entryId },
          })
        );
        window.alert(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <>
      <DropdownMenuItem
        disabled={disabled || visibility === "private"}
        onClick={(event) => {
          event.preventDefault();
          chooseVisibility("private");
        }}
      >
        <Lock />
        Personal
        {visibility === "private" && <Check className="ml-auto" />}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={disabled || visibility === "family"}
        onClick={(event) => {
          event.preventDefault();
          chooseVisibility("family");
        }}
      >
        <Users />
        Family
        {visibility === "family" && <Check className="ml-auto" />}
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />
      <DropdownMenuItem
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          fileInputRef.current?.click();
        }}
      >
        {isUploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        {isUploading ? "Attaching..." : "Attach a photo"}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          generatePhoto();
        }}
      >
        {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {isGenerating ? "Generating..." : "Generate a photo"}
      </DropdownMenuItem>

      <DropdownMenuSeparator />
    </>
  );
}
