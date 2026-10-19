import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RequestCard } from "@/components/RequestCard";
import { StatCards } from "@/components/StatCards";
import { supabase } from "@/integrations/supabase/client";
import { computeStats } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My requests — Huduma Online" },
      { name: "description", content: "Track the status of the issues you reported." },
      { property: "og:title", content: "My requests — Huduma Online" },
      { property: "og:description", content: "Track your service requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-requests", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const stats = computeStats(data);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">My requests</h1>
          <p className="text-muted-foreground">Follow each issue from Pending to Resolved.</p>
        </div>
        <Button asChild>
          <Link to="/report">Report new issue</Link>
        </Button>
      </div>
      <StatCards stats={stats} />
      <div className="mt-8 space-y-4">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {isError && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 p-5 text-destructive"
          >
            Unable to load your requests: {error instanceof Error ? error.message : "Unknown error"}
            <Button className="ml-3" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && data.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            You haven't reported any issues yet.
          </div>
        )}
        {data.map((r) => (
          <RequestCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}
