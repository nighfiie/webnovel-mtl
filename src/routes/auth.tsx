import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : "/admin",
  }),
  head: () => ({
    meta: [
      { title: "Sign In — ReadNovel" },
      { name: "description", content: "Sign in to manage novels, chapters, and translations on ReadNovel." },
      { property: "og:title", content: "Sign In — ReadNovel" },
      { property: "og:description", content: "Sign in to manage novels, chapters, and translations on ReadNovel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const safeTarget = redirectTo.startsWith("/") ? redirectTo : "/admin";
        navigate({ to: safeTarget as "/admin", replace: true });
      }
    });
  }, [navigate, redirectTo]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    setConfirmMessage(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setConfirmMessage("Password reset link sent! Check your email.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created!");
          navigate({ to: "/admin", replace: true });
        } else {
          setConfirmMessage("Check your email to confirm your account before signing in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Signed in");
        const safeTarget = redirectTo.startsWith("/") ? redirectTo : "/admin";
        navigate({ to: safeTarget as "/admin", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "lovable") => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message || "Sign-in failed");
      return;
    }
    if (!result.redirected) {
      const safeTarget = redirectTo.startsWith("/") ? redirectTo : "/admin";
      navigate({ to: safeTarget as "/admin", replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#121822] p-8 shadow-xl">
        <div className="mb-6 text-center">
          <Link to="/" className="text-xl font-bold tracking-tight text-blue-400">
            ReadNovel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Access your novel library and admin tools
          </p>
        </div>

        {confirmMessage && (
          <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
            {confirmMessage}
          </div>
        )}

        {mode !== "forgot" && (
          <div className="space-y-2.5 mb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("google")}
              className="w-full h-10 bg-[#131314] border-[#8E918F] text-[#E3E3E3] hover:bg-[#1f1f21] hover:text-white gap-2.5"
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuth("lovable")}
              className="w-full h-10 bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800 gap-2.5"
            >
              <LovableMark className="h-[18px] w-[18px]" />
              Continue with Lovable
            </Button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#121822] px-2 text-slate-500">or with email</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 bg-slate-900 border-slate-700 text-white"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 bg-slate-900 border-slate-700 text-white"
                required
              />
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          {mode === "signin" ? (
            <>
              <button type="button" onClick={() => setMode("signup")} className="hover:text-blue-400">
                Need an account? Sign up
              </button>
              <button type="button" onClick={() => setMode("forgot")} className="hover:text-blue-400">
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setMode("signin")} className="hover:text-blue-400">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}