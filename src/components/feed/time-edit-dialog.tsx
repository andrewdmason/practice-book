"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function decompose(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h: String(h), m: String(m), s: String(s) };
}

export function TimeEditDialog({
  open,
  onOpenChange,
  timeSeconds,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeSeconds: number | undefined;
  onSave: (seconds: number | null) => void;
}) {
  const [h, setH] = useState("0");
  const [m, setM] = useState("0");
  const [s, setS] = useState("0");
  const mRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const parts = timeSeconds ? decompose(timeSeconds) : { h: "0", m: "0", s: "0" };
      setH(parts.h);
      setM(parts.m);
      setS(parts.s);
      // Focus minutes field after dialog opens
      setTimeout(() => mRef.current?.select(), 50);
    }
  }, [open, timeSeconds]);

  const handleSave = useCallback(() => {
    const total =
      (parseInt(h, 10) || 0) * 3600 +
      (parseInt(m, 10) || 0) * 60 +
      (parseInt(s, 10) || 0);
    onSave(total > 0 ? total : null);
  }, [h, m, s, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  const inputClass =
    "h-10 w-16 rounded-lg border border-input bg-transparent px-2 py-1 text-center text-lg tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-base";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit Time</DialogTitle>
        </DialogHeader>
        <div className="flex items-end justify-center gap-2" onKeyDown={handleKeyDown}>
          <div className="grid gap-1.5 text-center">
            <Label className="text-xs text-muted-foreground">Hours</Label>
            <input
              type="number"
              min={0}
              max={99}
              value={h}
              onChange={(e) => setH(e.target.value)}
              className={inputClass}
            />
          </div>
          <span className="pb-2 text-lg text-muted-foreground">:</span>
          <div className="grid gap-1.5 text-center">
            <Label className="text-xs text-muted-foreground">Min</Label>
            <input
              ref={mRef}
              type="number"
              min={0}
              max={59}
              value={m}
              onChange={(e) => setM(e.target.value)}
              className={inputClass}
            />
          </div>
          <span className="pb-2 text-lg text-muted-foreground">:</span>
          <div className="grid gap-1.5 text-center">
            <Label className="text-xs text-muted-foreground">Sec</Label>
            <input
              type="number"
              min={0}
              max={59}
              value={s}
              onChange={(e) => setS(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
