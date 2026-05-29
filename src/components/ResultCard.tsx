"use client";

import { ResultDto } from "@/lib/types";
import { Stars } from "./Stars";
import { PinIcon, DownloadIcon, ExpandIcon, ImageIcon } from "./icons";

export function ResultCard({
  result,
  blind,
  index,
  onRate,
  onPin,
  onExpand,
}: {
  result: ResultDto;
  blind: boolean;
  index: number;
  onRate: (id: string, rating: number) => void;
  onPin: (id: string, pinned: boolean) => void;
  onExpand: (r: ResultDto) => void;
}) {
  const color = result.modelColor;
  const pinned = result.pinned;

  return (
    <div
      className="group animate-fade-in-up overflow-hidden rounded-md border bg-bg-panel transition-transform duration-150 hover:-translate-y-0.5"
      style={{
        borderColor: pinned ? color : "#1f1f1f",
        boxShadow: pinned ? `0 0 0 1px ${color}` : undefined,
        animationDelay: `${Math.min(index * 60, 600)}ms`,
      }}
    >
      {/* Image area */}
      <div className="relative aspect-square w-full bg-black">
        {result.status === "done" && result.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.imageUrl}
            alt={blind ? "result" : result.modelName}
            className="h-full w-full object-cover"
          />
        ) : result.status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span className="mono text-[10px] uppercase tracking-wider text-red-400">
              generation failed
            </span>
            <span className="mono text-[10px] leading-relaxed text-fg-faint line-clamp-4">
              {result.error}
            </span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-fg-faint">
            <ImageIcon width={28} height={28} />
          </div>
        )}

        {pinned && (
          <span
            className="mono absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-black"
            style={{ background: color }}
          >
            pinned
          </span>
        )}

        {result.status === "done" && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <IconBtn title="Expand" onClick={() => onExpand(result)}>
              <ExpandIcon width={14} height={14} />
            </IconBtn>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="space-y-2 p-2.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: blind ? "#3a3a3a" : color }}
          />
          <span className="mono truncate text-xs text-fg">
            {blind ? "model ??" : result.modelName}
          </span>
          {result.latencyMs != null && (
            <span className="mono ml-auto shrink-0 text-[10px] text-fg-faint">
              {(result.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Stars value={result.rating} onChange={(v) => onRate(result.id, v)} />
          <div className="flex items-center gap-1">
            <IconBtn
              title={pinned ? "Unpin" : "Pin"}
              active={pinned}
              activeColor={color}
              onClick={() => onPin(result.id, !pinned)}
            >
              <PinIcon width={14} height={14} />
            </IconBtn>
            {result.imageUrl && (
              <a
                href={result.imageUrl}
                download={`${result.modelName}_${result.id}.png`}
                title="Export PNG"
                className="rounded p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
              >
                <DownloadIcon width={14} height={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  active,
  activeColor,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1 transition-colors hover:bg-bg-hover"
      style={{ color: active ? activeColor : "#8a8a8a" }}
    >
      {children}
    </button>
  );
}
