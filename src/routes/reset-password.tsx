import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — ReadNovel" },
      { name: "description", content: "Set a new password for your ReadNovel account." },
      { property: "og:title", content: "Reset Password — ReadNovel" },
      { property: "og:description", content: "Set a new password for your ReadNovel account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-slate-800 bg-[#121822] p-8 space-y-4">
        <h1 className="text-xl font-semibold text-white">Set new password</h1>
        <div>
          <Label htmlFor="new-password" className="text-slate-300">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 bg-slate-900 border-slate-700 text-white"
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}