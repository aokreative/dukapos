create or replace function get_all_tenants()
returns table (
  id uuid,
  owner_email text,
  name text,
  business_type text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') != 'aokreative@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  return query
  select 
    s.id,
    u.email::text as owner_email,
    s.name,
    s.business_type,
    'active'::text as status,
    s.created_at
  from shops s
  left join auth.users u on s.owner_id = u.id;
end;
$$;
