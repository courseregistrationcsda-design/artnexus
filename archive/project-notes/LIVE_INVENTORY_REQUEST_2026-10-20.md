# Live inventory request — read-only, sanitized

**Purpose:** collect the minimum live evidence needed before designing public-heart persistence, public external-video metadata, or a media migration. This is a request/checklist only; no live database was queried, and no schema/data changes are authorized here.

## Safety

- Run only the `SELECT` queries below in the Supabase SQL Editor using an account that can read the catalog. They do not change data.
- Do **not** send API keys, passwords, service-role credentials, OAuth tokens, signed URLs, raw artwork, email addresses, personal briefs, or full user/profile records.
- If a function definition contains any hard-coded secret, remove the secret before sharing. Do not send `.env` files or browser storage dumps.
- For object paths, share only the category/prefix and stable pseudonymous identifiers if possible. Preserve a private local mapping if exact object keys will be needed later.
- If a query errors because a schema/extension is absent or access is denied, report the error text with project identifiers removed; do not work around it by granting extra access.

## Requested outputs

1. **Live schema:** current columns, types, constraints, indexes, table counts, RLS flags, policies, and grants for application tables in `public` and relevant tables in `storage`.
2. **Engagement/video evidence:** any existing tables, columns, RPCs, triggers, or policies related to artwork hearts/likes/reactions, video URLs, public counters, or engagement. Include whether anonymous/authenticated roles can read or write, and whether counts are derived or stored.
3. **Media objects:** bucket settings plus object counts and approximate bytes by bucket/category/MIME. Inventory **every** `creator-public-assets` category (avatar, artwork, WIP, thumbnail, and any other category), not only artwork thumbnails. Do not send object contents or signed URLs.
4. **Rate-limit operations:** installed extensions and scheduled cleanup jobs, if readable. No purge should be run.
5. **Migration state:** applied migration identifiers, if the project exposes them. This must not be treated as proof of data completeness.

## Read-only SQL

### 1. Tables and columns

```sql
select table_schema, table_name, ordinal_position, column_name,
       data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema in ('public', 'storage')
order by table_schema, table_name, ordinal_position;
```

### 2. Constraints and indexes

```sql
select tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_schema as foreign_table_schema,
       ccu.table_name as foreign_table_name, ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_catalog = kcu.constraint_catalog
 and tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_catalog = ccu.constraint_catalog
 and tc.constraint_schema = ccu.constraint_schema
 and tc.constraint_name = ccu.constraint_name
where tc.table_schema in ('public', 'storage')
order by tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname in ('public', 'storage')
order by schemaname, tablename, indexname;
```

### 3. RLS and policies

```sql
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage') and c.relkind in ('r', 'p')
order by n.nspname, c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

### 4. Table grants

```sql
select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
order by table_schema, table_name, grantee, privilege_type;
```

### 5. Table row counts (counts only; no row values)

```sql
select schemaname, relname as table_name, n_live_tup as estimated_live_rows
from pg_stat_user_tables
where schemaname in ('public', 'storage')
order by schemaname, relname;
```

These are estimates. If exact counts are required, run exact `count(*)` separately for each relevant table and return only the counts.

### 6. Supabase Storage bucket configuration and object aggregates

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select bucket_id,
       count(*) as object_count,
       sum(case when coalesce(metadata->>'size', '') ~ '^[0-9]+$'
                then (metadata->>'size')::bigint else 0 end) as total_bytes,
       count(distinct nullif(metadata->>'mimetype', '')) as distinct_mime_types
from storage.objects
group by bucket_id
order by bucket_id;
```

For category-level counts, if `storage.objects.name` uses folder prefixes, share an aggregate by bucket and **sanitized** first/second path component. Replace UUIDs or other creator identifiers with stable labels such as `<creator-1>`; do not share signed URLs. The categorization should distinguish avatars, artwork, WIP, thumbnails, and other media where the current key scheme permits it.

### 7. Functions and triggers (names/security metadata only)

```sql
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, l.lanname as language
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname in ('public', 'storage')
order by n.nspname, p.proname, arguments;

select event_object_schema as schema_name, event_object_table as table_name,
       trigger_name, event_manipulation, action_timing, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'storage')
order by event_object_schema, event_object_table, trigger_name;
```

For functions specifically handling media, reactions/hearts, video metadata, or rate limits, provide the definition only after checking and redacting secrets. Do not provide unrelated function bodies.

### 8. Extensions and scheduled jobs

```sql
select extname, extversion
from pg_extension
order by extname;
```

Only if the `cron` schema and `cron.job` view exist and are readable, inspect job names/schedule/active state. Redact any sensitive text in the job command before sharing; do not create, alter, or run a job.

### 9. Applied migration identifiers (if available)

```sql
select version
from supabase_migrations.schema_migrations
order by version;
```

If this relation is absent or inaccessible, report that; do not create it.

## Return format

You can provide sanitized query results as CSV/Markdown tables or a text export. For bucket objects, include aggregate counts, approximate bytes, MIME types, and category breakdown. For any sample path needed to understand a key convention, redact creator identifiers and tokens. No database URL, keys, access tokens, user emails, briefs, or raw media should be included.

After review, the next proposal can identify what tables/policies already exist, what object categories and counts are present, whether public-heart/video fields can be reused safely, and what migration/rollback plan is needed. No migration SQL should be authored or applied, no media deleted, and nothing deployed until that live inventory is reviewed and separately authorized.
