"use client";

import { Activity, EllipsisVertical, House, Package, SquarePen } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { STATUS_BADGE, TONE_CLASSES } from "./timeline-card";

type DemoShipment = { trackingNumber: string; status: keyof typeof STATUS_BADGE };

export function ChatMenu({ onSend }: { onSend: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [shipments, setShipments] = useState<DemoShipment[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || shipments) return;
    fetch("/api/shipments")
      .then((res) => res.json())
      .then((data: { shipments: DemoShipment[] }) => setShipments(data.shipments))
      .catch(() => setShipments([]));
  }, [open, shipments]);

  function pick(trackingNumber: string) {
    onSend(`Track ${trackingNumber}`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Chat menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-subtle"
      >
        <EllipsisVertical className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-10 w-72 rounded-2xl border border-border bg-bg p-2 shadow-lg">
          {/* prefetch=false: a real navigation, not a hover target — same reasoning as the
              landing page's /chat links (decisions.md, chat-creation-on-prefetch). */}
          <Link
            href="/chat"
            prefetch={false}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-text-primary hover:bg-bg-subtle"
          >
            <SquarePen className="h-3.5 w-3.5 text-text-secondary" />
            New conversation
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-text-primary hover:bg-bg-subtle"
          >
            <House className="h-3.5 w-3.5 text-text-secondary" />
            Home
          </Link>
          <Link
            href="/traces"
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-text-primary hover:bg-bg-subtle"
          >
            <Activity className="h-3.5 w-3.5 text-text-secondary" />
            Traces
          </Link>

          <div className="my-1.5 border-t border-border" />

          <div className="mb-1 flex items-center justify-between gap-2 rounded-xl bg-accent-soft px-2.5 py-2">
            <span className="text-xs font-medium text-accent">Verification code for every demo shipment</span>
            <span className="rounded-md bg-bg px-2 py-0.5 font-mono text-sm font-bold text-accent">7742</span>
          </div>
          <div className="px-2.5 py-1 text-xs font-medium text-text-secondary">Demo shipments — tap to track</div>
          {shipments === null && <div className="px-2.5 py-3 text-sm text-text-secondary">Loading…</div>}
          {shipments?.length === 0 && <div className="px-2.5 py-3 text-sm text-text-secondary">No seeded shipments found.</div>}
          {shipments?.map((s) => {
            const badge = STATUS_BADGE[s.status];
            return (
              <button
                key={s.trackingNumber}
                type="button"
                onClick={() => pick(s.trackingNumber)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-bg-subtle"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Package className="h-3.5 w-3.5 text-text-secondary" />
                  {s.trackingNumber}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE_CLASSES[badge.tone])}>
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
