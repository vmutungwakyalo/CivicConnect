import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { StatusBadge } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { categoryLabel, STATUS_FLOW, STATUS_LABEL } from "@/lib/requests";

export type ServiceRequest = Database["public"]["Tables"]["service_requests"]["Row"];

/** One request with progress bar, optional photo and expandable status history. */
export function RequestCard({
  r,
  footer,
  meta,
}: {
  r: ServiceRequest;
  footer?: ReactNode;
  meta?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const stepIndex = STATUS_FLOW.indexOf(r.status);

  const {
    data: imageUrl,
    isError: imageError,
    error: imageQueryError,
  } = useQuery({
    queryKey: ["request-image", r.image_path],
    enabled: !!r.image_path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("request-images")
        .createSignedUrl(r.image_path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const {
    data: history = [],
    isError: historyError,
    error: historyQueryError,
  } = useQuery({
    queryKey: ["history", r.id, r.status],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_status_history")
        .select("*")
        .eq("request_id", r.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const seenResponses = new Set<string>();
  const historyWithUniqueResponses = history.map((entry) => {
    if (!entry.note) return entry;
    if (seenResponses.has(entry.note)) return { ...entry, note: null };
    seenResponses.add(entry.note);
    return entry;
  });

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {r.ref_no} · {new Date(r.created_at).toLocaleString("en-KE")}
          </p>
          <h3 className="text-lg font-bold">{categoryLabel(r.category)}</h3>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            {r.location}
          </p>
          {meta}
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        <p className="flex-1 whitespace-pre-wrap text-sm">{r.description}</p>
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noreferrer">
            <img
              src={imageUrl}
              alt="Reported issue"
              loading="lazy"
              className="h-28 w-40 rounded-lg border object-cover"
            />
          </a>
        )}
      </div>
      {imageError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Unable to load the attached photo:{" "}
          {imageQueryError instanceof Error ? imageQueryError.message : "Unknown error"}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        {STATUS_FLOW.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`} />
            <p
              className={`mt-1 text-xs ${i <= stepIndex ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {STATUS_LABEL[s]}
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 text-sm font-semibold text-primary"
        aria-expanded={open}
        aria-controls={`history-${r.id}`}
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide history" : "Show history"}
      </button>
      {open &&
        (historyError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Unable to load request history:{" "}
            {historyQueryError instanceof Error ? historyQueryError.message : "Unknown error"}
          </p>
        ) : (
          <ol
            id={`history-${r.id}`}
            className="mt-2 space-y-1 border-l-2 border-primary/30 pl-4 text-sm"
          >
            {historyWithUniqueResponses.map((h) => (
              <li key={h.id}>
                <strong>{STATUS_LABEL[h.status]}</strong>{" "}
                <span className="text-muted-foreground">
                  — {new Date(h.created_at).toLocaleString("en-KE")}
                </span>
                {h.note && (
                  <span className="block text-muted-foreground">
                    <strong>Officer response:</strong> {h.note}
                  </span>
                )}
              </li>
            ))}
          </ol>
        ))}
      {footer}
    </div>
  );
}
