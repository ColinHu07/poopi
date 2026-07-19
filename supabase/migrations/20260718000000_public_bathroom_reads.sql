grant execute on function public.nearby_bathrooms(double precision, double precision, integer) to anon;

create policy bathrooms_select_anon on public.bathrooms
for select to anon using (true);

create policy bathroom_sources_select_anon on public.bathroom_sources
for select to anon using (true);

create policy bathroom_features_select_anon on public.bathroom_features
for select to anon using (true);
