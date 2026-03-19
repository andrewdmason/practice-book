"use client";

import { useRouter } from "next/navigation";
import { ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, ChevronRightIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollectionFormDialog } from "./collection-form-dialog";
import { PieceRow } from "./piece-row";
import { deleteCollection } from "@/app/(app)/repertoire/actions";
import type { Collection, Piece } from "@/lib/types";

export function CollectionRow({
  collection,
  pieces,
  allCollections,
}: {
  collection: Collection;
  pieces: Piece[];
  allCollections: Collection[];
}) {
  const router = useRouter();

  return (
    <Collapsible defaultOpen={pieces.length > 0}>
      <div className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
        <CollapsibleTrigger className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer">
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-90" />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium">{collection.name}</p>
            {collection.composer && (
              <p className="truncate text-xs text-muted-foreground">
                {collection.composer}
              </p>
            )}
          </div>
          <Badge variant="secondary">{pieces.length}</Badge>
        </CollapsibleTrigger>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => router.push(`/repertoire/collections/${collection.id}`)}
            >
              <ExternalLinkIcon />
              View details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <CollectionFormDialog
              collection={collection}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <PencilIcon />
                  Edit
                </DropdownMenuItem>
              }
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => deleteCollection(collection.id)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CollapsibleContent>
        <div className="ml-2">
          {pieces.map((piece) => (
            <PieceRow
              key={piece.id}
              piece={piece}
              collections={allCollections}
              indented
            />
          ))}
          {pieces.length === 0 && (
            <p className="pl-8 py-2 text-xs text-muted-foreground">
              No pieces in this collection
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
