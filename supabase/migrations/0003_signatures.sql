-- 0003_signatures.sql: Storage bucket for approver signatures (Private)
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;
