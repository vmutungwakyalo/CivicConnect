import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  ALLOWED_IMAGE_TYPES,
  CATEGORIES,
  type RequestCategory,
  validateRequestImage,
} from "@/lib/requests";
import { requestSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/report")({
  validateSearch: (s: Record<string, unknown>): { category?: RequestCategory } => {
    const c = s["category"];
    return CATEGORIES.some((x) => x.value === c) ? { category: c as RequestCategory } : {};
  },
  head: () => ({
    meta: [
      { title: "Report an issue — Huduma Online" },
      {
        name: "description",
        content: "Submit a public service request with category, location, description and photo.",
      },
      { property: "og:title", content: "Report an issue — Huduma Online" },
      { property: "og:description", content: "Submit a public service request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>(search.category ?? "");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const validationError = validateRequestImage(f);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setPhoto({ file: f, previewUrl: URL.createObjectURL(f) });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = requestSchema.safeParse({ category, location, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    try {
      let image_path: string | null = null;
      if (photo) {
        // Files go under the user's own folder; storage rules only allow that.
        image_path = `${user.id}/${crypto.randomUUID()}.${photo.file.name.split(".").pop() ?? "jpg"}`;
        const { error } = await supabase.storage
          .from("request-images")
          .upload(image_path, photo.file, { contentType: photo.file.type });
        if (error) throw error;
      }
      const { data, error } = await supabase
        .from("service_requests")
        .insert({ ...parsed.data, image_path, user_id: user.id })
        .select("ref_no")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      toast.success(`Request ${data.ref_no} submitted`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Report an issue</h1>
      <p className="text-muted-foreground">
        Tell us what's wrong and where. You'll get a reference number to track it.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-6 rounded-xl border bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label id="category-label">Category</Label>
          <div className="grid gap-2 sm:grid-cols-3" role="group" aria-labelledby="category-label">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => setCategory(c.value)}
                aria-pressed={category === c.value}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition ${category === c.value ? "border-primary bg-secondary font-semibold text-primary" : "hover:bg-muted"}`}
              >
                <c.icon className="h-4 w-4 shrink-0" />
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc">Location</Label>
          <Input
            id="loc"
            value={location}
            maxLength={200}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Moi Avenue near Kencom bus stop, Nairobi"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            rows={5}
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is the problem and since when?"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Photo (optional)</Label>
          {photo ? (
            <div className="relative w-fit">
              <img
                src={photo.previewUrl}
                alt="Selected"
                className="h-40 rounded-lg border object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="absolute right-2 top-2 rounded-full bg-card p-1 shadow-card"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted">
              <ImagePlus className="h-6 w-6" /> Click to add a photo (JPG, PNG, WebP · max 5 MB)
              <input
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="sr-only"
                aria-label="Choose an optional request photo"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </div>
  );
}
