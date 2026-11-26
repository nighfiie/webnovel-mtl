import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";

/** True only when the signed-in user has the admin role (checked server-side via has_role). */
export function useIsAdmin() {
  const user = useSessionUser();
  const { data } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      if (error) throw error;
      return Boolean(data);
    },
  });
  return Boolean(user && data);
}
