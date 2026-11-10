-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.staff_profiles where user_id=auth.uid()) $$;

create table if not exists public.poojas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_te text,
  price numeric(10,2) not null default 0 check(price >= 0),
  active boolean not null default true,
  sort_order int not null default 0
);
insert into public.poojas(name,name_te,price,sort_order) values
('Archana','అర్చన',0,1),('Abhishekam','అభిషేకం',0,2),('Vahana Puja','వాహన పూజ',0,3),
('Nitya Archana','నిత్య అర్చన',0,4),('Kalyanam','కళ్యాణం',0,5)
on conflict(name) do nothing;

create table if not exists public.devotees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gotram text not null,
  mobile text not null,
  address text,
  created_at timestamptz not null default now()
);
create index if not exists devotees_mobile_idx on public.devotees(mobile);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  devotee_id uuid not null references public.devotees(id),
  pooja_id uuid not null references public.poojas(id),
  booking_date date not null,
  amount numeric(10,2) not null check(amount >= 0),
  payment_method text not null default 'Cash' check(payment_method in ('Cash','UPI','Other')),
  payment_status text not null default 'Pending' check(payment_status in ('Paid','Pending')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists bookings_date_idx on public.bookings(booking_date desc);
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  devotee_id uuid not null references public.devotees(id) on delete cascade,
  name text not null,
  relationship text
);
create table if not exists public.receipt_counters (
  prefix text primary key default 'LTmpl',
  last_number bigint not null default 0
);
insert into public.receipt_counters(prefix,last_number) values('LTmpl',0) on conflict(prefix) do nothing;

create or replace view public.booking_register with (security_invoker=true) as
select b.id,b.receipt_no,d.name as devotee_name,d.mobile,d.gotram,d.address,
       p.name as pooja_name,b.amount,b.payment_method,b.payment_status,b.booking_date,b.created_at
from public.bookings b join public.devotees d on d.id=b.devotee_id
join public.poojas p on p.id=b.pooja_id;

-- Public booking endpoint. The transaction generates the receipt atomically to avoid duplicates.
create or replace function public.create_public_booking(
  p_name text, p_gotram text, p_mobile text, p_address text, p_pooja_id uuid,
  p_booking_date date, p_amount numeric, p_payment_method text, p_payment_status text,
  p_notes text default '', p_family jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_devotee uuid; v_booking uuid; v_receipt text; v_num bigint; v_price numeric(10,2);
begin
  if length(trim(coalesce(p_name,'')))=0 or length(trim(coalesce(p_gotram,'')))=0
     or p_mobile !~ '^[0-9]{10}$' then raise exception 'Please enter devotee name, gotram and a valid 10-digit mobile number'; end if;
  select price into v_price from public.poojas where id=p_pooja_id and active=true;
  if not found then raise exception 'Selected pooja is not available'; end if;
  -- The server controls the booking price and initial payment status; browser input cannot mark a booking paid.
  insert into public.devotees(name,gotram,mobile,address)
  values(trim(p_name),trim(p_gotram),trim(p_mobile),nullif(trim(coalesce(p_address,'')),'')) returning id into v_devotee;
  insert into public.receipt_counters(prefix,last_number) values('LTmpl',0) on conflict(prefix) do nothing;
  update public.receipt_counters set last_number=last_number+1 where prefix='LTmpl' returning last_number into v_num;
  v_receipt := 'LTmpl_' || lpad(v_num::text,5,'0');
  insert into public.bookings(receipt_no,devotee_id,pooja_id,booking_date,amount,payment_method,payment_status,notes)
  values(v_receipt,v_devotee,p_pooja_id,p_booking_date,v_price,p_payment_method,'Pending',nullif(trim(coalesce(p_notes,'')),'')) returning id into v_booking;
  if jsonb_typeof(coalesce(p_family,'[]'::jsonb))='array' then
    insert into public.family_members(devotee_id,name,relationship)
    select v_devotee,trim(x->>'name'),nullif(trim(coalesce(x->>'relationship','')),'')
    from jsonb_array_elements(p_family) x where length(trim(coalesce(x->>'name','')))>0;
  end if;
  return jsonb_build_object('id',v_booking,'receipt_no',v_receipt);
end $$;
grant execute on function public.create_public_booking(text,text,text,text,uuid,date,numeric,text,text,text,jsonb) to anon, authenticated;

alter table public.staff_profiles enable row level security;
alter table public.poojas enable row level security;
alter table public.devotees enable row level security;
alter table public.bookings enable row level security;
alter table public.family_members enable row level security;
alter table public.receipt_counters enable row level security;

create policy "staff read own profile" on public.staff_profiles for select to authenticated using(user_id=auth.uid());
create policy "public view active poojas" on public.poojas for select to anon,authenticated using(active=true or public.is_staff());
create policy "staff manage poojas" on public.poojas for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff read devotees" on public.devotees for select to authenticated using(public.is_staff());
create policy "staff manage devotees" on public.devotees for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff read bookings" on public.bookings for select to authenticated using(public.is_staff());
create policy "staff update bookings" on public.bookings for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff read family" on public.family_members for select to authenticated using(public.is_staff());
create policy "staff manage family" on public.family_members for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff read counters" on public.receipt_counters for select to authenticated using(public.is_staff());

create table if not exists public.media_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  public_url text not null,
  mime_type text,
  created_at timestamptz not null default now()
);
alter table public.media_library enable row level security;
create policy "staff manage media metadata" on public.media_library for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "staff read media metadata" on public.media_library for select to authenticated using(public.is_staff());

-- Create a Storage bucket named temple-media and use the following policies.
insert into storage.buckets(id,name,public) values('temple-media','temple-media',true)
on conflict(id) do nothing;
create policy "staff upload temple media" on storage.objects for insert to authenticated
with check(bucket_id='temple-media' and public.is_staff());
create policy "staff update temple media" on storage.objects for update to authenticated
using(bucket_id='temple-media' and public.is_staff()) with check(bucket_id='temple-media' and public.is_staff());
create policy "public read temple media" on storage.objects for select to public using(bucket_id='temple-media');
