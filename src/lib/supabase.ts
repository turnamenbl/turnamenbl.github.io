"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// SQL schema to run in Supabase SQL editor (re-export from server-side file isn't possible with "use client"
// but we can also hard-code here for the admin panel).
export const SUPABASE_SCHEMA_SQL = `-- Billiard Bracket tables. Run this in your Supabase project's SQL Editor once.

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('league','tournament')),
  name text not null,
  slug text not null unique,
  player_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  seed integer
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round integer not null,
  position integer not null,
  player1_id uuid references players(id) on delete set null,
  player2_id uuid references players(id) on delete set null,
  player1_score integer not null default 0,
  player2_score integer not null default 0,
  winner_id uuid references players(id) on delete set null,
  completed boolean not null default false,
  next_match_id uuid references matches(id) on delete set null
);

create index if not exists players_tournament_idx on players(tournament_id);
create index if not exists matches_tournament_round_idx on matches(tournament_id, round);
create index if not exists matches_tournament_idx on matches(tournament_id);

alter table tournaments enable row level security;
alter table players enable row level security;
alter table matches enable row level security;

drop policy if exists "Allow all on tournaments" on tournaments;
drop policy if exists "Allow all on players" on players;
drop policy if exists "Allow all on matches" on matches;

create policy "Allow all on tournaments" on tournaments
  for all using (true) with check (true);
create policy "Allow all on players" on players
  for all using (true) with check (true);
create policy "Allow all on matches" on matches
  for all using (true) with check (true);
`;

let cachedClient: SupabaseClient | null = null;
let cachedUrl = "";
let cachedKey = "";

export type AppConfig = {
  configured: boolean;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  fromEnv?: boolean;
};

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal memuat konfigurasi");
  return res.json();
}

export function getSupabase(config: AppConfig): SupabaseClient | null {
  if (!config.configured || !config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }
  if (
    cachedClient &&
    cachedUrl === config.supabaseUrl &&
    cachedKey === config.supabaseAnonKey
  ) {
    return cachedClient;
  }
  cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cachedUrl = config.supabaseUrl;
  cachedKey = config.supabaseAnonKey;
  return cachedClient;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ===== Types (mirror the Supabase tables) =====
export type Tournament = {
  id: string;
  type: "league" | "tournament";
  name: string;
  slug: string;
  player_count: number;
  created_at: string;
};

export type Player = {
  id: string;
  tournament_id: string;
  name: string;
  seed: number | null;
};

export type Match = {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  completed: boolean;
  next_match_id: string | null;
};

// ===== Bracket generation helpers (ported, now returns Supabase-ready rows) =====

export function generateRoundRobin(n: number): number[][][] {
  const rounds: number[][][] = [];
  const numRounds = n - 1;
  const playersList: (number | null)[] = Array.from({ length: n }, (_, i) => i);

  let hasBye = false;
  if (n % 2 !== 0) {
    playersList.push(null);
    hasBye = true;
  }

  const total = playersList.length;
  const half = total / 2;

  for (let round = 0; round < numRounds; round++) {
    const pairs: number[][] = [];
    for (let i = 0; i < half; i++) {
      const p1 = playersList[i];
      const p2 = playersList[total - 1 - i];
      if (p1 !== null && p2 !== null) pairs.push([p1, p2]);
    }
    rounds.push(pairs);
    const fixed = playersList[0];
    const rest = playersList.slice(1);
    rest.unshift(rest.pop()!);
    playersList.length = 0;
    playersList.push(fixed, ...rest);
  }
  return rounds;
}

export function generateSingleElimination(n: number): {
  firstRound: number[][];
  totalRounds: number;
} {
  let bracketSize = 1;
  while (bracketSize < n) bracketSize *= 2;
  const totalRounds = Math.log2(bracketSize);
  const numFirstRoundMatches = bracketSize / 2;
  const firstRoundPairs: number[][] = [];
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const seed1 = i;
    const seed2 = bracketSize - 1 - i;
    if (seed2 >= n && seed1 >= n) continue;
    if (seed2 >= n) firstRoundPairs.push([seed1, -1]);
    else if (seed1 >= n) firstRoundPairs.push([-1, seed2]);
    else firstRoundPairs.push([seed1, seed2]);
  }
  return { firstRound: firstRoundPairs, totalRounds };
}

export async function createTournament(
  supabase: SupabaseClient,
  type: "league" | "tournament",
  name: string,
  playerNames: string[]
): Promise<Tournament> {
  const baseSlug = slugify(name);
  if (!baseSlug) throw new Error("Nama liga/turnamen mengandung karakter tidak valid");

  // Ensure unique slug by appending a short suffix if needed
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const { data: existing } = await supabase
      .from("tournaments")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  // Create tournament row
  const { data: tourney, error: tErr } = await supabase
    .from("tournaments")
    .insert({
      type,
      name: name.trim(),
      slug,
      player_count: playerNames.length,
    })
    .select()
    .single();
  if (tErr) throw new Error(tErr.message);

  // Create players
  const playerRows = playerNames.map((n, i) => ({
    tournament_id: tourney.id,
    name: n.trim(),
    seed: i + 1,
  }));
  const { data: createdPlayers, error: pErr } = await supabase
    .from("players")
    .insert(playerRows)
    .select();
  if (pErr) throw new Error(pErr.message);
  const playerList = createdPlayers as Player[];

  if (type === "league") {
    const rounds = generateRoundRobin(playerNames.length);
    const matchRows = rounds.flatMap((roundPairs, rIdx) =>
      roundPairs.map((pair, mIdx) => ({
        tournament_id: tourney.id,
        round: rIdx + 1,
        position: mIdx + 1,
        player1_id: playerList[pair[0]].id,
        player2_id: playerList[pair[1]].id,
      }))
    );
    const { error: mErr } = await supabase.from("matches").insert(matchRows);
    if (mErr) throw new Error(mErr.message);
  } else {
    const { firstRound, totalRounds } = generateSingleElimination(playerNames.length);

    // Build all rounds. Insert round 1 first, then subsequent rounds.
    const matchIdsByRound: string[][] = [];

    // Round 1
    const round1Rows = firstRound.map((pair, mIdx) => {
      const p1id = pair[0] >= 0 ? playerList[pair[0]].id : null;
      const p2id = pair[1] >= 0 ? playerList[pair[1]].id : null;
      const isBye = pair[0] < 0 || pair[1] < 0;
      const winnerId =
        pair[0] < 0 && pair[1] >= 0
          ? playerList[pair[1]].id
          : pair[1] < 0 && pair[0] >= 0
          ? playerList[pair[0]].id
          : null;
      return {
        tournament_id: tourney.id,
        round: 1,
        position: mIdx + 1,
        player1_id: p1id,
        player2_id: p2id,
        winner_id: isBye ? winnerId : null,
        completed: isBye,
      };
    });
    const { data: r1data, error: r1err } = await supabase
      .from("matches")
      .insert(round1Rows)
      .select();
    if (r1err) throw new Error(r1err.message);
    matchIdsByRound.push(r1data.map((m) => m.id));

    let prevCount = firstRound.length;
    for (let r = 2; r <= totalRounds; r++) {
      const roundCount = prevCount / 2;
      const roundRows = Array.from({ length: roundCount }, (_, mIdx) => ({
        tournament_id: tourney.id,
        round: r,
        position: mIdx + 1,
      }));
      const { data: rData, error: rErr } = await supabase
        .from("matches")
        .insert(roundRows)
        .select();
      if (rErr) throw new Error(rErr.message);
      const rIds = rData.map((m) => m.id);
      matchIdsByRound.push(rIds);

      // Update previous round matches to point to this round
      for (let m = 0; m < prevCount; m++) {
        const nextPos = Math.floor(m / 2);
        const nextId = rIds[nextPos];
        await supabase
          .from("matches")
          .update({ next_match_id: nextId })
          .eq("id", matchIdsByRound[r - 2][m]);
      }
      prevCount = roundCount;
    }
  }

  return tourney as Tournament;
}

export async function getTournamentBySlug(
  supabase: SupabaseClient,
  slug: string
) {
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tournament) return null;

  const [{ data: players }, { data: matches }] = await Promise.all([
    supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("seed", { ascending: true }),
    supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("round")
      .order("position"),
  ]);

  return {
    tournament: tournament as Tournament,
    players: (players || []) as Player[],
    matches: (matches || []) as Match[],
  };
}

export async function listTournaments(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Tournament[];
}

export async function deleteTournament(supabase: SupabaseClient, id: string) {
  // Delete matches first due to self-referencing next_match_id, then players, then tournament
  const { error: mErr } = await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", id);
  if (mErr) throw new Error(mErr.message);
  const { error: pErr } = await supabase
    .from("players")
    .delete()
    .eq("tournament_id", id);
  if (pErr) throw new Error(pErr.message);
  const { error: tErr } = await supabase.from("tournaments").delete().eq("id", id);
  if (tErr) throw new Error(tErr.message);
}

export async function updatePlayerName(
  supabase: SupabaseClient,
  playerId: string,
  newName: string
) {
  const { error } = await supabase
    .from("players")
    .update({ name: newName.trim() })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}

export async function deletePlayer(
  supabase: SupabaseClient,
  tournamentId: string,
  playerId: string
) {
  // Find all matches involving this player in this tournament
  const { data: relatedMatches, error: fErr } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},winner_id.eq.${playerId}`);
  if (fErr) throw new Error(fErr.message);

  // Reset those matches and cascade reset chain
  for (const m of relatedMatches || []) {
    await resetMatch(supabase, m.id);
  }

  // Null out references
  await supabase
    .from("matches")
    .update({ player1_id: null })
    .eq("tournament_id", tournamentId)
    .eq("player1_id", playerId);
  await supabase
    .from("matches")
    .update({ player2_id: null })
    .eq("tournament_id", tournamentId)
    .eq("player2_id", playerId);
  await supabase
    .from("matches")
    .update({ winner_id: null })
    .eq("tournament_id", tournamentId)
    .eq("winner_id", playerId);

  const { error: dErr } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId);
  if (dErr) throw new Error(dErr.message);

  // Update player_count
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  await supabase
    .from("tournaments")
    .update({ player_count: count ?? 0 })
    .eq("id", tournamentId);
}

export async function addPlayer(
  supabase: SupabaseClient,
  tournament: Tournament,
  newName: string
) {
  // Get current players voor seed
  const { data: existingPlayers } = await supabase
    .from("players")
    .select("seed")
    .eq("tournament_id", tournament.id)
    .order("seed", { ascending: false })
    .limit(1);
  const nextSeed = (existingPlayers?.[0]?.seed || 0) + 1;

  const { data: newPlayer, error: pErr } = await supabase
    .from("players")
    .insert({
      tournament_id: tournament.id,
      name: newName.trim(),
      seed: nextSeed,
    })
    .select()
    .single();
  if (pErr) throw new Error(pErr.message);

  // Update player_count
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournament.id);
  await supabase
    .from("tournaments")
    .update({ player_count: count ?? 0 })
    .eq("id", tournament.id);

  return newPlayer as Player;
}

export async function updateMatchScore(
  supabase: SupabaseClient,
  matchId: string,
  player1Score: number,
  player2Score: number
) {
  const { data: match, error: fErr } = await supabase
    .from("matches")
    .select("*, tournaments(type)")
    .eq("id", matchId)
    .single();
  if (fErr) throw new Error(fErr.message);
  if (!match) throw new Error("Pertandingan tidak ditemukan");

  const tourneyType = (match.tournaments as any)?.type;
  if (tourneyType === "tournament" && player1Score === player2Score) {
    throw new Error("Pertandingan sistem gugur harus ada pemenang (tidak boleh seri)");
  }

  let winnerId: string | null = null;
  const completed = true;
  if (player1Score > player2Score) winnerId = match.player1_id;
  else if (player2Score > player1Score) winnerId = match.player2_id;
  else winnerId = null;

  const { error: uErr } = await supabase
    .from("matches")
    .update({
      player1_score: player1Score,
      player2_score: player2Score,
      winner_id: winnerId,
      completed,
    })
    .eq("id", matchId);
  if (uErr) throw new Error(uErr.message);

  // Propagate winner to next match (tournament only)
  if (match.next_match_id && winnerId) {
    const { data: nextMatch } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match.next_match_id)
      .maybeSingle();
    if (nextMatch) {
      const isFirstSlot = match.position % 2 === 1;
      await supabase
        .from("matches")
        .update(isFirstSlot ? { player1_id: winnerId } : { player2_id: winnerId })
        .eq("id", match.next_match_id);
    }
  }

  return match;
}

export async function resetMatch(supabase: SupabaseClient, matchId: string) {
  const { data: match, error: fErr } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);
  if (!match) return;

  // If there's a next match and we had a winner, clear that slot and reset the chain
  if (match.next_match_id && match.winner_id) {
    const { data: nextMatch } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match.next_match_id)
      .maybeSingle();
    if (nextMatch) {
      const isFirstSlot = match.position % 2 === 1;
      const updates: any = isFirstSlot
        ? { player1_id: null, winner_id: null, player1_score: 0, player2_score: 0, completed: false }
        : { player2_id: null, winner_id: null, player1_score: 0, player2_score: 0, completed: false };
      await supabase.from("matches").update(updates).eq("id", match.next_match_id);

      // Recursively reset the next match if it had a winner
      if (nextMatch.winner_id && nextMatch.next_match_id) {
        await resetMatch(supabase, nextMatch.id);
      }
    }
  }

  const { error: uErr } = await supabase
    .from("matches")
    .update({
      player1_score: 0,
      player2_score: 0,
      winner_id: null,
      completed: false,
    })
    .eq("id", matchId);
  if (uErr) throw new Error(uErr.message);
}
