"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function FreshRegistrationSession() {
  useEffect(() => {
    const client = supabaseBrowser;
    if (!client) return;
    void client.auth.getSession().then(({ data }) => {
      if (data.session) void client.auth.signOut({ scope: "local" });
    });
  }, []);

  return null;
}
