"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractYouTubeId } from "@/lib/youtube";
import {
  createPerformance,
  updatePerformance,
} from "@/app/practice/repertoire/performance-actions";
import type { Performance } from "@/lib/types";

type Owner = { pieceId: string } | { workId: string };

export function PerformanceFormDialog({
  owner,
  performance,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  owner: Owner;
  performance?: Performance;
  /** Omit when driving the dialog with `open`/`onOpenChange` (e.g. from a menu). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [performers, setPerformers] = useState("");
  const [location, setLocation] = useState("");
  const [performedOn, setPerformedOn] = useState("");

  const videoId = extractYouTubeId(videoUrl);

  function resetState() {
    setVideoUrl(performance?.youtube_video_id ?? "");
    setTitle(performance?.title ?? "");
    setPerformers(performance?.performers ?? "");
    setLocation(performance?.location ?? "");
    setPerformedOn(performance?.performed_on ?? "");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isControlled) {
      onOpenChange?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
      if (nextOpen) resetState();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!videoId) {
      setError("Enter a valid YouTube URL or video ID");
      return;
    }
    setPending(true);
    setError(null);

    const result = performance
      ? await updatePerformance(performance.id, {
          youtubeVideoId: videoId,
          title,
          performers,
          location,
          performedOn,
        })
      : await createPerformance({
          owner,
          youtubeVideoId: videoId,
          title,
          performers,
          location,
          performedOn,
        });

    setPending(false);

    if (result?.error) {
      setError(result.error);
    } else {
      handleOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && (
        <DialogTrigger render={<span />} nativeButton={false}>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {performance ? "Edit Performance" : "Add Performance"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="perf-url">YouTube URL or video ID</Label>
            <Input
              id="perf-url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="perf-title">Title</Label>
            <Input
              id="perf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring recital"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="perf-performers">Performers</Label>
            <Input
              id="perf-performers"
              value={performers}
              onChange={(e) => setPerformers(e.target.value)}
              placeholder="e.g. with Anna (violin), Ben (cello)"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="perf-location">Location</Label>
            <Input
              id="perf-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Wigmore Hall"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="perf-date">Date</Label>
            <Input
              id="perf-date"
              type="date"
              value={performedOn}
              onChange={(e) => setPerformedOn(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending || !videoId}>
              {pending
                ? "Saving..."
                : performance
                  ? "Save Changes"
                  : "Add Performance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
