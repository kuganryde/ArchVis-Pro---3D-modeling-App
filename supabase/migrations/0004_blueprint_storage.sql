-- ArchViz Pro — blueprint object storage.
-- Blueprint images can be several MB; storing them as base64 inside the project
-- JSONB row bloats every autosave and risks row-size limits. Instead we keep
-- them in a private Storage bucket and store only the object PATH in the project.
--
-- Path convention: <workspace_id>/<project_id>/<file>. RLS on storage.objects
-- scopes access to members of the workspace named by the first path segment.

-- Private bucket (served via short-lived signed URLs from the client).
insert into storage.buckets (id, name, public)
  values ('blueprints', 'blueprints', false)
  on conflict (id) do nothing;

-- Members of the workspace (first path segment) may read their blueprints.
drop policy if exists "blueprints read" on storage.objects;
create policy "blueprints read" on storage.objects
  for select using (
    bucket_id = 'blueprints'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- Members may upload blueprints under their workspace prefix.
drop policy if exists "blueprints insert" on storage.objects;
create policy "blueprints insert" on storage.objects
  for insert with check (
    bucket_id = 'blueprints'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- Members may overwrite their blueprints.
drop policy if exists "blueprints update" on storage.objects;
create policy "blueprints update" on storage.objects
  for update using (
    bucket_id = 'blueprints'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- Members may delete their blueprints.
drop policy if exists "blueprints delete" on storage.objects;
create policy "blueprints delete" on storage.objects
  for delete using (
    bucket_id = 'blueprints'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
