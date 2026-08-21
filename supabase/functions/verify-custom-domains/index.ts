import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const verifySecret = Deno.env.get("DOMAIN_VERIFY_SECRET") || "";
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function dnsQuery(name: string, type: "CNAME" | "TXT") {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
  });
  if (!response.ok) throw new Error(`DNS HTTP ${response.status}`);
  return await response.json();
}

function normalizeDnsValue(value: unknown) {
  return String(value ?? "").trim().replace(/^"|"$/g, "").replace(/\.$/, "").toLowerCase();
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500);
  if (!verifySecret || request.headers.get("x-domain-verify-secret") !== verifySecret) return json({ error: "unauthorized" }, 401);

  const { data: rows, error } = await supabase
    .from("agency_domains")
    .select("id,hostname,verification_token,verification_status")
    .eq("kind", "custom")
    .eq("verified", false)
    .in("verification_status", ["pending", "checking", "failed"])
    .order("last_verification_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) return json({ error: error.message }, 500);
  let verified = 0;
  let failed = 0;

  for (const domain of rows || []) {
    await supabase.from("agency_domains").update({
      verification_status: "checking",
      last_verification_at: new Date().toISOString(),
      verification_error: null,
    }).eq("id", domain.id);

    try {
      const [cnameResult, txtResult] = await Promise.allSettled([
        dnsQuery(domain.hostname, "CNAME"),
        domain.verification_token ? dnsQuery(`_lenoy-verification.${domain.hostname}`, "TXT") : Promise.resolve({ Answer: [] }),
      ]);

      const cnameBody: any = cnameResult.status === "fulfilled" ? cnameResult.value : null;
      const txtBody: any = txtResult.status === "fulfilled" ? txtResult.value : null;
      const cnameAnswers = Array.isArray(cnameBody?.Answer) ? cnameBody.Answer : [];
      const txtAnswers = Array.isArray(txtBody?.Answer) ? txtBody.Answer : [];

      const cnameOk = cnameAnswers.some((answer: any) => normalizeDnsValue(answer?.data) === "imoveis.lenoy.com.br");
      const token = normalizeDnsValue(domain.verification_token);
      const txtOk = Boolean(token) && txtAnswers.some((answer: any) => normalizeDnsValue(answer?.data).includes(token));

      if (cnameOk || txtOk) {
        await supabase.from("agency_domains").update({
          verified: true,
          verified_at: new Date().toISOString(),
          verification_status: "verified",
          last_verification_at: new Date().toISOString(),
          verification_error: null,
        }).eq("id", domain.id);
        verified += 1;
      } else {
        await supabase.from("agency_domains").update({
          verification_status: "failed",
          last_verification_at: new Date().toISOString(),
          verification_error: "CNAME para imoveis.lenoy.com.br ou TXT de verificação ainda não encontrado.",
        }).eq("id", domain.id);
        failed += 1;
      }
    } catch (verificationError) {
      await supabase.from("agency_domains").update({
        verification_status: "failed",
        last_verification_at: new Date().toISOString(),
        verification_error: verificationError instanceof Error ? verificationError.message.slice(0, 500) : String(verificationError).slice(0, 500),
      }).eq("id", domain.id);
      failed += 1;
    }
  }

  return json({ checked: rows?.length || 0, verified, failed });
});
