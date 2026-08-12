"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AppConfig,
  fetchConfig,
  getSupabase,
  getTournamentBySlug,
  updateMatchScore,
  resetMatch,
  updatePlayerName,
  deletePlayer,
  addPlayer,
} from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ===== Types =====
type Player = {
  id: string;
  tournament_id: string;
  name: string;
  seed: number | null;
};

type Match = {
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

type Tournament = {
  id: string;
  type: "league" | "tournament";
  name: string;
  slug: string;
  player_count: number;
  created_at: string;
};

type TournamentData = {
  tournament: Tournament;
  players: Player[];
  matches: Match[];
};

// Search panel subcomponent (to forward useSearchParams safely)
function SearchPanel({
  matches,
  players,
  isAdmin,
  onRequestAdmin,
  openEdit,
  onResetMatch,
  searchActive,
}: {
  matches: Match[];
  players: Player[];
  isAdmin: boolean;
  onRequestAdmin: () => void;
  openEdit: (m: Match) => void;
  onResetMatch: (matchId: string) => void;
  searchActive: boolean;
}) {
  const [localQ, setLocalQ] = useState("");
  const [flashMatchId, setFlashMatchId] = useState<string | null>(null);

  const results = matches.filter((m) => {
    const q = localQ.toLowerCase().trim();
    if (!q) return false;
    const p1 = players.find((p) => p.id === m.player1_id)?.name.toLowerCase() || "";
    const p2 = players.find((p) => p.id === m.player2_id)?.name.toLowerCase() || "";
    return p1.includes(q) || p2.includes(q);
  });

  const handleNavigate = (matchId: string) => {
    const match = matches.find((m: Match) => m.id === matchId);
    if (!match) return;

    const performAction = () => {
      setFlashMatchId(matchId);
      const el = document.getElementById(`match-${matchId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setTimeout(() => {
        if (!isAdmin) {
          onRequestAdmin();
        } else if (match.completed) {
          onResetMatch(matchId);
        } else {
          openEdit(match);
        }
      }, 250);
    };

    // Try to find the DOM element first
    const el = document.getElementById(`match-${matchId}`);
    if (el) {
      performAction();
      return;
    }

    // For league: locate the round tab and click it first, then retry
    const roundBtn = document.querySelector(`[data-round-tab="${match.round}"]`) as HTMLElement | null;
    if (roundBtn) {
      roundBtn.click();
      setTimeout(performAction, 100);
    }
  };

  // Clear flash after a moment
  useEffect(() => {
    if (!flashMatchId) return;
    const timer = setTimeout(() => setFlashMatchId(null), 1800);
    return () => clearTimeout(timer);
  }, [flashMatchId]);

  if (!searchActive) return null;

  return (
    <div className="rounded-2xl glass-strong overflow-hidden shadow-xl shadow-black/30 animate-scale-in">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <input
            type="search"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Cari nama pemain…"
            autoFocus
            className="flex-1 bg-black/30 border border-white/15 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/20 transition-all placeholder:text-white/30"
          />
        </div>
        {localQ.trim() && (
          <div className="text-xs text-white/50">
            {results.length === 0
              ? "Tidak ditemukan"
              : `${results.length} pertandingan ditemukan`}
          </div>
        )}
        {results.length > 0 && (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {results.map((m) => {
              const p1 = players.find((p) => p.id === m.player1_id);
              const p2 = players.find((p) => p.id === m.player2_id);
              const isFlashing = flashMatchId === m.id;
              return (
                <div key={m.id} className="space-y-1.5">
                  <button
                    id={`match-${m.id}`}
                    onClick={() => handleNavigate(m.id)}
                    className={`w-full text-left glass rounded-xl p-3 transition-all group border ${isFlashing
                      ? "border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/30 animate-pulse-glow"
                      : "border-white/10 hover:border-emerald-400/30 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/50 font-bold">R{ m.round }-{ m.position }</span>
                      {!isAdmin && (
                        <span className="text-[9px] text-white/30 group-hover:text-white/60">
                          🔒
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold mt-1">
                      <span
                        className={
                          m.winner_id === p1?.id
                            ? "text-emerald-300"
                            : m.winner_id === null && m.completed
                            ? "text-white/70"
                            : "text-white"
                        }
                      >
                        {p1?.name || "?"}
                      </span>
                      <span className="text-white/40 mx-1.5 text-xs">vs</span>
                      <span
                        className={
                          m.winner_id === p2?.id
                            ? "text-emerald-300"
                            : m.winner_id === null && m.completed
                            ? "text-white/70"
                            : "text-white"
                        }
                      >
                        {p2?.name || "?"}
                      </span>
                    </div>
                    {m.completed ? (
                      <div className="text-xs text-white/60 mt-1">
                        {m.player1_score} - {m.player2_score}
                        {m.winner_id === null && " (seri)"}
                      </div>
                    ) : (
                      <div className="text-[10px] text-white/40 mt-1">
                        {isAdmin ? "Klik masukkan skor" : "Belum dimainkan"}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const ADMIN_PASSWORD = "admin123";
const ADMIN_SESSION_KEY = "bracket_admin_mode";

export default function TournamentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [savingMatch, setSavingMatch] = useState(false);
  const [activeRound, setActiveRound] = useState<number>(1);

  // Admin mode
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPwInput, setAdminPwInput] = useState("");
  const [adminPwError, setAdminPwError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") setIsAdmin(true);
    } catch {}
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPwError(null);
    if (adminPwInput === ADMIN_PASSWORD) {
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, "1"); } catch {}
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPwInput("");
    } else {
      setAdminPwError("Password salah");
    }
  };

  const handleAdminLogout = () => {
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch {}
    setIsAdmin(false);
    setEditingMatch(null);
  };

  const loadData = async (client: SupabaseClient) => {
    try {
      const d = await getTournamentBySlug(client, slug);
      if (!d) {
        setError("Bagan tidak ditemukan. Cek kembali URL-nya.");
        setLoading(false);
        return;
      }
      setData(d as TournamentData);
      if (d.matches.length > 0) {
        const incomplete = d.matches.find((m) => !m.completed);
        setActiveRound(
          incomplete
            ? incomplete.round
            : d.matches[d.matches.length - 1]?.round || 1
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg);
        const client = getSupabase(cfg);
        setSupabase(client);
        if (client) return loadData(client);
        setError("Database Supabase belum di-setup. Silakan hubungi admin.");
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [slug]);

  const playerById = (pid: string | null | undefined, players: Player[]) =>
    players.find((p) => p.id === pid);

  const openEdit = (match: Match) => {
    setEditingMatch(match.id);
    setScore1(match.player1_score || 0);
    setScore2(match.player2_score || 0);
  };

  const saveScore = async (matchId: string) => {
    if (!supabase) return;
    const isLeague = data?.tournament.type === "league";
    if (!isLeague && score1 === score2) {
      alert("Pertandingan sistem gugur harus ada pemenang (tidak boleh seri)");
      return;
    }
    setSavingMatch(true);
    try {
      await updateMatchScore(supabase, matchId, score1, score2);
      setEditingMatch(null);
      await loadData(supabase);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingMatch(false);
    }
  };

  const handleResetMatch = async (matchId: string) => {
    if (!supabase) return;
    if (!confirm("Reset skor pertandingan ini? Pertandingan lanjutan yang terdampak juga akan direset.")) return;
    setSavingMatch(true);
    try {
      await resetMatch(supabase, matchId);
      setEditingMatch(null);
      await loadData(supabase);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingMatch(false);
    }
  };

  // Player management (admin only)
  const [showPlayerMgr, setShowPlayerMgr] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [playerBusy, setPlayerBusy] = useState(false);

  // Search matches
  const [searchOpen, setSearchOpen] = useState(false);

  const handleEditPlayer = async (playerId: string) => {
    if (!supabase) return;
    const trimmed = editPlayerName.trim();
    if (!trimmed) {
      alert("Nama pemain tidak boleh kosong");
      return;
    }
    setPlayerBusy(true);
    try {
      await updatePlayerName(supabase, playerId, trimmed);
      setEditingPlayerId(null);
      await loadData(supabase);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPlayerBusy(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!supabase || !data) return;
    const player = data.players.find((p) => p.id === playerId);
    if (!confirm(`Hapus pemain "${player?.name}"? Semua pertandingan yang melibatkan pemain ini akan direset.`)) return;
    setPlayerBusy(true);
    try {
      await deletePlayer(supabase, data.tournament.id, playerId);
      await loadData(supabase);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPlayerBusy(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!supabase || !data) return;
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      alert("Nama pemain tidak boleh kosong");
      return;
    }
    const originalCount = data.players.length;
    if (confirm(`Menambah "${trimmed}" akan menambahkan ${originalCount} pertandingan baru.`)) {
      setPlayerBusy(true);
      try {
        await addPlayer(supabase, data.tournament, trimmed);
        setNewPlayerName("");
        await loadData(supabase);
      } catch (e: any) {
        alert(e.message);
      } finally {
        setPlayerBusy(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        <div className="text-white/50 text-sm">Memuat bagan...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-24 space-y-4 animate-fade-in">
        <div className="text-5xl mb-2">😕</div>
        <div className="text-red-300 font-semibold">{error || "Bagan tidak ditemukan"}</div>
        <Link href="/" className="inline-block text-emerald-300 hover:text-emerald-200 underline underline-offset-4">
          ← Kembali ke beranda
        </Link>
      </div>
    );
  }

  const { tournament, players, matches } = data;

  // Admin controls / login UI
  const AdminBadge = (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-4">
      {isAdmin ? (
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-md">
            Mode Admin
          </div>
          <button
            onClick={handleAdminLogout}
            className="bg-black/40 hover:bg-red-500/20 border border-white/10 hover:border-red-400/30 text-white/70 hover:text-red-200 w-9 h-9 rounded-full flex items-center justify-center transition-all backdrop-blur-md text-sm"
            title="Keluar mode admin"
          >
            🔓
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdminLogin(true)}
          className="bg-black/30 hover:bg-black/50 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/70 w-9 h-9 rounded-full flex items-center justify-center transition-all backdrop-blur-md text-sm"
          title="Login admin untuk edit skor"
        >
          🔒
        </button>
      )}
    </div>
  );

  const requestAdmin = () => setShowAdminLogin(true);

  return (
    <>
      {tournament.type === "league" ? (
        <LeagueView
          tournament={tournament}
          players={players}
          matches={matches}
          activeRound={activeRound}
          setActiveRound={setActiveRound}
          playerById={playerById}
          editingMatch={editingMatch}
          openEdit={isAdmin ? openEdit : requestAdmin}
          saveScore={isAdmin ? saveScore : async () => {}}
          resetMatchScore={isAdmin ? handleResetMatch : requestAdmin}
          score1={score1}
          setScore1={setScore1}
          score2={score2}
          setScore2={setScore2}
          savingMatch={savingMatch}
          setEditingMatch={setEditingMatch}
          isAdmin={isAdmin}
          onRequestAdmin={requestAdmin}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
        />
      ) : (
        <TournamentView
          tournament={tournament}
          players={players}
          matches={matches}
          playerById={playerById}
          editingMatch={editingMatch}
          openEdit={isAdmin ? openEdit : requestAdmin}
          saveScore={isAdmin ? saveScore : async () => {}}
          resetMatchScore={isAdmin ? handleResetMatch : requestAdmin}
          score1={score1}
          setScore1={setScore1}
          score2={score2}
          setScore2={setScore2}
          savingMatch={savingMatch}
          setEditingMatch={setEditingMatch}
          isAdmin={isAdmin}
          onRequestAdmin={requestAdmin}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
        />
      )}

      {isAdmin && (
        <button
          onClick={() => setShowPlayerMgr(true)}
          className="fixed bottom-20 left-4 z-40 sm:bottom-4 flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/25 text-white/80 hover:text-white px-3 py-2 rounded-xl transition-all backdrop-blur-md text-xs font-bold uppercase tracking-wider"
          title="Kelola Pemain"
        >
          <span>👥</span>
          <span className="hidden sm:inline">Pemain</span>
        </button>
      )}

      <SearchPanel
        matches={matches}
        players={players}
        isAdmin={isAdmin}
        onRequestAdmin={requestAdmin}
        openEdit={(m) => { setSearchOpen(false); openEdit(m); }}
        onResetMatch={(id) => { setSearchOpen(false); handleResetMatch(id); }}
        searchActive={searchOpen}
      />

      {isAdmin && (
        <button
          onClick={() => setShowPlayerMgr(true)}
          className="fixed bottom-20 left-4 z-40 sm:bottom-4 flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/25 text-white/80 hover:text-white px-3 py-2 rounded-xl transition-all backdrop-blur-md text-xs font-bold uppercase tracking-wider"
          title="Kelola Pemain"
        >
          <span>👥</span>
          <span className="hidden sm:inline">Pemain</span>
        </button>
      )}

      {showPlayerMgr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowPlayerMgr(false)}>
          <div className="w-full max-w-md rounded-2xl glass-strong p-6 space-y-5 shadow-2xl shadow-black/50 animate-scale-in max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-xl shadow-lg">
                  👥
                </div>
                <div>
                  <h3 className="font-black text-lg tracking-tight">Kelola Pemain</h3>
                  <p className="text-white/50 text-xs">{data.players.length} pemain</p>
                </div>
              </div>
              <button onClick={() => setShowPlayerMgr(false)} className="w-8 h-8 rounded-lg glass hover:bg-white/15 text-white/80 flex items-center justify-center transition-all">
                ✕
              </button>
            </div>

            {/* Add new player */}
            {data.tournament.type === "league" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Nama pemain baru..."
                  className="flex-1 bg-black/30 border border-white/15 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder:text-white/30"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                />
                <button
                  onClick={handleAddPlayer}
                  disabled={playerBusy || !newPlayerName.trim()}
                  className="bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shrink-0"
                >
                  + Tambah
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {data.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2 glass rounded-xl px-3 py-2">
                  <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 shrink-0">
                    {typeof p.seed === "number" ? p.seed : "•"}
                  </span>
                  {editingPlayerId === p.id ? (
                    <>
                      <input
                        type="text"
                        value={editPlayerName}
                        onChange={(e) => setEditPlayerName(e.target.value)}
                        className="flex-1 bg-black/40 border border-emerald-400/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleEditPlayer(p.id)}
                      />
                      <button disabled={playerBusy} onClick={() => handleEditPlayer(p.id)} className="w-8 h-8 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 flex items-center justify-center transition-all active:scale-95 shrink-0" title="Simpan">
                        ✓
                      </button>
                      <button disabled={playerBusy} onClick={() => setEditingPlayerId(null)} className="w-8 h-8 rounded-lg glass hover:bg-white/15 text-white/70 flex items-center justify-center transition-all active:scale-95 shrink-0" title="Batal">
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-semibold truncate">{p.name}</span>
                      <button disabled={playerBusy} onClick={() => { setEditingPlayerId(p.id); setEditPlayerName(p.name); }} className="w-8 h-8 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 flex items-center justify-center transition-all active:scale-95 shrink-0" title="Edit nama">
                        ✏️
                      </button>
                      <button disabled={playerBusy} onClick={() => handleDeletePlayer(p.id)} className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 flex items-center justify-center transition-all active:scale-95 shrink-0" title="Hapus pemain">
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {data.tournament.type === "tournament" && (
              <p className="text-white/40 text-[11px] italic">
                ✏️ Edit nama langsung update di bracket. Semua mereference pemain tetap aman.
              </p>
            )}
          </div>
        </div>
      )}

      {AdminBadge}

      {showAdminLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowAdminLogin(false)}
        >
          <form
            onSubmit={handleAdminLogin}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl glass-strong p-6 space-y-4 shadow-2xl shadow-black/50 animate-scale-in"
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-2xl shadow-lg">
                🔐
              </div>
              <h3 className="font-black text-lg tracking-tight">Login Admin</h3>
              <p className="text-white/60 text-sm">
                Pengunjung lain hanya bisa <span className="text-white font-semibold">melihat</span> bagan.
                Masukkan password admin untuk mengedit skor.
              </p>
            </div>
            <input
              type="password"
              autoFocus
              value={adminPwInput}
              onChange={(e) => setAdminPwInput(e.target.value)}
              placeholder="Password admin"
              className="w-full bg-black/30 border border-white/15 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/20 transition-all placeholder:text-white/30 text-center"
            />
            {adminPwError && (
              <div className="text-red-300 text-xs text-center animate-shake">⚠️ {adminPwError}</div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdminLogin(false)}
                className="flex-1 glass hover:bg-white/15 text-white/80 font-bold py-2 rounded-xl transition-all active:scale-95 text-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 text-white font-black py-2 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/30 text-sm"
              >
                Masuk
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ============ LEAGUE VIEW ============
function LeagueView({
  tournament,
  players,
  matches,
  activeRound,
  setActiveRound,
  playerById,
  editingMatch,
  openEdit,
  saveScore,
  resetMatchScore,
  score1,
  setScore1,
  score2,
  setScore2,
  savingMatch,
  setEditingMatch,
  isAdmin,
  onRequestAdmin,
  searchOpen,
  setSearchOpen,
}: any) {
  const rounds = Array.from(
    new Set<number>(matches.map((m: Match) => m.round))
  ).sort((a: number, b: number) => a - b);

  const standings = players.map((p: Player) => {
    const myMatches = matches.filter(
      (m: Match) => m.completed && (m.player1_id === p.id || m.player2_id === p.id)
    );
    let wins = 0, draws = 0, losses = 0, gamesWon = 0, gamesLost = 0;
    for (const m of myMatches) {
      const isP1 = m.player1_id === p.id;
      const myScore = isP1 ? m.player1_score : m.player2_score;
      const oppScore = isP1 ? m.player2_score : m.player1_score;
      gamesWon += myScore;
      gamesLost += oppScore;
      if (m.winner_id === p.id) wins++;
      else if (m.winner_id === null) draws++;
      else losses++;
    }
    const played = wins + draws + losses;
    const points = wins * 3;
    return {
      player: p,
      played, wins, draws, losses,
      gamesWon, gamesLost,
      diff: gamesWon - gamesLost,
      points,
    };
  });

  // Tiebreakers: points → diff → alphabetical
  (standings as any[]).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return a.player.name.localeCompare(b.player.name);
  });

  const roundMatches = matches.filter((m: Match) => m.round === activeRound);
  const allCompleted = matches.length > 0 && matches.every((m: Match) => m.completed);
  const champion = allCompleted && standings[0] ? standings[0].player : null;

  const totalCompleted = matches.filter((m: Match) => m.completed).length;
  const progress = Math.round((totalCompleted / matches.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              🏆 LIGA ROUND-ROBIN
            </div>
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${searchOpen ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40" : "glass hover:bg-white/15 text-white/70"}`}
              title="Cari pertandingan"
            >
              🔍 Cari
            </button>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{tournament.name}</h1>
          <p className="text-white/50 text-sm">
            <span className="font-bold text-white/80">{players.length}</span> pemain •{" "}
            <span className="font-bold text-white/80">{matches.length}</span> pertandingan •{" "}
            <span className="font-bold text-white/80">{rounds.length}</span> ronde
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden max-w-xs">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-white/50 font-semibold tabular-nums">{totalCompleted}/{matches.length}</span>
          </div>
        </div>
        {champion && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500/20 via-amber-500/25 to-yellow-500/20 border border-yellow-400/40 px-5 py-4 shadow-xl shadow-amber-500/20 animate-scale-in">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-yellow-400/30 rounded-full blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="text-4xl animate-float">🏆</div>
              <div>
                <div className="text-yellow-200/80 text-[10px] uppercase tracking-widest font-bold">Juara Liga</div>
                <div className="text-yellow-50 font-black text-xl">{champion.name}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Standings */}
      <div className="rounded-3xl glass-strong overflow-hidden shadow-xl shadow-black/20">
        <div className="px-5 py-4 border-b border-white/10 bg-black/20 flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h2 className="font-black text-lg tracking-tight">Klasemen</h2>
          <span className="ml-auto text-[10px] text-white/40 uppercase tracking-wider hidden sm:inline">Menang = 3 poin • Seri/Kalah = 0</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/20 text-white/50 text-[10px] sm:text-xs uppercase tracking-wider font-bold">
                <th className="text-left px-3 sm:px-4 py-2.5 w-8">#</th>
                <th className="text-left px-3 sm:px-4 py-2.5">Pemain</th>
                <th className="px-1.5 py-2.5 w-9" title="Bermain">B</th>
                <th className="px-1.5 py-2.5 w-9 text-emerald-300" title="Menang">M</th>
                <th className="px-1.5 py-2.5 w-9 text-white/60" title="Seri">S</th>
                <th className="px-1.5 py-2.5 w-9 text-red-300/80" title="Kalah">K</th>
                <th className="px-1.5 py-2.5 w-10 text-white/70" title="Game Menang">GM</th>
                <th className="px-1.5 py-2.5 w-10 text-white/70" title="Game Kalah">GK</th>
                <th className="px-1.5 py-2.5 w-10" title="Selisih">±</th>
                <th className="px-3 sm:px-4 py-2.5 w-14 font-black text-emerald-300">Poin</th>
              </tr>
            </thead>
            <tbody>
              {(standings as any[]).map((s, i) => {
                const isChampion = allCompleted && i === 0;
                return (
                  <tr
                    key={s.player.id}
                    className={`border-t border-white/5 transition-colors ${
                      isChampion
                        ? "bg-yellow-500/10"
                        : allCompleted && i === 1
                        ? "bg-slate-400/5"
                        : allCompleted && i === 2
                        ? "bg-orange-700/5"
                        : i % 2 === 0
                        ? "bg-white/[0.02]"
                        : ""
                    } hover:bg-white/5`}
                  >
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-black">
                      {isChampion ? <span className="text-lg">🥇</span> : allCompleted && i === 1 ? <span className="text-lg">🥈</span> : allCompleted && i === 2 ? <span className="text-lg">🥉</span> : <span className="text-white/50 text-sm">{i + 1}</span>}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-sm sm:text-base">{s.player.name}</td>
                    <td className="px-1.5 py-2.5 sm:py-3 text-center text-white/60 tabular-nums text-sm">{s.played}</td>
                    <td className="px-1.5 py-2.5 sm:py-3 text-center text-emerald-300 font-black tabular-nums text-sm">{s.wins}</td>
                    <td className="px-1.5 py-2.5 sm:py-3 text-center text-white/50 tabular-nums text-sm">{s.draws}</td>
                    <td className="px-1.5 py-2.5 sm:py-3 text-center text-red-300/80 tabular-nums text-sm">{s.losses}</td>
                    <td className="px-1.5 py-2.5 sm:py-3 text-center text-white/70 tabular-nums text-sm">{s.gamesWon}</td>
                    <td className="px-1.5 py-2.5 sm:py-3 text-center text-white/70 tabular-nums text-sm">{s.gamesLost}</td>
                    <td className={`px-1.5 py-2.5 sm:py-3 text-center font-bold tabular-nums text-sm ${s.diff > 0 ? "text-emerald-300" : s.diff < 0 ? "text-red-300" : "text-white/50"}`}>
                      {s.diff > 0 ? "+" : ""}{s.diff}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-lg font-black tabular-nums text-sm ${s.points > 0 ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/20" : "bg-white/5 text-white/50 border border-white/10"}`}>
                        {s.points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {rounds.map((r: number) => {
          const rMatches = matches.filter((m: Match) => m.round === r);
          const completedCount = rMatches.filter((m: Match) => m.completed).length;
          const isDone = completedCount === rMatches.length;
          return (
            <button
              key={r}
              onClick={() => setActiveRound(r)}
              className={`relative flex-shrink-0 px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
                activeRound === r
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30"
                  : "glass hover:bg-white/15 text-white/80"
              }`}
            >
              <span>Ronde {r}</span>
              {isDone ? <span className="ml-1.5 text-xs">✓</span> : completedCount > 0 ? <span className="ml-1.5 text-[10px] opacity-80">({completedCount}/{rMatches.length})</span> : null}
            </button>
          );
        })}
      </div>

      {/* Matches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roundMatches.map((m: Match, idx: number) => (
          <div key={m.id} id={`match-${m.id}`} className="animate-slide-up scroll-mt-24" style={{ animationDelay: `${idx * 40}ms` }}>
            <MatchCard
              match={m}
              p1={playerById(m.player1_id, players)}
              p2={playerById(m.player2_id, players)}
              onEdit={() => (isAdmin ? openEdit(m) : onRequestAdmin())}
              onReset={() => (isAdmin ? resetMatchScore(m.id) : onRequestAdmin())}
              editing={isAdmin && editingMatch === m.id}
              saveScore={saveScore}
              score1={score1}
              setScore1={setScore1}
              score2={score2}
              setScore2={setScore2}
              saving={savingMatch}
              onCancel={() => setEditingMatch(null)}
              colorScheme="emerald"
              allowDraw={true}
              isAdmin={isAdmin}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ TOURNAMENT VIEW ============
function TournamentView({
  tournament,
  players,
  matches,
  playerById,
  editingMatch,
  openEdit,
  saveScore,
  resetMatchScore,
  score1,
  setScore1,
  score2,
  setScore2,
  savingMatch,
  setEditingMatch,
  isAdmin,
  onRequestAdmin,
  searchOpen,
  setSearchOpen,
}: any) {
  const rounds = Array.from(
    new Set<number>(matches.map((m: Match) => m.round))
  ).sort((a: number, b: number) => a - b);

  const matchesByRound: Record<number, Match[]> = {};
  for (const r of rounds) {
    matchesByRound[r] = matches
      .filter((m: Match) => m.round === r)
      .sort((a: Match, b: Match) => a.position - b.position);
  }

  const finalRound = rounds[rounds.length - 1];
  const finalMatch = matchesByRound[finalRound]?.[0];
  const champion =
    finalMatch?.completed && finalMatch.winner_id
      ? playerById(finalMatch.winner_id, players)
      : null;

  const roundLabels: Record<number, string> = {};
  const totalRounds = rounds.length;
  rounds.forEach((r: number, idx: number) => {
    const fromEnd = totalRounds - idx;
    if (fromEnd === 1) roundLabels[r] = "🏆 FINAL";
    else if (fromEnd === 2) roundLabels[r] = "SEMI-FINAL";
    else if (fromEnd === 3) roundLabels[r] = "PEREMPAT-FINAL";
    else if (fromEnd === 4) roundLabels[r] = "16 BESAR";
    else roundLabels[r] = `RONDE ${r}`;
  });

  const totalCompleted = matches.filter((m: Match) => m.completed).length;
  const progress = Math.round((totalCompleted / matches.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              🎯 SISTEM GUGUR
            </div>
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${searchOpen ? "bg-amber-500/30 text-amber-200 border border-amber-400/40" : "glass hover:bg-white/15 text-white/70"}`}
              title="Cari pertandingan"
            >
              🔍 Cari
            </button>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{tournament.name}</h1>
          <p className="text-white/50 text-sm">
            <span className="font-bold text-white/80">{players.length}</span> pemain •{" "}
            <span className="font-bold text-white/80">{matches.length}</span> pertandingan •{" "}
            <span className="font-bold text-white/80">{totalRounds}</span> babak
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden max-w-xs">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-white/50 font-semibold tabular-nums">{totalCompleted}/{matches.length}</span>
          </div>
        </div>
        {champion && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500/20 via-amber-500/25 to-yellow-500/20 border border-yellow-400/40 px-5 py-4 shadow-xl shadow-amber-500/20 animate-scale-in">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-yellow-400/30 rounded-full blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="text-4xl animate-float">🏆</div>
              <div>
                <div className="text-yellow-200/80 text-[10px] uppercase tracking-widest font-bold">Juara Turnamen</div>
                <div className="text-yellow-50 font-black text-xl">{champion.name}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl glass-strong p-4 sm:p-6 lg:p-8 overflow-x-auto shadow-xl shadow-black/20">
        <div className="flex gap-4 sm:gap-6 lg:gap-8 min-w-max">
          {rounds.map((roundNum: number, rIdx: number) => {
            const rMatches = matchesByRound[roundNum];
            const isLast = roundNum === finalRound;
            const isFirst = rIdx === 0;
            const baseGap = 4;
            const matchGap = baseGap * Math.pow(2, rIdx);

            return (
              <div
                key={roundNum}
                className="flex flex-col"
                style={{
                  justifyContent: isFirst ? "flex-start" : "space-around",
                  paddingTop: isFirst ? 0 : `${matchGap / 2}px`,
                  paddingBottom: isFirst ? 0 : `${matchGap / 2}px`,
                }}
              >
                <div className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mb-4 text-center ${isLast ? "text-yellow-300" : "text-white/60"}`}>
                  {roundLabels[roundNum]}
                </div>
                <div className="flex flex-col flex-1" style={{ gap: `${matchGap}px` }}>
                  {rMatches.map((m: Match) => (
                    <div key={m.id} id={`match-${m.id}`} className="w-60 sm:w-64 scroll-mt-24">
                      <BracketMatch
                        match={m}
                        p1={playerById(m.player1_id, players)}
                        p2={playerById(m.player2_id, players)}
                        onEdit={() => (isAdmin ? openEdit(m) : onRequestAdmin())}
                        onReset={() => (isAdmin ? resetMatchScore(m.id) : onRequestAdmin())}
                        editing={isAdmin && editingMatch === m.id}
                        saveScore={saveScore}
                        score1={score1}
                        setScore1={setScore1}
                        score2={score2}
                        setScore2={setScore2}
                        saving={savingMatch}
                        onCancel={() => setEditingMatch(null)}
                        isFinal={isLast}
                        isAdmin={isAdmin}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ MATCH CARD ============
function MatchCard({
  match, p1, p2, onEdit, onReset, editing, saveScore, score1, setScore1, score2, setScore2, saving, onCancel, colorScheme = "emerald", allowDraw, isAdmin,
}: any) {
  if (!p1 || !p2) {
    return (
      <div className="rounded-2xl glass border-dashed p-4 text-white/40 text-sm text-center italic">Menunggu pemenang...</div>
    );
  }

  const accent =
    colorScheme === "emerald"
      ? { btn: "from-emerald-500 to-green-500", border: "focus:border-emerald-400", ring: "focus:ring-emerald-400/30", badgeBg: "bg-emerald-500/10", badgeText: "text-emerald-300/80" }
      : { btn: "from-amber-500 to-orange-500", border: "focus:border-amber-400", ring: "focus:ring-amber-400/30", badgeBg: "bg-amber-500/10", badgeText: "text-amber-300/80" };

  const isDraw = match.completed && !match.winner_id;

  return (
    <div className={`rounded-2xl overflow-hidden transition-all glass ${match.completed ? (isDraw ? "border-white/20" : "border-white/10") : "border-white/10 hover:border-white/25 hover:shadow-lg hover:shadow-black/30"}`}>
      {editing && isAdmin ? (
        <div className="p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-white/80 truncate">{p1.name}</span>
              <input type="number" min={0} value={score1} onChange={(e) => setScore1(parseInt(e.target.value) || 0)} className={`w-16 bg-black/40 border border-white/20 rounded-lg px-2 py-2 text-center font-black text-lg focus:outline-none ${accent.border} focus:ring-2 ${accent.ring} transition-all`} />
            </div>
            <div className="text-center text-white/30 text-[10px] uppercase tracking-widest font-bold py-0.5">vs</div>
            <div className="flex items-center gap-2">
              <span className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-white/80 truncate">{p2.name}</span>
              <input type="number" min={0} value={score2} onChange={(e) => setScore2(parseInt(e.target.value) || 0)} className={`w-16 bg-black/40 border border-white/20 rounded-lg px-2 py-2 text-center font-black text-lg focus:outline-none ${accent.border} focus:ring-2 ${accent.ring} transition-all`} />
            </div>
            {allowDraw && score1 === score2 && (
              <div className="text-center text-[11px] text-amber-300/80 bg-amber-500/10 rounded-lg py-1.5 px-2">⚠️ Skor seri (tidak ada pemenang)</div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveScore(match.id)} disabled={saving} className={`flex-1 bg-gradient-to-r ${accent.btn} hover:brightness-110 disabled:opacity-50 text-white text-sm font-black py-2 rounded-xl transition-all active:scale-95 shadow-lg`}>
              {saving ? "Menyimpan..." : "Simpan Skor"}
            </button>
            <button onClick={onCancel} disabled={saving} className="px-4 glass hover:bg-white/15 text-white/80 text-sm font-bold py-2 rounded-xl transition-all active:scale-95">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => (match.completed ? onReset() : onEdit())} className="w-full text-left p-0 hover:bg-white/5 transition-colors group relative">
          {!isAdmin && (
            <div className="absolute top-1.5 right-1.5 z-10 text-white/30 group-hover:text-white/60 transition-colors" title="Hanya admin yang bisa edit skor">
              🔒
            </div>
          )}
          <PlayerRow name={p1.name} score={match.player1_score} isWinner={match.winner_id === p1.id} isDraw={isDraw} completed={match.completed} />
          <div className="h-px bg-white/10" />
          <PlayerRow name={p2.name} score={match.player2_score} isWinner={match.winner_id === p2.id} isDraw={isDraw} completed={match.completed} />
          {match.completed ? (
            <div className="px-3 py-1.5 bg-black/20 text-[10px] text-white/40 text-center uppercase tracking-wider font-semibold group-hover:bg-black/30 transition-colors">
              {isAdmin ? (isDraw ? "🤝 Seri — klik reset" : "✓ Selesai — klik reset") : (isDraw ? "🤝 Seri" : "✓ Selesai")}
            </div>
          ) : (
            <div className={`px-3 py-1.5 text-[10px] text-center uppercase tracking-wider font-semibold transition-colors ${isAdmin ? `${accent.badgeBg} ${accent.badgeText}` : "bg-white/5 text-white/40 group-hover:bg-white/10"}`}>
              {isAdmin ? "Klik masukkan skor" : "🔒 Lihat saja"}
            </div>
          )}
        </button>
      )}
    </div>
  );
}

// ============ BRACKET MATCH ============
function BracketMatch({ match, p1, p2, onEdit, onReset, editing, saveScore, score1, setScore1, score2, setScore2, saving, onCancel, isFinal, isAdmin }: any) {
  const hasBye = match.player1_id ? !match.player2_id : match.player2_id ? !match.player1_id : false;
  const byeWinner = match.player1_id && !match.player2_id ? match.player1_id : match.player2_id && !match.player1_id ? match.player2_id : null;
  const noPlayers = !match.player1_id && !match.player2_id;

  if (noPlayers) {
    return <div className="rounded-xl bg-black/30 border border-white/5 p-2 text-white/25 text-[11px] text-center italic py-5 font-medium">Belum ditentukan</div>;
  }

  if (editing && isAdmin) {
    return (
      <div className="rounded-xl bg-black/50 border-2 border-amber-400/50 p-2.5 space-y-2 shadow-lg shadow-amber-500/20 animate-scale-in">
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-xs font-bold truncate text-white/90">{p1?.name || "—"}</span>
          <input type="number" min={0} value={score1} onChange={(e) => setScore1(parseInt(e.target.value) || 0)} className="w-12 bg-black/50 border border-white/20 rounded px-1.5 py-1 text-center font-black text-sm focus:outline-none focus:border-amber-400 transition-all" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-xs font-bold truncate text-white/90">{p2?.name || "—"}</span>
          <input type="number" min={0} value={score2} onChange={(e) => setScore2(parseInt(e.target.value) || 0)} className="w-12 bg-black/50 border border-white/20 rounded px-1.5 py-1 text-center font-black text-sm focus:outline-none focus:border-amber-400 transition-all" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => saveScore(match.id)} disabled={saving} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black py-1.5 rounded-lg transition-all active:scale-95">
            {saving ? "..." : "Simpan"}
          </button>
          <button onClick={onCancel} disabled={saving} className="px-2 glass hover:bg-white/15 text-white/80 text-xs py-1.5 rounded-lg transition-all">✕</button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => { if (hasBye && byeWinner) return; if (match.completed) onReset(); else onEdit(); }}
      disabled={Boolean(hasBye && byeWinner)}
      className={`w-full rounded-xl overflow-hidden border-2 transition-all text-left group relative ${isFinal ? "border-yellow-400/50 bg-gradient-to-b from-yellow-500/15 via-black/40 to-black/40 shadow-lg shadow-yellow-500/20" : match.completed && match.winner_id ? "border-white/15 bg-black/40" : "border-white/10 bg-black/30"} ${!(hasBye && byeWinner) ? "hover:bg-white/10 hover:border-amber-400/40 cursor-pointer hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.98]" : "opacity-80"}`}
    >
      {!isAdmin && !hasBye && (
        <div className="absolute top-1 right-1 z-10 text-white/30 group-hover:text-white/60 transition-colors text-[9px]">
          🔒
        </div>
      )}
      <PlayerRow name={p1?.name || (match.player1_id ? "?" : "Bye")} score={p1 ? match.player1_score : null} isWinner={p1 && match.winner_id === p1.id} isDraw={false} completed={match.completed} compact isBye={!p1 && match.player1_id === null} />
      <div className="h-px bg-white/10" />
      <PlayerRow name={p2?.name || (match.player2_id ? "?" : "Bye")} score={p2 ? match.player2_score : null} isWinner={p2 && match.winner_id === p2.id} isDraw={false} completed={match.completed} compact isBye={!p2 && match.player2_id === null} />
      {!match.completed && !hasBye && (
        <div className={`px-2 py-1 text-[9px] text-center uppercase tracking-widest font-bold transition-colors ${isAdmin ? "bg-amber-500/10 text-amber-300/80" : "bg-white/5 text-white/40"}`}>
          {isAdmin ? "Klik untuk skor" : "🔒 Lihat saja"}
        </div>
      )}
      {match.completed && !hasBye && (
        <div className={`px-2 py-1 bg-black/30 text-[9px] text-center uppercase tracking-widest font-bold transition-colors ${isAdmin ? "text-white/40 group-hover:text-white/60" : "text-white/30"}`}>
          {isAdmin ? "klik reset" : "selesai"}
        </div>
      )}
      {hasBye && byeWinner && <div className="px-2 py-1 bg-black/30 text-[9px] text-white/30 text-center uppercase tracking-widest font-bold">Bye (otomatis lanjut)</div>}
    </button>
  );
}

function PlayerRow({ name, score, isWinner, isDraw, completed, compact, isBye }: {
  name: string; score: number | null; isWinner: boolean; isDraw: boolean; completed: boolean; compact?: boolean; isBye?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "px-2.5 py-2" : "px-3 py-2.5"} transition-colors ${isWinner ? "bg-gradient-to-r from-emerald-500/25 to-transparent text-white" : isDraw && completed ? "bg-white/5 text-white/70" : completed ? "text-white/40" : "text-white/90"}`}>
      {isWinner && !compact && <span className="text-sm">🏆</span>}
      {isWinner && compact && <span className="text-[10px]">✓</span>}
      <span className={`flex-1 truncate ${compact ? "text-xs font-bold" : "text-sm font-bold"} ${isBye ? "italic text-white/40" : ""}`}>{name}</span>
      {score !== null && <span className={`font-black tabular-nums ${compact ? "text-sm" : "text-lg"} ${isWinner ? "text-emerald-200" : isDraw ? "text-white/70" : "text-white/50"}`}>{score}</span>}
    </div>
  );
}
