import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Huduma Online" },
      { name: "description", content: "Manage your citizen profile details." },
      { property: "og:title", content: "My profile — Huduma Online" },
      { property: "og:description", content: "Manage your citizen profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user } = Route.useRouteContext();
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ full_name: "", national_id: "", phone: "" });
  useEffect(() => {
    if (data)
      setForm({
        full_name: data.full_name ?? "",
        national_id: data.national_id ?? "",
        phone: data.phone ?? "",
      });
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.full_name.trim().length < 2) {
      toast.error("Enter your full name");
      return;
    }
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...form });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    refetch();
  }

  if (isLoading)
    return <p className="mx-auto max-w-lg px-4 py-12 text-muted-foreground">Loading profile…</p>;
  if (isError)
    return (
      <div role="alert" className="mx-auto max-w-lg px-4 py-12 text-destructive">
        Unable to load your profile: {error instanceof Error ? error.message : "Unknown error"}{" "}
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-3xl font-extrabold">My profile</h1>
      <p className="text-muted-foreground">{user.email}</p>
      <form onSubmit={save} className="mt-6 space-y-4 rounded-xl border bg-card p-6 shadow-card">
        {(["full_name", "national_id", "phone"] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={`profile-${k}`} className="capitalize">
              {k.replace("_", " ")}
            </Label>
            <Input
              id={`profile-${k}`}
              value={form[k]}
              maxLength={100}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </div>
        ))}
        <Button type="submit">Save changes</Button>
      </form>
    </div>
  );
}
