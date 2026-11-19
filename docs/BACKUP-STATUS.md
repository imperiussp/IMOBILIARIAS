# Supabase Backup Status

- Result: **FAILURE**
- Commit: `8459e3aaffdb99512228e7e406f4f645146ed38a`
- Run: `44557697285`
- Checked at UTC: `2026-11-19T15:43:32Z`
- Data export exit: `0`
- Storage export exit: `1`
- Schema copy exit: `0`

## Diagnostic tail
```text
[data]
property_photos: 91 row(s)
property_price_history: 1 row(s)
property_status_history: 2 row(s)
property_types: 17 row(s)
property_visit_appointments: 0 row(s)
site_settings: 1 row(s)
subscription_plans: 6 row(s)
synchronization_jobs: 0 row(s)
test_client_accounts: 1 row(s)
user_device_sessions: 24 row(s)
user_roles: 1 row(s)
Exported 104/106 PostgREST table(s)/view(s).
[storage]
    response = meth(req, response)
  File "/usr/lib/python3.14/urllib/request.py", line 602, in http_response
    response = self.parent.error(
        'http', request, response, code, msg, hdrs)
  File "/usr/lib/python3.14/urllib/request.py", line 531, in error
    return self._call_chain(*args)
           ~~~~~~~~~~~~~~~~^^^^^^^
  File "/usr/lib/python3.14/urllib/request.py", line 464, in _call_chain
    result = func(*args)
  File "/usr/lib/python3.14/urllib/request.py", line 611, in http_error_default
    raise HTTPError(req.full_url, code, msg, hdrs, fp)
urllib.error.HTTPError: HTTP Error 522: <none>
[schema]
```
