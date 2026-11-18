-- Explicit privileges for the server-side role.
--
-- Every server path (scripts, API routes, evals) connects with the secret
-- key, i.e. as service_role. The original project relied on Supabase's
-- legacy default of auto-granting new public objects to the API roles.
-- Newer Supabase stacks (local CLI, and new hosted projects) no longer do
-- that, so a database built from these migrations alone refused the RPCs
-- with "permission denied". Granting to service_role explicitly makes the
-- migrations reproducible. anon and authenticated stay without access:
-- nothing here touches them, and RLS (no policies) still applies to them.
-- On a project that already had the legacy grants this is a no-op.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
