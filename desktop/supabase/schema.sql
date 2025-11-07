-- Games table (one row per project)
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Game files (logical files tracked in DB; binary goes to Storage)
create table if not exists public.game_files (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  path text not null,         -- e.g., scenes/town.json
  sha256 text,                -- integrity
  size_bytes int8,
  updated_at timestamp with time zone default now(),
  unique (game_id, path)
);

-- Enable Row Level Security
alter table public.games enable row level security;
alter table public.game_files enable row level security;

-- Policies for games
create policy "games_owner_rw"
  on public.games for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for game_files
create policy "game_files_owner_rw"
  on public.game_files for all
  using (exists (
    select 1 from public.games g 
    where g.id = game_id and g.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.games g 
    where g.id = game_id and g.user_id = auth.uid()
  ));

-- Indexes for performance
create index if not exists games_user_id_idx on public.games(user_id);
create index if not exists games_updated_at_idx on public.games(updated_at desc);
create index if not exists game_files_game_id_idx on public.game_files(game_id);
create index if not exists game_files_path_idx on public.game_files(game_id, path);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_games_updated_at
  before update on public.games
  for each row
  execute function update_updated_at_column();

create trigger update_game_files_updated_at
  before update on public.game_files
  for each row
  execute function update_updated_at_column();

