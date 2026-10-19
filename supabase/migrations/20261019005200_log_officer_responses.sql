with repeated_notes as (
  select id,
    note,
    lag(note) over (partition by request_id order by created_at, id) as previous_note
  from public.request_status_history
)
update public.request_status_history history
set note = null
from repeated_notes
where history.id = repeated_notes.id
  and repeated_notes.note is not null
  and repeated_notes.note = repeated_notes.previous_note;

create or replace function public.log_request_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
    or new.status is distinct from old.status
    or new.admin_notes is distinct from old.admin_notes then
    insert into public.request_status_history (request_id, status, note, changed_by)
    values (
      new.id,
      new.status,
      case
        when tg_op = 'UPDATE' and new.admin_notes is distinct from old.admin_notes then new.admin_notes
      end,
      auth.uid()
    );
  end if;
  return new;
end;
$$;
