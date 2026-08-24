#!/usr/bin/env python3
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DEST = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "backup/database")
PAGE_SIZE = 1000

if not BASE or not KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")


def headers(extra=None):
    result = {
        "apikey": KEY,
        "Accept": "application/json",
    }
    # Legacy service_role keys are JWTs. Modern sb_secret_* keys are opaque
    # and must not be sent as Bearer tokens.
    if KEY.startswith("eyJ"):
        result["Authorization"] = f"Bearer {KEY}"
    if extra:
        result.update(extra)
    return result


def request_json(url, extra_headers=None, timeout=90):
    req = urllib.request.Request(url, headers=headers(extra_headers), method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else None


def discover_tables():
    req = urllib.request.Request(
        f"{BASE}/rest/v1/",
        headers=headers({"Accept": "application/openapi+json"}),
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        spec = json.loads(response.read().decode("utf-8"))

    tables = []
    for path, methods in (spec.get("paths") or {}).items():
        if not isinstance(path, str) or not path.startswith("/"):
            continue
        name = path[1:]
        if not name or "/" in name or name.startswith("rpc/"):
            continue
        if not isinstance(methods, dict) or "get" not in methods:
            continue
        tables.append(name)
    return sorted(set(tables))


def safe_filename(name):
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name)


def export_table(table):
    rows = []
    start = 0
    encoded = urllib.parse.quote(table, safe="")
    while True:
        end = start + PAGE_SIZE - 1
        url = f"{BASE}/rest/v1/{encoded}?select=*"
        page = request_json(
            url,
            {
                "Range-Unit": "items",
                "Range": f"{start}-{end}",
                "Prefer": "count=none",
            },
        )
        if not isinstance(page, list):
            raise RuntimeError(f"Unexpected response exporting {table}")
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        start += len(page)
    out = DEST / "tables" / f"{safe_filename(table)}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(rows)


def export_auth_users_best_effort():
    out = DEST / "auth-users.json"
    status = {"exported": False, "note": "Auth passwords are never exportable."}
    try:
        users = []
        page = 1
        while True:
            url = f"{BASE}/auth/v1/admin/users?page={page}&per_page=1000"
            payload = request_json(url)
            if isinstance(payload, dict):
                batch = payload.get("users") or []
            elif isinstance(payload, list):
                batch = payload
            else:
                batch = []
            users.extend(batch)
            if len(batch) < 1000:
                break
            page += 1
        out.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")
        status.update({"exported": True, "users": len(users)})
    except Exception as exc:
        status["error"] = type(exc).__name__
    (DEST / "AUTH_EXPORT_STATUS.json").write_text(
        json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return status


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    tables = discover_tables()
    if not tables:
        raise SystemExit("No PostgREST tables/views discovered")

    summary = {}
    failures = {}
    for table in tables:
        try:
            summary[table] = export_table(table)
            print(f"{table}: {summary[table]} row(s)")
        except urllib.error.HTTPError as exc:
            failures[table] = f"HTTP {exc.code}"
        except Exception as exc:
            failures[table] = type(exc).__name__

    # A logical backup must not silently succeed if every table failed.
    if not summary:
        raise SystemExit(f"All table exports failed: {failures}")

    manifest = {
        "backup_type": "logical-operational",
        "tables_discovered": len(tables),
        "tables_exported": len(summary),
        "rows_by_table": summary,
        "table_failures": failures,
    }
    (DEST / "TABLES.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    export_auth_users_best_effort()
    print(f"Exported {len(summary)}/{len(tables)} PostgREST table(s)/view(s).")


if __name__ == "__main__":
    main()
