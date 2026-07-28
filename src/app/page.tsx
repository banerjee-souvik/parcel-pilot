import Link from "next/link";
import { Activity, CloudRain, Globe2, Package, PackageCheck, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { shipments } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { DemoCard } from "@/components/landing/demo-card";

// The whole point of querying the DB here is to prove setup actually worked (tech-design.md §13) —
// a build-time-cached snapshot would show the same 5 shipments regardless of whether `yarn db:setup`
// ever ran. Same class of bug as the traces layout; see decisions.md.
export const dynamic = "force-dynamic";

const TONE_ICON = { warn: "text-warn", success: "text-success", danger: "text-danger" };

const DEMO_COPY: Record<
  string,
  { icon: typeof CloudRain; tone: "warn" | "success" | "danger"; headline: string; description: string }
> = {
  "SS-4417-DEMO": {
    icon: CloudRain,
    tone: "warn",
    headline: "Weather delay",
    description: "Held at Nagpur hub, ETA slipped 2 days. Try rescheduling it.",
  },
  "SS-9021-DEMO": {
    icon: Truck,
    tone: "success",
    headline: "Out for delivery",
    description: "On a courier's van. Try changing the address — the agent must refuse.",
  },
  "SS-7130-DEMO": {
    icon: PackageCheck,
    tone: "danger",
    headline: "Delivered",
    description: "Arrived safely. Try reporting damage and watch a claim get filed.",
  },
  "SS-2288-DEMO": {
    icon: Globe2,
    tone: "warn",
    headline: "Customs hold",
    description: "No ETA yet. Try rescheduling it — the agent must refuse until it clears.",
  },
  "SS-5560-DEMO": {
    icon: TriangleAlert,
    tone: "warn",
    headline: "Delivery attempt failed",
    description: "Recipient was unavailable — already auto-rescheduled. Ask what happened.",
  },
};

export default async function LandingPage() {
  const seeded = await db.select({ trackingNumber: shipments.trackingNumber }).from(shipments);
  const cards = seeded.map((s) => s.trackingNumber).filter((tn) => tn in DEMO_COPY);

  return (
    <div className="flex w-full flex-col bg-bg">
      <nav className="flex items-center justify-between gap-3 px-5 py-[18px] sm:px-10 lg:px-20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-accent">
            <Package className="h-[18px] w-[18px] text-white" />
          </div>
          <span className="text-base font-semibold text-text-primary">Parcel Pilot</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/traces" className="text-sm font-medium text-text-secondary hover:text-text-primary">
            Traces
          </Link>
          <Link
            href="/chat"
            prefetch={false}
            className="shrink-0 rounded-[9px] bg-accent px-3.5 py-2.5 text-sm font-semibold text-white sm:px-[18px]"
          >
            Open chat
          </Link>
        </div>
      </nav>

      <section className="flex flex-col items-center gap-10 px-5 py-10 sm:px-10 lg:flex-row lg:gap-20 lg:px-20 lg:py-16 lg:pb-[72px]">
        <div className="flex w-full flex-col gap-5">
          <div className="flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-[5px]">
            <Sparkles className="h-[13px] w-[13px] text-accent" />
            <span className="text-xs font-semibold text-accent">SwiftShip delivery agent</span>
          </div>
          <h1 className="text-4xl font-bold leading-[1.1] text-text-primary sm:text-5xl lg:text-[52px]">
            Your delivery, sorted in one conversation.
          </h1>
          <p className="text-base leading-relaxed text-text-secondary sm:text-[17px] lg:max-w-[520px]">
            Track a parcel, move a delivery, or file a damage claim by just asking. Every change is confirmed by
            you before it happens — and never happens twice.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* prefetch=false: /chat redirects to a fresh /chat/[id] and creates a chat row as a
                side effect — default prefetching would create one on every hover/scroll-into-view,
                not just real clicks. */}
            <Link
              href="/chat"
              prefetch={false}
              className="rounded-[10px] bg-accent px-6 py-[13px] text-center text-[15px] font-semibold text-white"
            >
              Try the demo
            </Link>
            <Link
              href="/traces"
              className="flex items-center justify-center gap-2 rounded-[10px] border border-border px-6 py-[13px] text-[15px] font-medium text-text-primary"
            >
              <Activity className="h-4 w-4" />
              See agent traces
            </Link>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2.5 rounded-[18px] border border-border bg-bg-subtle p-5 lg:w-[420px] lg:shrink-0">
          <div className="flex justify-end">
            <div className="rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[13px] text-white">
              My parcel says delayed — why?
            </div>
          </div>
          <div className="pr-8">
            <div className="rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-md bg-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-text-primary">
              Heavy rain held it at the Nagpur hub. New ETA is Saturday. Want a different day?
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Reschedule", "Leave instructions", "It's fine"].map((chip) => (
              <span key={chip} className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 bg-bg-subtle px-5 py-10 sm:px-10 lg:px-20 lg:py-12 lg:pb-14">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Grab a demo tracking number</h2>
          <p className="text-sm text-text-secondary sm:text-[15px]">
            Seeded shipments, each in a different (messy) state. Verification code for all of them: 7742.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((trackingNumber) => {
            const { icon: Icon, tone, headline, description } = DEMO_COPY[trackingNumber];
            return (
              <DemoCard
                key={trackingNumber}
                trackingNumber={trackingNumber}
                icon={<Icon className={cn("h-5 w-5", TONE_ICON[tone])} />}
                tone={tone}
                headline={headline}
                description={description}
              />
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 px-5 py-10 sm:grid-cols-3 sm:px-10 lg:px-20 lg:py-12">
        {[
          {
            icon: ShieldCheck,
            title: "You approve every change",
            description: "The agent proposes; nothing executes until you tap confirm. Never twice, even on a double-tap.",
          },
          {
            icon: RefreshCw,
            title: "Survives bad connections",
            description: "Refresh mid-answer and the reply keeps streaming from where it stopped.",
          },
          {
            icon: Activity,
            title: "Fully inspectable",
            description: "Every model step and tool call is traced — open /traces and audit any conversation.",
          },
        ].map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <Icon className="h-5 w-5 text-accent" />
            </div>
            <span className="text-base font-semibold text-text-primary">{title}</span>
            <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
          </div>
        ))}
      </section>

      <footer className="flex flex-col items-start gap-2 border-t border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-20">
        <span className="text-[13px] text-text-secondary">
          Parcel Pilot — Fictional carrier, real agent.
        </span>
      </footer>
    </div>
  );
}
