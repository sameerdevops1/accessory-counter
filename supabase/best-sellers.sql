-- Run once in Supabase > SQL Editor. Lets the shop show "Best selling".
-- It only shares an order (best first), never how many were sold or any customer details.
create or replace function best_sellers() returns setof uuid
language sql stable security definer set search_path = public as $$
  select ol.product_id
  from order_lines ol
  join orders o on o.id = ol.order_id
  join products p on p.id = ol.product_id
  where o.status <> 'cancelled' and p.published
  group by ol.product_id
  order by sum(ol.qty) desc, min(p.name)
  limit 200
$$;
grant execute on function best_sellers() to anon, authenticated;
