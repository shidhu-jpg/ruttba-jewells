-- ============================================================
-- RUTTBA JEWELS — staff sharing & click tracking
-- Run in Supabase → SQL Editor → New query → Run. Safe to re-run after every update of this file.
-- ⚠ Change the owner password at the very bottom before running
--   (it can also be changed later from admin.html → Settings).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rj_staff (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null unique,          -- last 10 digits
  pin_hash     text not null,
  ref          text not null unique,          -- code put in shared links (?ref=)
  token        text not null unique,          -- staff session token
  active       boolean not null default true,
  failed       int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.rj_owner (
  id           int primary key default 1 check (id = 1),
  pass_hash    text not null,
  token        text,
  failed       int not null default 0,
  locked_until timestamptz
);

create table if not exists public.rj_events (
  id           bigint generated always as identity primary key,
  staff_id     uuid not null references public.rj_staff(id) on delete cascade,
  kind         text not null check (kind in ('view', 'order')),
  product_id   text,
  product_name text,
  visitor      text,
  device       text,
  detail       text,
  created_at   timestamptz not null default now()
);
create index if not exists rj_events_staff_idx on public.rj_events (staff_id, id desc);

-- Tables are never read directly from the website — only through the functions below.
alter table public.rj_staff  enable row level security;
alter table public.rj_owner  enable row level security;
alter table public.rj_events enable row level security;
revoke all on public.rj_staff, public.rj_owner, public.rj_events from anon, authenticated;

-- ---------- helpers ----------
create or replace function public.rj_phone(p text) returns text
language sql immutable as $$ select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10) $$;

create or replace function public.rj_owner_ok(p_token text) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from rj_owner where id = 1 and token is not null and token = p_token)
$$;

create or replace function public.rj_today() returns timestamptz
language sql stable as $$ select date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' $$;

-- ---------- customer side ----------
-- Logs a customer opening a staff link (kind = 'view') or sending an order (kind = 'order').
create or replace function public.rj_track(p_ref text, p_kind text, p_product_id text, p_product_name text,
                                           p_visitor text, p_device text, p_detail text default null) returns json
language plpgsql security definer set search_path = public as $$
declare s rj_staff;
begin
  if p_kind not in ('view', 'order') then return json_build_object('error', 'bad kind'); end if;
  select * into s from rj_staff where ref = upper(p_ref) and active;
  if not found then return json_build_object('error', 'unknown ref'); end if;
  -- same customer re-opening the same link within 6 hours counts once
  if p_kind = 'view' and exists (
    select 1 from rj_events where staff_id = s.id and kind = 'view' and visitor = p_visitor
      and product_id is not distinct from p_product_id and created_at > now() - interval '6 hours') then
    return json_build_object('name', s.name, 'dup', true);
  end if;
  insert into rj_events (staff_id, kind, product_id, product_name, visitor, device, detail)
  values (s.id, p_kind, left(p_product_id, 40), left(p_product_name, 300), left(p_visitor, 64), left(p_device, 40), left(p_detail, 300));
  return json_build_object('name', s.name);
end $$;

-- ---------- staff side ----------
create or replace function public.rj_staff_login(p_phone text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s rj_staff;
begin
  select * into s from rj_staff where phone = rj_phone(p_phone);
  if not found or not s.active then return json_build_object('error', 'This number is not registered. Ask the owner to add you.'); end if;
  if s.locked_until > now() then return json_build_object('error', 'Too many wrong PINs. Try again in 15 minutes.'); end if;
  if s.pin_hash <> crypt(coalesce(p_pin, ''), s.pin_hash) then
    update rj_staff set failed = case when failed + 1 >= 5 then 0 else failed + 1 end,
                        locked_until = case when failed + 1 >= 5 then now() + interval '15 minutes' end
     where id = s.id;
    return json_build_object('error', 'Wrong PIN');
  end if;
  update rj_staff set failed = 0, locked_until = null where id = s.id;
  return json_build_object('token', s.token, 'name', s.name, 'phone', s.phone, 'ref', s.ref);
end $$;

create or replace function public.rj_staff_feed(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare s rj_staff; t timestamptz := rj_today();
begin
  select * into s from rj_staff where token = p_token and active;
  if not found then return json_build_object('error', 'logged_out'); end if;
  return json_build_object(
    'staff', json_build_object('name', s.name, 'phone', s.phone, 'ref', s.ref),
    'stats', (select json_build_object(
                'today',  count(*) filter (where kind = 'view' and created_at >= t),
                'week',   count(*) filter (where kind = 'view' and created_at >= now() - interval '7 days'),
                'total',  count(*) filter (where kind = 'view'),
                'orders', count(*) filter (where kind = 'order'))
              from rj_events where staff_id = s.id),
    'events', coalesce((select json_agg(e) from (
                select id, kind, product_id, product_name, device, detail, created_at
                  from rj_events where staff_id = s.id order by id desc limit 100) e), '[]'));
end $$;

-- ---------- owner side ----------
alter table public.rj_owner add column if not exists username text not null default 'owner';
drop function if exists public.rj_owner_login(text);
drop function if exists public.rj_owner_password(text, text, text);

create or replace function public.rj_owner_login(p_user text, p_pass text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare o rj_owner; t text;
begin
  select * into o from rj_owner where id = 1;
  if not found then return json_build_object('error', 'Owner password is not set. Run supabase/setup.sql.'); end if;
  if o.locked_until > now() then return json_build_object('error', 'Too many wrong attempts. Try again in 15 minutes.'); end if;
  if lower(trim(coalesce(p_user, ''))) <> lower(o.username) or o.pass_hash <> crypt(coalesce(p_pass, ''), o.pass_hash) then
    update rj_owner set failed = case when failed + 1 >= 5 then 0 else failed + 1 end,
                        locked_until = case when failed + 1 >= 5 then now() + interval '15 minutes' end
     where id = 1;
    return json_build_object('error', 'Wrong username or password');
  end if;
  t := coalesce(o.token, encode(gen_random_bytes(24), 'hex'));
  update rj_owner set token = t, failed = 0, locked_until = null where id = 1;
  return json_build_object('token', t);
end $$;

create or replace function public.rj_owner_feed(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare t timestamptz := rj_today();
begin
  if not rj_owner_ok(p_token) then return json_build_object('error', 'logged_out'); end if;
  return json_build_object(
    'stats', (select json_build_object(
                'today',  count(*) filter (where kind = 'view' and created_at >= t),
                'week',   count(*) filter (where kind = 'view' and created_at >= now() - interval '7 days'),
                'total',  count(*) filter (where kind = 'view'),
                'orders', count(*) filter (where kind = 'order'))
              from rj_events),
    'staff', coalesce((select json_agg(x order by x.active desc, x.views desc, x.name) from (
                select s.id, s.name, s.phone, s.ref, s.active, s.created_at,
                       count(e.id) filter (where e.kind = 'view') as views,
                       count(e.id) filter (where e.kind = 'view' and e.created_at >= t) as today,
                       count(e.id) filter (where e.kind = 'order') as orders,
                       max(e.created_at) as last
                  from rj_staff s left join rj_events e on e.staff_id = s.id
                 group by s.id) x), '[]'),
    'events', coalesce((select json_agg(x) from (
                select e.id, e.kind, e.product_id, e.product_name, e.device, e.detail, e.created_at,
                       e.staff_id, s.name as staff_name, s.phone as staff_phone
                  from rj_events e join rj_staff s on s.id = e.staff_id
                 order by e.id desc limit 300) x), '[]'));
end $$;

-- Add (p_id null) or edit a staff member. p_pin null on edit = keep the old PIN.
create or replace function public.rj_owner_save_staff(p_token text, p_id uuid, p_name text, p_phone text,
                                                      p_pin text, p_active boolean default true) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare ph text := rj_phone(p_phone); r text;
begin
  if not rj_owner_ok(p_token) then return json_build_object('error', 'logged_out'); end if;
  if coalesce(trim(p_name), '') = '' then return json_build_object('error', 'Enter the staff name'); end if;
  if length(ph) <> 10 then return json_build_object('error', 'Enter a valid 10-digit mobile number'); end if;
  if p_pin is not null and p_pin !~ '^\d{4,8}$' then return json_build_object('error', 'PIN must be 4 to 8 digits'); end if;
  if exists (select 1 from rj_staff where phone = ph and id is distinct from p_id) then
    return json_build_object('error', 'This number is already added');
  end if;
  if p_id is null then
    if p_pin is null then return json_build_object('error', 'Set a PIN for the new staff member'); end if;
    loop
      r := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
      exit when not exists (select 1 from rj_staff where ref = r);
    end loop;
    insert into rj_staff (name, phone, pin_hash, ref, token)
    values (trim(p_name), ph, crypt(p_pin, gen_salt('bf')), r, encode(gen_random_bytes(24), 'hex'));
  else
    -- a new PIN or switching someone off logs them out everywhere
    update rj_staff set name = trim(p_name), phone = ph, active = coalesce(p_active, active),
           pin_hash = case when p_pin is null then pin_hash else crypt(p_pin, gen_salt('bf')) end,
           token = case when p_pin is null and coalesce(p_active, active) then token else encode(gen_random_bytes(24), 'hex') end,
           failed = 0, locked_until = null
     where id = p_id;
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.rj_owner_delete_staff(p_token text, p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not rj_owner_ok(p_token) then return json_build_object('error', 'logged_out'); end if;
  delete from rj_staff where id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.rj_owner_info(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select case when rj_owner_ok(p_token) then (select json_build_object('username', username) from rj_owner where id = 1)
              else json_build_object('error', 'logged_out') end
$$;

-- Change the owner username and/or password. p_new_pass null/'' = keep the password.
create or replace function public.rj_owner_account(p_token text, p_old_pass text, p_new_user text, p_new_pass text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex'); u text := lower(trim(coalesce(p_new_user, '')));
begin
  if not rj_owner_ok(p_token) then return json_build_object('error', 'logged_out'); end if;
  if u !~ '^[a-z0-9._@-]{3,40}$' then return json_build_object('error', 'Username must be 3–40 letters, numbers or . _ @ -'); end if;
  if coalesce(p_new_pass, '') <> '' and length(p_new_pass) < 6 then return json_build_object('error', 'New password must be at least 6 characters'); end if;
  if not exists (select 1 from rj_owner where id = 1 and pass_hash = crypt(coalesce(p_old_pass, ''), pass_hash)) then
    return json_build_object('error', 'Current password is wrong');
  end if;
  update rj_owner set username = u, token = t,
         pass_hash = case when coalesce(p_new_pass, '') = '' then pass_hash else crypt(p_new_pass, gen_salt('bf')) end
   where id = 1;
  return json_build_object('token', t, 'username', u);
end $$;

-- ---------- products (owner and staff can add) ----------
create table if not exists public.rj_products (
  id            text primary key,
  cat           text not null,
  name          text not null,
  purity        text not null default '',
  weight        text not null default '',
  price         numeric not null check (price >= 0),
  mrp           numeric not null,
  best          boolean not null default false,
  rating        numeric not null default 4.8,
  descr         text not null default '',
  img           text,
  sizes         text[],
  position      int not null default 0,
  active        boolean not null default true,
  added_by      uuid references public.rj_staff(id) on delete set null,
  added_by_name text not null default 'Owner',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.rj_products enable row level security;
revoke all on public.rj_products from anon, authenticated;

-- short-lived upload tickets: the photo path must start with a ticket a logged-in owner/staff got in the last 15 min
create table if not exists public.rj_upload_tickets (
  ticket     text primary key,
  expires_at timestamptz not null
);
alter table public.rj_upload_tickets enable row level security;
revoke all on public.rj_upload_tickets from anon, authenticated;

-- who is calling: the owner, an active staff member, or nobody
create or replace function public.rj_actor(p_token text, out is_owner boolean, out staff_id uuid, out name text)
language plpgsql stable set search_path = public as $$
begin
  if rj_owner_ok(p_token) then is_owner := true; name := 'Owner'; return; end if;
  select false, s.id, s.name into is_owner, staff_id, name from rj_staff s where s.token = p_token and s.active;
end $$;

create or replace function public.rj_product_json(p rj_products) returns json
language sql immutable as $$
  select json_build_object('id', p.id, 'cat', p.cat, 'name', p.name, 'purity', p.purity, 'weight', p.weight,
    'price', p.price, 'mrp', p.mrp, 'best', p.best, 'rating', p.rating, 'desc', p.descr, 'img', p.img, 'sizes', p.sizes)
$$;

-- Public: products shown on the store
create or replace function public.rj_products_list() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(rj_product_json(p) order by p.position, p.created_at), '[]') from rj_products p where p.active
$$;

-- Dashboards: every product incl. hidden ones, with who added it and what the caller may change
create or replace function public.rj_products_manage(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select * into a from rj_actor(p_token);
  if a.is_owner is null then return json_build_object('error', 'logged_out'); end if;
  return coalesce((select json_agg((rj_product_json(p)::jsonb || jsonb_build_object(
            'active', p.active, 'added_by_name', p.added_by_name, 'created_at', p.created_at,
            'can_edit', coalesce(a.is_owner or p.added_by = a.staff_id, false)))::json order by p.position, p.created_at)
          from rj_products p), '[]');
end $$;

create or replace function public.rj_upload_ticket(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a record; t text := encode(gen_random_bytes(16), 'hex');
begin
  select * into a from rj_actor(p_token);
  if a.is_owner is null then return json_build_object('error', 'logged_out'); end if;
  delete from rj_upload_tickets where expires_at < now();
  insert into rj_upload_tickets values (t, now() + interval '15 minutes');
  return json_build_object('ticket', t);
end $$;

-- used by the storage policy below
create or replace function public.rj_ticket_ok(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rj_upload_tickets where ticket = split_part(p_name, '/', 1) and expires_at > now())
$$;

-- Add (p_id null) or edit a product. Staff can only edit products they added.
create or replace function public.rj_product_save(p_token text, p_id text, p jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a record; cur rj_products; nid text;
  v_name text := trim(coalesce(p->>'name', '')); v_cat text := trim(coalesce(p->>'cat', ''));
  v_price numeric; v_mrp numeric; v_img text := nullif(trim(coalesce(p->>'img', '')), '');
  v_sizes text[] := (select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(p->'sizes', '[]')) x where trim(x) <> '');
begin
  select * into a from rj_actor(p_token);
  if a.is_owner is null then return json_build_object('error', 'logged_out'); end if;
  if v_name = '' then return json_build_object('error', 'Enter the product name'); end if;
  if v_cat = '' then return json_build_object('error', 'Choose a category'); end if;
  begin
    v_price := (p->>'price')::numeric; v_mrp := coalesce(nullif(p->>'mrp', '')::numeric, v_price);
  exception when others then return json_build_object('error', 'Price must be a number'); end;
  if v_price is null or v_price <= 0 then return json_build_object('error', 'Enter the price'); end if;
  if v_mrp < v_price then v_mrp := v_price; end if;
  if v_img is not null and v_img !~ '^images/[\w.-]+$' and v_img not like '%/storage/v1/object/public/rj-products/%' then
    return json_build_object('error', 'Upload the photo from this page');
  end if;

  if p_id is null then
    if v_img is null then return json_build_object('error', 'Add a photo of the piece'); end if;
    loop
      nid := 'p' || substr(encode(gen_random_bytes(4), 'hex'), 1, 7);
      exit when not exists (select 1 from rj_products where id = nid);
    end loop;
    insert into rj_products (id, cat, name, purity, weight, price, mrp, best, descr, img, sizes, position, added_by, added_by_name)
    values (nid, v_cat, left(v_name, 120), left(coalesce(p->>'purity', ''), 60), left(coalesce(p->>'weight', ''), 40),
            v_price, v_mrp, coalesce((p->>'best')::boolean, false), left(coalesce(p->>'desc', ''), 1000), v_img, v_sizes,
            coalesce((select min(position) from rj_products), 1) - 1, a.staff_id, a.name);
    return json_build_object('ok', true, 'id', nid);
  end if;

  select * into cur from rj_products where id = p_id;
  if not found then return json_build_object('error', 'Product not found'); end if;
  if not a.is_owner and cur.added_by is distinct from a.staff_id then
    return json_build_object('error', 'You can only edit pieces you added');
  end if;
  update rj_products set cat = v_cat, name = left(v_name, 120), purity = left(coalesce(p->>'purity', ''), 60),
         weight = left(coalesce(p->>'weight', ''), 40), price = v_price, mrp = v_mrp,
         best = coalesce((p->>'best')::boolean, best), descr = left(coalesce(p->>'desc', ''), 1000),
         img = coalesce(v_img, img), sizes = v_sizes, updated_at = now()
   where id = p_id;
  return json_build_object('ok', true, 'id', p_id);
end $$;

-- Owner: hide/show any piece. Delete: owner any piece, staff only their own.
create or replace function public.rj_product_active(p_token text, p_id text, p_active boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not rj_owner_ok(p_token) then return json_build_object('error', 'Only the owner can hide or show pieces'); end if;
  update rj_products set active = p_active, updated_at = now() where id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.rj_product_delete(p_token text, p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from rj_actor(p_token);
  if a.is_owner is null then return json_build_object('error', 'logged_out'); end if;
  delete from rj_products where id = p_id and (a.is_owner or added_by = a.staff_id);
  if not found then return json_build_object('error', 'You can only delete pieces you added'); end if;
  return json_build_object('ok', true);
end $$;

-- Photo storage: public to view, upload only with a valid ticket, no overwriting or deleting from the website
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rj-products', 'rj-products', true, 3145728, array['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "rj upload with ticket" on storage.objects;
create policy "rj upload with ticket" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'rj-products' and public.rj_ticket_ok(name));
drop policy if exists "rj read product photos" on storage.objects;
create policy "rj read product photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'rj-products');

-- the store's starting catalogue (only added once; edit them from the dashboard after that)
insert into public.rj_products (id, cat, name, purity, weight, price, mrp, best, rating, descr, img, sizes, position) values
  ('n1', 'necklaces', 'Gold Bead Chain Necklace', '22K Hallmarked', '14.2 g', 96500, 101000, true, 4.8, 'Fine link chain with hand-finished gold beads and a matching drop.', 'images/n1.jpg', null, 1),
  ('n2', 'necklaces', 'Diamond Drop Necklace', '18K · VS-GH', '11.8 g', 148000, 159000, true, 4.9, 'Cascading diamond-set necklace with a matching pendant drop.', 'images/n2.jpg', null, 2),
  ('n3', 'necklaces', 'Bridal Rani Haar', '22K Hallmarked', '64 g', 438000, 455000, false, 4.9, 'Layered heavy haar with intricate gold work, made for the wedding day.', 'images/n3.jpg', null, 3),
  ('e1', 'earrings', 'Temple Jhumka', '22K Hallmarked', '12.4 g', 86800, 91000, true, 4.9, 'Classic temple jhumkas with Lakshmi motif and gold bead fringe.', 'images/e1.jpg', null, 4),
  ('e2', 'earrings', 'Rose Gold Swirl Drops', '18K Rose Gold', '3.2 g', 21500, 23500, false, 4.7, 'Light hook earrings with a sculpted swirl — perfect for office wear.', 'images/e2.jpg', null, 5),
  ('e3', 'earrings', 'Meenakari Flower Studs', 'Gold Plated', '18 g', 2400, 3200, true, 4.7, 'Hand-painted floral studs with gold bead hangings.', 'images/e3.jpg', null, 6),
  ('e4', 'earrings', 'Filigree Gold Studs', '22K Hallmarked', '5.6 g', 39800, 42000, false, 4.8, 'Domed filigree studs with fine granulation work.', 'images/e4.jpg', null, 7),
  ('r1', 'rings', 'Kundan Cocktail Ring', '22K Hallmarked', '9.4 g', 66400, 70000, true, 4.8, 'Statement ring with emerald centre and ruby accents.', 'images/r1.jpg', array['10', '12', '14', '16', '18'], 8),
  ('r2', 'rings', 'Diamond Flower Ring', '18K · SI-GH', '4.1 g', 52900, 57000, false, 4.9, 'Bloom-shaped cluster ring set with brilliant-cut diamonds.', 'images/r2.jpg', array['10', '12', '14', '16', '18'], 9),
  ('b1', 'bangles', 'Antique Gold Bangle Set', '22K Hallmarked', '48 g', 328000, 342000, true, 4.8, 'Set of carved antique-finish bangles for festive and bridal wear.', 'images/b1.jpg', array['2.4', '2.6', '2.8'], 10),
  ('b2', 'bangles', 'Diamond Cuff Bangle', '18K White Gold', '16 g', 189000, 199000, false, 4.9, 'Open cuff bangle with pavé diamonds along a sculpted band.', 'images/b2.jpg', array['2.4', '2.6', '2.8'], 11),
  ('br1', 'bracelets', 'Diamond Tennis Bracelet', '18K · VS', '7.8 g', 89000, 96000, true, 4.9, 'Line bracelet with 36 diamonds and secure box clasp.', 'images/br1.jpg', null, 12),
  ('br2', 'bracelets', 'Sterling Cable Bracelet', '925 Silver', '14 g', 3900, 4600, false, 4.6, 'Polished cable-link bracelet with lobster clasp.', 'images/br2.jpg', null, 13),
  ('p1', 'pendants', 'Teal Stone Pendant', '18K Hallmarked', '3.4 g', 24900, 27500, true, 4.8, 'Octagon-cut teal gemstone in a gold bezel. Chain not included.', 'images/p1.jpg', null, 14),
  ('p2', 'pendants', 'Pearl Halo Pendant', '18K White Gold', '2.1 g', 18600, 19900, false, 4.7, 'Freshwater pearl wrapped in a diamond-set halo ring.', 'images/p2.jpg', null, 15),
  ('bs1', 'bridal', 'Dulhan Necklace Set', '22K Hallmarked', '72 g', 489000, 515000, true, 5, 'Grand bridal necklace with matching long earrings.', 'images/bs1.jpg', null, 16),
  ('bs2', 'bridal', 'Jaali Necklace Set', '22K Hallmarked', '38 g', 262000, 275000, false, 4.8, 'Lightweight jaali-work necklace with drop earrings — reception ready.', 'images/bs2.jpg', null, 17),
  ('s1', 'silver', 'Tree of Life Pendant', '925 Silver', '5 g', 2450, 2900, true, 4.8, 'Cut-out tree of life pendant with 18 inch silver chain.', 'images/s1.jpg', null, 18),
  ('s2', 'silver', 'Hammered Couple Bands', '925 Silver', '9 g', 3200, 3800, false, 4.7, 'Pair of textured bands — mention both ring sizes in the order note.', 'images/s2.jpg', null, 19)
on conflict (id) do nothing;

-- ---------- permissions ----------
revoke execute on function public.rj_phone(text), public.rj_owner_ok(text), public.rj_today(),
  public.rj_actor(text), public.rj_product_json(public.rj_products) from public, anon, authenticated;
grant execute on function
  public.rj_track(text, text, text, text, text, text, text),
  public.rj_staff_login(text, text),
  public.rj_staff_feed(text),
  public.rj_owner_login(text, text),
  public.rj_owner_info(text),
  public.rj_owner_feed(text),
  public.rj_owner_save_staff(text, uuid, text, text, text, boolean),
  public.rj_owner_delete_staff(text, uuid),
  public.rj_owner_account(text, text, text, text),
  public.rj_products_list(),
  public.rj_products_manage(text),
  public.rj_upload_ticket(text),
  public.rj_ticket_ok(text),
  public.rj_product_save(text, text, jsonb),
  public.rj_product_active(text, text, boolean),
  public.rj_product_delete(text, text)
to anon, authenticated;

-- ---------- owner login (first run only) ----------
insert into public.rj_owner (id, username, pass_hash)
values (1, 'owner', extensions.crypt('CHANGE-THIS-PASSWORD', extensions.gen_salt('bf')))   -- ← set your own password before the first run
on conflict (id) do nothing;
