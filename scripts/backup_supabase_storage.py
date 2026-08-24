#!/usr/bin/env python3
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

BASE = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DEST = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "backup/storage")

if not BASE or not KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")


def auth_headers(content_type=False):
    result = {"apikey": KEY}
    # Modern sb_secret_* keys are opaque and are authenticated through apikey.
    # Legacy service_role JWTs still support Authorization: Bearer.
    if KEY.startswith("eyJ"):
        result["Authorization"] = f"Bearer {KEY}"
    if content_type:
        result["Content-Type"] = "application/json"
    return result


def request_json(method: str, path: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, headers=auth_headers(content_type=True), method=method
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def download(bucket: str, object_name: str, target: pathlib.Path):
    encoded_bucket = urllib.parse.quote(bucket, safe="")
    encoded_name = urllib.parse.quote(object_name, safe="/")
    req = urllib.request.Request(
        f"{BASE}/storage/v1/object/authenticated/{encoded_bucket}/{encoded_name}",
        headers=auth_headers(),
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(req, timeout=120) as response, target.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)


def list_prefix(bucket: str, prefix: str = ""):
    offset = 0
    while True:
        encoded_bucket = urllib.parse.quote(bucket, safe="")
        rows = request_json(
            "POST",
            f"/storage/v1/object/list/{encoded_bucket}",
            {"limit": 1000, "offset": offset, "prefix": prefix, "sortBy": {"column": "name", "order": "asc"}},
        )
        if not rows:
            return
        for row in rows:
            name = str(row.get("name") or "")
            if not name:
                continue
            full_name = f"{prefix}/{name}" if prefix else name
            is_folder = row.get("id") is None and row.get("metadata") is None
            if is_folder:
                yield from list_prefix(bucket, full_name)
            else:
                yield full_name
        if len(rows) < 1000:
            return
        offset += len(rows)


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    buckets = request_json("GET", "/storage/v1/bucket")
    count = 0
    for bucket_row in buckets:
        bucket = str(bucket_row.get("id") or bucket_row.get("name") or "").strip()
        if not bucket:
            continue
        for object_name in list_prefix(bucket):
            safe_parts = [part for part in pathlib.PurePosixPath(object_name).parts if part not in ("", ".", "..")]
            target = DEST / bucket / pathlib.Path(*safe_parts)
            download(bucket, object_name, target)
            count += 1
    print(f"Backed up {count} Storage object(s).")


if __name__ == "__main__":
    main()
