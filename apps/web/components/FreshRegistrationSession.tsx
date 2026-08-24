"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function FreshRegistrationSession() {
  useEffect(() => {
    if (!supabaseBrowser) return;
    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) void supabaseBrowser.auth.signOut({ scope: "local" });
    });
  }, []);

  return null;
}
