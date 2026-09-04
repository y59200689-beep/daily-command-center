-- Shared private attachment records for every supported workspace entity.
alter table attachments add column if not exists storage_bucket text not null default 'attachments';
alter table attachments add column if not exists description text;
alter table attachments add column if not exists updated_at timestamptz not null default now();
alter table attachments add column if not exists deleted_at timestamptz;

alter table attachments drop constraint if exists attachments_entity_type_check;
alter table attachments add constraint attachments_entity_type_check
  check (entity_type in ('task','project','client','note','content','decision','invoice')) not valid;

create index if not exists attachments_owner_entity_idx
  on attachments(user_id,entity_type,entity_id,created_at desc) where deleted_at is null;
create unique index if not exists attachments_storage_path_idx
  on attachments(storage_bucket,storage_path) where deleted_at is null;
create index if not exists attachments_search_idx
  on attachments using gin(to_tsvector('simple',file_name||' '||coalesce(description,''))) where deleted_at is null;

drop trigger if exists attachments_updated on attachments;
create trigger attachments_updated before update on attachments for each row execute function set_updated_at();

create or replace function enforce_attachment_entity_owner() returns trigger
language plpgsql security invoker set search_path=public as $$
declare entity_table text; owned boolean;
begin
  if tg_op='UPDATE' then
    if new.user_id=old.user_id and new.entity_type=old.entity_type and new.entity_id=old.entity_id then
      return new;
    end if;
  end if;
  entity_table:=case new.entity_type
    when 'task' then 'tasks'
    when 'project' then 'projects'
    when 'client' then 'clients'
    when 'note' then 'notes'
    when 'content' then 'content_items'
    when 'decision' then 'decisions'
    when 'invoice' then 'invoices'
    else null
  end;
  if entity_table is null then raise exception 'Unsupported attachment entity type.'; end if;
  execute format('select exists(select 1 from %I where id=$1 and user_id=$2 and deleted_at is null)',entity_table)
    into owned using new.entity_id,new.user_id;
  if not owned then raise exception 'Attachment target is not owned by this user.'; end if;
  return new;
end $$;

drop trigger if exists attachments_owned_entity on attachments;
create trigger attachments_owned_entity before insert or update on attachments
  for each row execute function enforce_attachment_entity_owner();
revoke all on function enforce_attachment_entity_owner() from public,anon,authenticated;

-- Preserve existing binary Content uploads while moving new uploads to the shared model.
insert into attachments(id,user_id,entity_type,entity_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,created_at,updated_at)
select ca.id,ca.user_id,'content',ca.content_item_id,'attachments',ca.storage_path,ca.label,ca.mime_type,ca.size_bytes,ca.created_at,ca.created_at
from content_assets ca
where ca.storage_path is not null and ca.deleted_at is null
  and exists(select 1 from content_items ci where ci.id=ca.content_item_id and ci.user_id=ca.user_id and ci.deleted_at is null)
  and not exists(select 1 from attachments a where a.storage_bucket='attachments' and a.storage_path=ca.storage_path)
on conflict(id) do nothing;

update storage.buckets set public=false,file_size_limit=6291456,allowed_mime_types=array[
  'image/jpeg','image/png','image/webp','image/gif','application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv','application/csv',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip','application/x-zip-compressed','application/octet-stream'
]::text[] where id='attachments';

drop policy if exists attachments_storage_read on storage.objects;
drop policy if exists attachments_storage_write on storage.objects;
drop policy if exists attachments_storage_delete_v2 on storage.objects;
drop policy if exists attachments_storage_delete on storage.objects;
create policy attachments_storage_read on storage.objects for select to authenticated
  using(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy attachments_storage_write on storage.objects for insert to authenticated
  with check(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy attachments_storage_delete on storage.objects for delete to authenticated
  using(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists attachments_owner_all on attachments;
create policy attachments_owner_all on attachments for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create or replace function search_workspace(search_query text,result_limit int default 30)
returns table(entity_type text,entity_id uuid,title text,snippet text,rank real,updated_at timestamptz)
language sql security invoker set search_path=public as $$
  select * from (
    select 'task',id,title,coalesce(description,''),1::real,tasks.updated_at from tasks where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'project',id,name,coalesce(description,''),1::real,projects.updated_at from projects where user_id=auth.uid() and deleted_at is null and name ilike '%'||search_query||'%'
    union all select 'note',id,title,left(content,240),1::real,notes.updated_at from notes where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'invoice',id,coalesce(title,invoice_number,'Invoice'),coalesce(description,''),1::real,invoices.updated_at from invoices where user_id=auth.uid() and deleted_at is null and (coalesce(title,'') ilike '%'||search_query||'%' or coalesce(invoice_number,'') ilike '%'||search_query||'%')
    union all select 'payment',id,coalesce(reference,'Payment'),coalesce(notes,''),1::real,created_at from payments where user_id=auth.uid() and deleted_at is null and coalesce(reference,'') ilike '%'||search_query||'%'
    union all select 'expense',id,description,coalesce(vendor,''),1::real,updated_at from expenses where user_id=auth.uid() and deleted_at is null and (description ilike '%'||search_query||'%' or coalesce(vendor,'') ilike '%'||search_query||'%')
    union all select 'subscription',id,name,coalesce(provider,''),1::real,updated_at from subscriptions where user_id=auth.uid() and deleted_at is null and name ilike '%'||search_query||'%'
    union all select 'campaign',id,name,coalesce(description,''),1::real,updated_at from campaigns where user_id=auth.uid() and deleted_at is null and name ilike '%'||search_query||'%'
    union all select 'content',id,title,coalesce(caption,''),1::real,updated_at from content_items where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'prompt',id,title,coalesce(description,''),1::real,updated_at from prompts where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'decision',id,title,left(decision,240),1::real,updated_at from decisions where user_id=auth.uid() and deleted_at is null and title ilike '%'||search_query||'%'
    union all select 'fitness',id,activity_type,coalesce(notes,''),1::real,created_at from fitness_activities where user_id=auth.uid() and deleted_at is null and activity_type ilike '%'||search_query||'%'
    union all
      select 'attachment',a.id,a.file_name,
        concat_ws(' · ',nullif(a.description,''),case a.entity_type
          when 'task' then (select title from tasks where id=a.entity_id and user_id=a.user_id and deleted_at is null)
          when 'project' then (select name from projects where id=a.entity_id and user_id=a.user_id and deleted_at is null)
          when 'client' then (select name from clients where id=a.entity_id and user_id=a.user_id and deleted_at is null)
          when 'note' then (select title from notes where id=a.entity_id and user_id=a.user_id and deleted_at is null)
          when 'content' then (select title from content_items where id=a.entity_id and user_id=a.user_id and deleted_at is null)
          when 'decision' then (select title from decisions where id=a.entity_id and user_id=a.user_id and deleted_at is null)
          when 'invoice' then (select coalesce(title,invoice_number,'Invoice') from invoices where id=a.entity_id and user_id=a.user_id and deleted_at is null)
        end),1::real,a.updated_at
      from attachments a where a.user_id=auth.uid() and a.deleted_at is null and (
        a.file_name ilike '%'||search_query||'%' or coalesce(a.description,'') ilike '%'||search_query||'%' or
        case a.entity_type
          when 'task' then exists(select 1 from tasks where id=a.entity_id and user_id=a.user_id and deleted_at is null and title ilike '%'||search_query||'%')
          when 'project' then exists(select 1 from projects where id=a.entity_id and user_id=a.user_id and deleted_at is null and name ilike '%'||search_query||'%')
          when 'client' then exists(select 1 from clients where id=a.entity_id and user_id=a.user_id and deleted_at is null and name ilike '%'||search_query||'%')
          when 'note' then exists(select 1 from notes where id=a.entity_id and user_id=a.user_id and deleted_at is null and title ilike '%'||search_query||'%')
          when 'content' then exists(select 1 from content_items where id=a.entity_id and user_id=a.user_id and deleted_at is null and title ilike '%'||search_query||'%')
          when 'decision' then exists(select 1 from decisions where id=a.entity_id and user_id=a.user_id and deleted_at is null and title ilike '%'||search_query||'%')
          when 'invoice' then exists(select 1 from invoices where id=a.entity_id and user_id=a.user_id and deleted_at is null and (coalesce(title,'') ilike '%'||search_query||'%' or coalesce(invoice_number,'') ilike '%'||search_query||'%'))
          else false
        end
      )
  ) as results(entity_type,entity_id,title,snippet,rank,updated_at)
  order by results.rank desc,results.updated_at desc limit least(result_limit,50)
$$;
revoke all on function search_workspace(text,int) from public,anon;
grant execute on function search_workspace(text,int) to authenticated;
