"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AppConfig,
  fetchConfig,
  getSupabase,
  SUPABASE_SCHEMA_SQL,
} from "@/lib/supabase";
import type { Tournament } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const PASSWORD = "admin123";
const PW_STORAGE = "billiard_admin_auth";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PW_STORAGE) === "1") setAuthed(true);
    } catch {}
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwLoading(true);
    setTimeout(() => {
      if (password === PASSWORD) {
        try { sessionStorage.setItem(PW_STORAGE, "1"); } catch {}
        setAuthed(true);
      } else {
        setPwError("Password salah");
      }
      setPwLoading(false);
    }, 300);
  };

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in px-4">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-3xl glass-strong p-8 shadow-2xl shadow-black/30 animate-scale-in space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-400 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-900/50 mb-2">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Admin Panel</h1>
            <p className="text-white/50 text-sm">Masukkan password admin</p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white/80">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="w-full bg-black/30 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/20 transition-all placeholder:text-white/30 text-center tracking-widest text-lg"
            />
            {pwError && <div className="text-red-300 text-sm text-center flex items-center justify-center gap-1 animate-shake pt-1">⚠️ {pwError}</div>}
          </div>
          <button type="submit" disabled={pwLoading || !password} className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-slate-900/30">
            {pwLoading ? "Memverifikasi..." : "Masuk"}
          </button>
          <div className="text-center">
            <Link href="/" className="text-white/40 hover:text-white/70 text-xs transition-colors">← Kembali ke beranda</Link>
          </div>
        </form>
      </div>
    );
  }

  return <AdminDashboard onLogout={() => { try { sessionStorage.removeItem(PW_STORAGE); } catch {} setAuthed(false); }} />;
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [config, setConfig] = useState<(AppConfig & { fromEnv?: boolean }) | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const fromEnv = Boolean(config?.fromEnv);
  const readOnly = fromEnv;

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);
  const [toursError, setToursError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [password, setPassword] = useState(PASSWORD);

  // Load config
  const loadConfig = async () => {
    const cfg = await fetchConfig();
    setConfig(cfg);
    if (cfg.supabaseUrl) setSupabaseUrl(cfg.supabaseUrl);
    if (cfg.supabaseAnonKey) setSupabaseAnonKey(cfg.supabaseAnonKey);
    return cfg;
  };

  const loadTournaments = async (client: SupabaseClient) => {
    setLoadingTours(true);
    setToursError(null);
    try {
      const { data, error } = await client.from("tournaments").select("*").order("created_at", { ascending: false });
      if (error) {
        const msg = error.message || String(error);
        if (msg.includes("tournaments") || msg.toLowerCase().includes("could not find")) {
          setToursError("__TABLES_MISSING__");
        } else {
          setToursError(msg);
        }
        setTournaments([]);
        return;
      }
      setTournaments((data as Tournament[]) || []);
    } catch (e: any) {
      setToursError(e.message);
    } finally {
      setLoadingTours(false);
    }
  };

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig();
      const client = getSupabase(cfg);
      if (client) {
        // Check if tables exist before loading tournaments
        try {
          const { error } = await client
            .from("tournaments")
            .select("id", { count: "exact", head: true });
          if (error) {
            setToursError("__TABLES_MISSING__");
            setLoadingTours(false);
            setShowSql(true);
            setTournaments([]);
            return;
          }
        } catch {
          setToursError("__TABLES_MISSING__");
          setLoadingTours(false);
          setShowSql(true);
          return;
        }
        await loadTournaments(client);
      } else {
        setLoadingTours(false);
        // First-time setup: show SQL by default
        setShowSql(true);
      }
    })();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    setConfigSuccess(null);
    setSavingConfig(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, supabaseUrl, supabaseAnonKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setConfigSuccess("Konfigurasi tersimpan! Mengetes koneksi ke Supabase...");
      // Re-fetch config and test connection
      const cfg = await loadConfig();
      const client = getSupabase(cfg);
      if (client) {
        setTestingConnection(true);
        try {
          const { error } = await client.from("tournaments").select("id", { count: "exact", head: true });
          if (error) {
            const msg = error.message || String(error);
            setConfigError(
              msg.includes("tournaments") || msg.toLowerCase().includes("could not find")
                ? "Koneksi ke Supabase berhasil, tapi tabel 'tournaments' belum dibuat. Jalankan SQL di bawah ini di Supabase SQL Editor, lalu klik Simpan & Hubungkan ulang."
                : `Koneksi bermasalah: ${msg}`
            );
            setConfigSuccess(null);
            setShowSql(true);
            setTournaments([]);
          } else {
            setConfigSuccess("✓ Tersimpan & koneksi berhasil! Tabel terdeteksi.");
            setShowSql(false);
            await loadTournaments(client);
          }
        } finally {
          setTestingConnection(false);
        }
      }
    } catch (e: any) {
      setConfigError(e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleClearConfig = async () => {
    if (!confirm("Hapus konfigurasi Supabase?")) return;
    const res = await fetch(`/api/config?password=${encodeURIComponent(password)}`, { method: "DELETE" });
    if (res.ok) {
      setSupabaseUrl("");
      setSupabaseAnonKey("");
      setConfig(await loadConfig());
      setTournaments([]);
      setConfigSuccess("Konfigurasi dihapus.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!config) return;
    const client = getSupabase(config);
    if (!client) return;
    if (!confirm("Yakin hapus bagan ini?")) return;
    setDeleting(id);
    try {
      const { error } = await client.from("matches").delete().eq("tournament_id", id);
      if (error) throw error;
      await client.from("players").delete().eq("tournament_id", id);
      await client.from("tournaments").delete().eq("id", id);
      await loadTournaments(client);
    } catch (e: any) {
      alert(e.message || "Gagal menghapus");
    } finally {
      setDeleting(null);
    }
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-500/20 to-slate-600/20 border border-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full mb-2">🔧 ADMIN PANEL</div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Dashboard Admin</h1>
          <p className="text-white/50 text-sm mt-1">Kelola koneksi Supabase dan daftar bagan.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="glass hover:bg-white/15 px-4 py-2 rounded-xl font-medium text-sm transition-all hover:scale-105 active:scale-95">← Beranda</Link>
          <button onClick={onLogout} className="glass hover:bg-red-500/20 hover:border-red-400/30 px-4 py-2 rounded-xl font-medium text-sm text-white/80 hover:text-red-200 transition-all hover:scale-105 active:scale-95">Keluar</button>
        </div>
      </div>

      {/* Supabase Config */}
      <div className="rounded-3xl glass-strong p-6 sm:p-8 shadow-xl shadow-black/20 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center text-2xl shadow-lg shadow-emerald-900/40">☁️</div>
            <div>
              <h2 className="font-black text-lg tracking-tight">Database Supabase</h2>
              <p className="text-white/50 text-sm">
                Status:{" "}
                {config?.configured ? (
                  <span className="text-emerald-300 font-bold">
                    ✓ Terhubung {fromEnv ? <span className="text-white/50 font-normal">(via environment variable)</span> : ""}
                  </span>
                ) : (
                  <span className="text-amber-300 font-bold">Belum di-setup</span>
                )}
              </p>
            </div>
          </div>
          {config?.configured && !fromEnv && (
            <button onClick={handleClearConfig} className="text-xs text-red-300/80 hover:text-red-200 glass hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all">
              Hapus Konfigurasi
            </button>
          )}
        </div>

        {fromEnv && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-400/30 p-4 text-sm text-blue-100">
            ℹ️ Kredensial Supabase diatur lewat environment variable <code className="font-mono text-xs">SUPABASE_URL</code> dan{" "}
            <code className="font-mono text-xs">SUPABASE_ANON_KEY</code> di platform hosting. Tidak bisa diubah dari panel admin ini.
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <fieldset disabled={readOnly} className={readOnly ? "opacity-50 pointer-events-none" : ""}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-1.5">Project URL</label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              required
              readOnly={readOnly}
              className="w-full bg-black/30 border border-white/15 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/20 transition-all placeholder:text-white/30 read-only:opacity-60"
            />
            <p className="text-white/40 text-[11px] mt-1">Contoh: https://abcdefgh.supabase.co</p>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-1.5">Anon (Publishable) Key</label>
            <textarea
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              required
              readOnly={readOnly}
              rows={3}
              className="w-full bg-black/30 border border-white/15 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/20 transition-all placeholder:text-white/30 resize-y read-only:opacity-60"
            />
            <p className="text-white/40 text-[11px] mt-1">Key ini aman dipublikasikan (anon/public key). Bukan service_role key.</p>
          </div>
          <input type="hidden" value={password} onChange={(e) => setPassword(e.target.value)} />

          {configError && (
            <div className="bg-red-500/15 border border-red-400/30 text-red-100 rounded-xl px-4 py-3 text-sm flex items-start gap-2 animate-shake">
              <span>⚠️</span>
              <div>
                <div>{configError}</div>
                <button type="button" onClick={() => setShowSql(true)} className="mt-1 text-xs text-red-200 underline underline-offset-2">
                  Tampilkan SQL untuk membuat tabel
                </button>
              </div>
            </div>
          )}
          {configSuccess && !configError && (
            <div className="bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <span>✓</span>
              <span>{configSuccess}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="submit"
              disabled={readOnly || savingConfig || testingConnection || !supabaseUrl || !supabaseAnonKey}
              className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30"
            >
              {savingConfig ? "Menyimpan..." : testingConnection ? "Testing koneksi..." : "Simpan & Hubungkan"}
            </button>
            <button type="button" onClick={() => setShowSql(!showSql)} className="text-sm text-white/70 hover:text-white glass px-4 py-2 rounded-xl transition-all">
              {showSql ? "Sembunyikan" : "Lihat"} SQL Schema
            </button>
          </div>
          </fieldset>
        </form>

        {showSql && (
          <div className="animate-scale-in space-y-3">
            <div className="bg-black/40 border border-amber-400/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 font-black text-amber-300 text-sm">1</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Buka Supabase SQL Editor</p>
                  <p className="text-white/60 text-xs mt-0.5">Login ke project Supabase Anda, lalu buka menu SQL Editor.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 font-black text-amber-300 text-sm">2</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Paste &amp; jalankan SQL di bawah</p>
                  <p className="text-white/60 text-xs mt-0.5">Klik "New query", paste SQL, lalu klik Run.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 font-black text-emerald-300 text-sm">3</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Klik "Simpan &amp; Hubungkan" lagi</p>
                  <p className="text-white/60 text-xs mt-0.5">Setelah SQL dijalankan, tombol di atas akan berhasil.</p>
                </div>
              </div>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <p className="text-xs text-white/70 font-bold uppercase tracking-wider">SQL Schema:</p>
                <button onClick={copySql} className="text-xs bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 text-white font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95">
                  {copied ? "✓ Tersalin" : "Salin SQL"}
                </button>
              </div>
              <pre className="text-[11px] text-emerald-200/90 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto bg-black/40 rounded-lg p-3 border border-white/5">
{SUPABASE_SCHEMA_SQL}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Tournaments list */}
      <div className="rounded-3xl glass-strong overflow-hidden shadow-xl shadow-black/20">
        <div className="px-5 py-4 border-b border-white/10 bg-black/20 flex items-center gap-2">
          <span className="text-lg">🎱</span>
          <h2 className="font-black text-lg tracking-tight">Daftar Bagan Tersimpan</h2>
          <span className="ml-auto text-xs text-white/50 font-bold">{tournaments.length} bagan</span>
        </div>
        {!config?.configured ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-4xl opacity-40">🔒</div>
            <p className="text-white/50 text-sm">Hubungkan Supabase terlebih dahulu untuk melihat daftar bagan.</p>
          </div>
        ) : loadingTours ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
            <div className="text-white/50 text-sm">Memuat...</div>
          </div>
        ) : toursError ? (
          toursError === "__TABLES_MISSING__" ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 flex items-center justify-center text-3xl">⚠️</div>
              <p className="text-amber-200 font-bold">Tabel belum dibuat di Supabase</p>
              <p className="text-white/60 text-sm max-w-md mx-auto">
                Koneksi berhasil, tapi tabel <code className="text-emerald-300">tournaments</code> belum ditemukan. Jalankan SQL Schema di atas di Supabase SQL Editor.
              </p>
              <button onClick={() => setShowSql(true)} className="mt-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-bold px-5 py-2 rounded-xl transition-all active:scale-95 text-sm">
                Tampilkan SQL Schema
              </button>
            </div>
          ) : (
            <div className="p-12 text-center text-red-300 text-sm">
              ⚠️ {toursError}
            </div>
          )
        ) : tournaments.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center text-3xl">🎱</div>
            <p className="text-white/60">Belum ada bagan.</p>
            <Link href="/" className="inline-block bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-bold px-5 py-2 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/30">
              Buat Bagan Baru
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/30 text-white/60 text-xs uppercase tracking-wider font-bold">
                    <th className="text-left px-5 py-3">Tipe</th>
                    <th className="text-left px-5 py-3">Nama</th>
                    <th className="text-left px-5 py-3">Pemain</th>
                    <th className="text-left px-5 py-3">Dibuat</th>
                    <th className="text-right px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t) => (
                    <tr key={t.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${t.type === "league" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/20" : "bg-amber-500/20 text-amber-200 border border-amber-400/20"}`}>
                          {t.type === "league" ? "🏆 Liga" : "🎯 Gugur"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold">{t.name}</td>
                      <td className="px-5 py-4 font-bold">{t.player_count} <span className="text-white/50 font-normal">pemain</span></td>
                      <td className="px-5 py-4 text-white/60 text-sm">{new Date(t.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/t/${t.slug}`} className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/20 text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95" target="_blank">
                            Buka
                          </Link>
                          <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id} className="bg-red-500/20 hover:bg-red-500/30 border border-red-400/20 text-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                            {deleting === t.id ? "..." : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-white/5">
              {tournaments.map((t) => (
                <div key={t.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${t.type === "league" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
                      {t.type === "league" ? "🏆 Liga" : "🎯 Gugur"}
                    </span>
                    <span className="text-white/50 text-xs">{new Date(t.created_at).toLocaleDateString("id-ID")}</span>
                  </div>
                  <div>
                    <div className="font-black text-base">{t.name}</div>
                    <div className="text-white/50 text-xs">{t.player_count} pemain • <code className="text-emerald-300/80">/{t.slug}</code></div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/t/${t.slug}`} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 py-2 rounded-lg text-xs font-bold text-center transition-all">
                      Buka
                    </Link>
                    <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                      {deleting === t.id ? "..." : "Hapus"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
