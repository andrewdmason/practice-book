export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2" aria-label="Composing">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms] [animation-duration:1.4s]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:200ms] [animation-duration:1.4s]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:400ms] [animation-duration:1.4s]" />
    </div>
  );
}
