import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Send, Wrench } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/requests";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Huduma Online — Report public service issues" },
      {
        name: "description",
        content:
          "A better neighborhood starts with your report. Report a county issue and follow its progress to resolution.",
      },
      { property: "og:title", content: "Huduma Online — Report public service issues" },
      {
        property: "og:description",
        content:
          "A better neighborhood starts with your report. Report a county issue and follow its progress to resolution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: Send,
    title: "Report",
    text: "Pick a category, add the location, a description and an optional photo.",
  },
  {
    icon: Wrench,
    title: "We act",
    text: "County officers review your request and move it to In Progress.",
  },
  {
    icon: ClipboardList,
    title: "Track",
    text: "Follow every status change until the issue is Resolved.",
  },
];

function Index() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <img
          src={hero}
          alt="Citizens being served at a public service centre"
          width={1600}
          height={1008}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="bg-hero absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-ink-foreground">
          <p className="text-sm font-semibold uppercase tracking-widest opacity-80">
            Public Service Request System
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
            A better neighborhood starts with your report.
          </h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">
            Report a county issue and follow its progress to resolution.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/report">
                Report an issue <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-ink-foreground">
              <Link to="/dashboard">Track my requests</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold">What you can report</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              to="/report"
              search={{ category: c.value }}
              className="group flex gap-4 rounded-xl border bg-card p-5 shadow-card transition hover:border-primary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <c.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold">{c.label}</span>
                <span className="text-sm text-muted-foreground">{c.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title}>
              <span className="font-display text-sm font-bold text-accent">0{i + 1}</span>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-bold">
                <s.icon className="h-5 w-5 text-primary" />
                {s.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
