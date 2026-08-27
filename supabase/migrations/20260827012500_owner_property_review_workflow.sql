alter table public.owner_property_submissions
  add column if not exists title text,
  add column if not exists status text not null default 'pending',
  add column if not exists published_property_id uuid references public.properties(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.owner_property_submissions
set title = coalesce(nullif(title,''), trim(property_type || case when neighborhood is not null and neighborhood <> '' then ' em ' || neighborhood else ' em ' || city end))
where title is null or title = '';

alter table public.owner_property_submissions drop constraint if exists owner_property_submissions_status_check;
alter table public.owner_property_submissions add constraint owner_property_submissions_status_check check (status in ('pending','published'));

create index if not exists owner_property_submissions_agency_status_created_idx
  on public.owner_property_submissions(agency_id,status,created_at desc);
create index if not exists owner_property_submissions_published_property_idx
  on public.owner_property_submissions(published_property_id) where published_property_id is not null;

drop trigger if exists trg_owner_property_submissions_updated_at on public.owner_property_submissions;
create trigger trg_owner_property_submissions_updated_at
before update on public.owner_property_submissions
for each row execute function public.set_updated_at();

drop policy if exists "agency members update owner property submissions" on public.owner_property_submissions;
create policy "agency members update owner property submissions"
on public.owner_property_submissions for update
to authenticated
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "agency members read owner property submission files" on storage.objects;
create policy "agency members read owner property submission files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'owner-property-submissions'
  and public.is_agency_member(split_part(name,'/',1)::uuid)
);
