import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signupSchema } from "@/lib/validation";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => {
    const r = s["redirect"];
    return typeof r === "string" && r.startsWith("/") ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Huduma Online" },
      {
        name: "description",
        content: "Sign in or create your citizen account to apply for services.",
      },
      { property: "og:title", content: "Sign in — Huduma Online" },
      { property: "og:description", content: "Access your citizen account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function authErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/email rate limit exceeded|rate limit/i.test(message)) {
    return "Supabase has reached its email sending limit. Please wait and try again later.";
  }
  return message || fallback;
}

function isEmailAddress(value: string) {
  return signupSchema.shape.email.safeParse(value).success;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    national_id: "",
    phone: "",
    email: "",
    password: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function forgotPassword() {
    const identifier = form.email.trim();
    if (!isEmailAddress(identifier)) {
      toast.error("Enter your email address to reset your password.");
      return;
    }

    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset link sent to your email.");
    } catch (err) {
      toast.error(authErrorMessage(err, "Unable to send reset email."));
    } finally {
      setResetting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const identifier = form.email.trim();
        if (isEmailAddress(identifier)) {
          const { error } = await supabase.auth.signInWithPassword({
            email: identifier,
            password: form.password,
          });
          if (error) throw error;
        } else {
          const { data, error } = await supabase.functions.invoke<{
            access_token: string;
            refresh_token: string;
          }>("sign-in-with-id", {
            body: { national_id: identifier, password: form.password },
          });
          if (error) {
            if (error.context instanceof Response) {
              const response: unknown = await error.context.clone().json();
              if (isRecord(response) && typeof response["error"] === "string") {
                throw new Error(response["error"]);
              }
            }
            throw error;
          }
          if (!data?.access_token || !data.refresh_token) {
            throw new Error("Unable to sign in right now");
          }
          const { error: sessionError } = await supabase.auth.setSession(data);
          if (sessionError) throw sessionError;
        }
        navigate({ to: redirect ?? "/dashboard" });
      } else {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
        const { email, password, ...meta } = parsed.data;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: meta },
        });
        if (error) throw error;

        setMode("in");
        setForm((current) => ({ ...current, password: "" }));

        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
          if (signOutError) throw signOutError;
          toast.success("Account created. Sign in to continue.");
        } else {
          toast.success("Check your email to confirm your account, then sign in.");
        }
      }
    } catch (err) {
      toast.error(authErrorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="rounded-xl border bg-card p-8 shadow-card">
        <h1 className="text-2xl font-bold">
          {mode === "in" ? "Sign in to your account" : "Create a citizen account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One account for all government services.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "up" && (
            <>
              <Field label="Full name" htmlFor="full-name">
                <Input
                  id="full-name"
                  autoComplete="name"
                  value={form.full_name}
                  onChange={set("full_name")}
                  required
                />
              </Field>
              <Field label="National ID number" htmlFor="national-id">
                <Input
                  id="national-id"
                  value={form.national_id}
                  onChange={set("national_id")}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Phone number" htmlFor="phone-number">
                <Input
                  id="phone-number"
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="07XXXXXXXX"
                  autoComplete="tel"
                  required
                />
              </Field>
            </>
          )}
          <Field
            label={mode === "in" ? "Email address or ID number" : "Email address"}
            htmlFor="email-address"
          >
            <Input
              id="email-address"
              type={mode === "in" ? "text" : "email"}
              value={form.email}
              onChange={set("email")}
              placeholder={
                mode === "in" ? "Enter your email or ID number" : "Enter your email address"
              }
              autoComplete={mode === "in" ? "username" : "email"}
              required
            />
          </Field>
          <Field label="Password" htmlFor="account-password">
            <div className="relative">
              <Input
                id="account-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="Password"
                className="pr-10"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          {mode === "in" && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-60"
                onClick={forgotPassword}
                disabled={resetting || busy}
              >
                {resetting ? "Sending..." : "Forgot Password?"}
              </button>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "in" ? "New here?" : "Already have an account?"}{" "}
          <button
            className="font-semibold text-primary"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
