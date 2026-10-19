import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestCard, type ServiceRequest } from "@/components/RequestCard";
import { StatCards } from "@/components/StatCards";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/session";
import {
  CATEGORIES,
  computeStats,
  STATUS_FLOW,
  STATUS_LABEL,
  type RequestStatus,
} from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Huduma Online" },
      { name: "description", content: "Manage citizen service requests and view case analytics." },
      { property: "og:title", content: "Admin dashboard — Huduma Online" },
      { property: "og:description", content: "Manage service requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Profile = { id: string; full_name: string; phone: string | null };
const EMPTY_REQUESTS: ServiceRequest[] = [];

function Admin() {
  const { user } = Route.useRouteContext();
  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
    error: rolesQueryError,
    refetch: refetchRoles,
  } = useRoles(user.id);
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");

  const {
    data,
    isLoading,
    isError,
    error: requestsError,
    refetch,
  } = useQuery({
    queryKey: ["all-requests"],
    enabled: !!roles?.isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set(data.map((r) => r.user_id))];
      let profiles: Profile[] = [];
      if (ids.length) {
        const { data: rows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", ids);
        if (profilesError) throw profilesError;
        profiles = rows;
      }
      return {
        requests: data,
        profiles: new Map(profiles.map((p) => [p.id, p])),
      };
    },
  });

  const requests = data?.requests ?? EMPTY_REQUESTS;
  const stats = computeStats(requests);
  const rows = useMemo(
    () =>
      requests.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (category === "all" || r.category === category) &&
          `${r.ref_no} ${r.location} ${r.description}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [requests, status, category, q],
  );

  if (rolesLoading)
    return <p className="mx-auto max-w-6xl px-4 py-12 text-muted-foreground">Loading…</p>;
  if (rolesError)
    return (
      <div role="alert" className="mx-auto max-w-6xl px-4 py-12 text-destructive">
        Unable to verify your staff access:{" "}
        {rolesQueryError instanceof Error ? rolesQueryError.message : "Unknown error"}{" "}
        <Button variant="outline" onClick={() => refetchRoles()}>
          Retry
        </Button>
      </div>
    );
  if (!roles?.isStaff)
    return <p className="mx-auto max-w-6xl px-4 py-12">This page is only for county officers.</p>;

  const statusData = STATUS_FLOW.map((s) => ({
    name: STATUS_LABEL[s],
    value: stats.byStatus[s],
    key: s,
  }));
  const categoryData = CATEGORIES.map((c) => ({
    name: c.label.split(" ")[0],
    value: stats.byCategory[c.value] ?? 0,
  }));
  const colors: Record<RequestStatus, string> = {
    pending: "var(--warning)",
    in_progress: "var(--info)",
    resolved: "var(--success)",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Admin dashboard</h1>
      <p className="text-muted-foreground">Review, update and resolve citizen requests.</p>
      <StatCards stats={stats} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="font-bold">Open vs resolved</h2>
          <ChartContainer config={{ value: { label: "Requests" } }} className="mx-auto h-56">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
              >
                {statusData.map((d) => (
                  <Cell key={d.key} fill={colors[d.key]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex justify-center gap-4 text-xs">
            {statusData.map((d) => (
              <span key={d.key} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[d.key] }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="font-bold">Requests by category</h2>
          <ChartContainer
            config={{ value: { label: "Requests", color: "var(--primary)" } }}
            className="h-64 w-full"
          >
            <BarChart data={categoryData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          aria-label="Search requests by reference, location or description"
          placeholder="Search ref, location, description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-44" aria-label="Filter requests by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_FLOW.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48" aria-label="Filter requests by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {isError && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 p-5 text-destructive"
          >
            Unable to load requests:{" "}
            {requestsError instanceof Error ? requestsError.message : "Unknown error"}
            <Button className="ml-3" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            No requests match.
          </div>
        )}
        {rows.map((r) => (
          <AdminRequest key={r.id} r={r} profile={data?.profiles.get(r.user_id)} />
        ))}
      </div>
    </div>
  );
}

function AdminRequest({ r, profile }: { r: ServiceRequest; profile?: Profile | undefined }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(r.admin_notes ?? "");
  const [busy, setBusy] = useState(false);

  async function setStatus(status: RequestStatus) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status, admin_notes: notes.trim() || null })
        .eq("id", r.id);
      if (error) throw error;
      toast.success(`${r.ref_no} marked ${STATUS_LABEL[status]}`);
      qc.invalidateQueries({ queryKey: ["all-requests"] });
      qc.invalidateQueries({ queryKey: ["history", r.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequestCard
      r={r}
      meta={
        <p className="text-sm text-muted-foreground">
          Reported by {profile?.full_name || "Unnamed citizen"}
          {profile?.phone ? ` · ${profile.phone}` : ""}
        </p>
      }
      footer={
        <div className="mt-4 border-t pt-4">
          <Textarea
            aria-label={`Officer update for ${r.ref_no}`}
            rows={2}
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Update for the citizen (optional)"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_FLOW.map((s) => (
              <Button
                key={s}
                size="sm"
                disabled={busy}
                variant={s === "resolved" ? "default" : "outline"}
                aria-label={`Set ${r.ref_no} status to ${STATUS_LABEL[s]}`}
                onClick={() => setStatus(s)}
              >
                {s === r.status ? `Save note (${STATUS_LABEL[s]})` : `Mark ${STATUS_LABEL[s]}`}
              </Button>
            ))}
          </div>
        </div>
      }
    />
  );
}
