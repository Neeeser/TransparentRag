"use client";

import { GlassCard } from "@/components/ui/panel";

type PipelineNoticeProps = {
  message: string;
};

export function PipelineNotice({ message }: PipelineNoticeProps) {
  return <GlassCard className="rounded-3xl p-4 text-sm text-body">{message}</GlassCard>;
}
