import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSessionUser } from "@/lib/session";
import { STATUS_LABEL, type RequestStatus } from "@/lib/requests";

const navLink = "rounded-md px-3 py-2 hover:bg-muted";
const active = { className: "font-semibold text-primary" };

/** Top navigation. Links adapt to the signed-in user and their role. */
export function SiteHeader() {
  const { user } = useSessionUser();
  const { data: roles } = useRoles(user?.id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  }

  return (
    <header className="border-b bg-card">
      <div className="flag-stripe h-1" />
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-primary"
        >
          <Landmark className="h-6 w-6" /> Huduma Online
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {user ? (
            <>
              <Link to="/report" className={navLink} activeProps={active}>
                Report issue
              </Link>
              <Link to="/dashboard" className={navLink} activeProps={active}>
                My requests
              </Link>
              {roles?.isStaff && (
                <Link to="/admin" className={navLink} activeProps={active}>
                  Admin dashboard
                </Link>
              )}
              <Link to="/profile" className={navLink} activeProps={active}>
                Profile
              </Link>
              <Button variant="outline" size="sm" className="ml-2" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth" search={{}}>
                Sign in
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

const statusStyle: Record<RequestStatus, string> = {
  pending: "bg-warning/20 text-foreground",
  in_progress: "bg-info/15 text-info",
  resolved: "bg-success/15 text-success",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
