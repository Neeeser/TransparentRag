"use client";

import { Loader } from "@/components/ui/loader";
import { GlassCard } from "@/components/ui/panel";

import { PipelineCanvas } from "./PipelineCanvas";
import { PipelineSidebar } from "./PipelineSidebar";

import type { ComponentProps, KeyboardEvent, PointerEvent } from "react";

type PipelineBuilderWorkspaceProps = {
  loading: boolean;
  sidebar: ComponentProps<typeof PipelineSidebar>;
  canvas: ComponentProps<typeof PipelineCanvas>;
  resize: {
    width: number;
    startResize: (event: PointerEvent<HTMLDivElement>) => void;
    resizeBy: (delta: number) => void;
  };
};

/** The responsive sidebar/canvas composition and its keyboard resize separator. */
export function PipelineBuilderWorkspace({
  loading,
  sidebar,
  canvas,
  resize,
}: PipelineBuilderWorkspaceProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GlassCard className="flex items-center justify-center rounded-3xl p-10">
          <Loader className="h-6 w-6" />
        </GlassCard>
      </div>
    );
  }

  const handleResizeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") resize.resizeBy(-16);
    if (event.key === "ArrowRight") resize.resizeBy(16);
  };

  return (
    <div
      className="grid flex-1 min-h-0 gap-3 xl:[grid-template-columns:var(--sidebar-width)_auto_1fr]"
      style={{ "--sidebar-width": `${resize.width}px` } as React.CSSProperties}
    >
      <div className="min-h-0">
        <PipelineSidebar {...sidebar} />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={0}
        onPointerDown={resize.startResize}
        onKeyDown={handleResizeKey}
        className="hidden w-1.5 cursor-col-resize self-stretch rounded-full bg-surface transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet xl:block"
      />
      <PipelineCanvas {...canvas} />
    </div>
  );
}
