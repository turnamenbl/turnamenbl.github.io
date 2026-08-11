"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AppConfig,
  fetchConfig,
  getSupabase,
  createTournament,
} from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function HomePage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [tablesOk, setTablesOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetchConfig()
      .then(async (cfg) => {
        setConfig(cfg);
        if (cfg.configured) {
          const client = getSupabase(cfg);
          if (client) {
            try {
              const { error } = await client
                .from("tournaments")
                .select("id", { count: "exact", head: true });
              setTablesOk(!error);
            } catch {
              setTablesOk(false);
            }
          } else {
            setTablesOk(false);
          }
        }
      })
      .finally(() => setConfigLoading(false));
  }, []);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!config?.configured) {
    return <SetupRequired />;
  }

  const supabase = getSupabase(config);
  if (!supabase) return <SetupRequired />;

  if (tablesOk === false) {
    return <TablesMissing />;
  }

  return <CreateForm supabase={supabase} router={router} />;
}

function TablesMissing() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in px-4">
      <div className="max-w-xl w-full rounded-3xl glass-strong p-8 text-center space-y-5 shadow-2xl shadow-black/30 animate-scale-in">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center text-4xl shadow-xl shadow-rose-900/40">
          ⚠️
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Tabel Supabase Belum Dibuat
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Koneksi ke Supabase tersimpan, tapi tabel <code className="text-emerald-300">tournaments</code>,{" "}
            <code className="text-emerald-300">players</code>, dan <code className="text-emerald-300">matches</code>{" "}
            belum ada di database Anda.
          </p>
        </div>
        <div className="text-left bg-black/40 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-white/80 text-sm font-bold">Langkah berikutnya:</p>
          <ol className="text-white/60 text-sm space-y-1.5 list-decimal list-inside">
            <li>Buka halaman Admin (link titik di footer, atau klik tombol di bawah)</li>
            <li>Klik tombol <span className="text-emerald-300 font-semibold">Salin</span> di panel SQL Schema</li>
            <li>Buka Supabase Dashboard → SQL Editor → New Query</li>
            <li>Paste SQL tersebut dan klik <span className="font-semibold">Run</span></li>
            <li>Kembali ke sini dan refresh halaman</li>
          </ol>
        </div>
        <Link
          href="/admin"
          className="inline-block w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30"
        >
          Buka Admin Panel
        </Link>
      </div>
    </div>
  );
}

function SetupRequired() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in px-4">
      <div className="max-w-lg w-full rounded-3xl glass-strong p-8 text-center space-y-5 shadow-2xl shadow-black/30 animate-scale-in">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-4xl shadow-xl shadow-orange-900/40 animate-float">
          ⚙️
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Setup Database Diperlukan
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Hubungkan proyek Supabase Anda untuk mulai membuat bagan. Data akan
            tersimpan di cloud dan tersinkron di semua perangkat.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-block w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30"
        >
          Buka Admin untuk Setup
        </Link>
        <p className="text-white/30 text-xs">
          Link admin tersedia di pojok kiri bawah halaman.
        </p>
      </div>
    </div>
  );
}

function CreateForm({
  supabase,
  router,
}: {
  supabase: SupabaseClient;
  router: ReturnType<typeof useRouter>;
}) {
  const [selectedType, setSelectedType] = useState<"league" | "tournament" | null>(null);
  const [name, setName] = useState("");
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [names, setNames] = useState<string[]>([]);
  const [step, setStep] = useState<"choose" | "setup" | "players">("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectType = (type: "league" | "tournament") => {
    setSelectedType(type);
    setStep("setup");
  };

  const handleNextFromSetup = () => {
    if (!name.trim() || name.trim().length < 3) {
      setError("Nama liga/turnamen minimal 3 karakter");
      return;
    }
    setError(null);
    setStep("players");
    setPlayerCount(4);
    setNames(Array(4).fill(""));
  };

  const handleCountChange = (newCount: number) => {
    const count = Math.max(2, Math.min(64, newCount));
    setPlayerCount(count);
    setNames((prev) => {
      if (count > prev.length) {
        return [...prev, ...Array(count - prev.length).fill("")];
      }
      return prev.slice(0, count);
    });
  };

  const handleNameChange = (index: number, value: string) => {
    setNames((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmed = names.map((n) => n.trim()).filter(Boolean);
    if (trimmed.length < 2) {
      setError("Minimal 2 nama pemain yang harus diisi");
      return;
    }
    if (new Set(trimmed.map((n) => n.toLowerCase())).size !== trimmed.length) {
      setError("Nama pemain tidak boleh sama");
      return;
    }

    setLoading(true);
    try {
      const t = await createTournament(supabase, selectedType!, name.trim(), trimmed);
      router.push(`/t/${t.slug}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "players") setStep("setup");
    else if (step === "setup") setStep("choose");
    setError(null);
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {step === "choose" && (
        <div className="space-y-10">
          <div className="text-center space-y-4 animate-slide-up">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-emerald-200/80 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Bagan tersimpan otomatis di cloud Supabase
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
              <span className="bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
                Bagan Billiard
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-green-400 to-teal-300 bg-clip-text text-transparent">
                Mudah &amp; Cepat
              </span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Pilih model kompetisi, beri nama, masukkan pemain — bagan siap digunakan di mana saja.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-3xl mx-auto">
            <button
              onClick={() => handleSelectType("league")}
              className="group relative overflow-hidden rounded-3xl glass-strong p-7 sm:p-9 text-left transition-all duration-500 hover:scale-[1.02] hover:border-emerald-400/50 hover:shadow-2xl hover:shadow-emerald-500/20 animate-slide-up"
              style={{ animationDelay: "100ms" }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-900/40 mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <span className="text-2xl">🏆</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-2 bg-gradient-to-r from-white to-emerald-100 bg-clip-text text-transparent">
                  Sistem Liga
                </h2>
                <p className="text-white/60 text-sm leading-relaxed mb-5">
                  <span className="font-semibold text-emerald-300">Round-robin:</span>{" "}
                  semua pemain saling bertemu. Menang 3 poin, seri 0, kalah 0. Tie-breaker selisih game lalu abjad nama.
                </p>
                <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold transition-transform group-hover:translate-x-1">
                  Pilih Liga <span>→</span>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-400/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => handleSelectType("tournament")}
              className="group relative overflow-hidden rounded-3xl glass-strong p-7 sm:p-9 text-left transition-all duration-500 hover:scale-[1.02] hover:border-amber-400/50 hover:shadow-2xl hover:shadow-amber-500/20 animate-slide-up"
              style={{ animationDelay: "200ms" }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-900/40 mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                  <span className="text-2xl">🎯</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-2 bg-gradient-to-r from-white to-amber-100 bg-clip-text text-transparent">
                  Sistem Gugur
                </h2>
                <p className="text-white/60 text-sm leading-relaxed mb-5">
                  <span className="font-semibold text-amber-300">Single elimination:</span>{" "}
                  kalah sekali tersingkir. Bracket otomatis dengan bye bila jumlah pemain bukan kelipatan 2.
                </p>
                <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold transition-transform group-hover:translate-x-1">
                  Pilih Turnamen <span>→</span>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-400/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          <div className="text-center animate-fade-in" style={{ animationDelay: "400ms" }}>
            <Link href="/admin" className="text-white/40 hover:text-white/70 text-sm inline-flex items-center gap-2 transition-colors group">
              <span className="w-8 h-8 rounded-lg glass flex items-center justify-center group-hover:bg-white/10 transition-colors">📋</span>
              <span>Kelola bagan</span>
            </Link>
          </div>
        </div>
      )}

      {step === "setup" && (
        <div className="max-w-xl mx-auto space-y-6 animate-scale-in">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="w-10 h-10 rounded-xl glass hover:bg-white/15 flex items-center justify-center transition-all hover:scale-105" aria-label="Kembali">←</button>
            <div>
              <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-1 ${selectedType === "league" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
                {selectedType === "league" ? "🏆 LIGA BARU" : "🎯 TURNAMEN BARU"}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Beri Nama Bagan</h2>
              <p className="text-white/50 text-sm">Nama ini akan menjadi ID URL halaman (slug).</p>
            </div>
          </div>

          <div className="rounded-2xl glass-strong p-5 sm:p-6 space-y-5 shadow-xl shadow-black/20">
            <div>
              <label className="block text-sm font-semibold mb-2 text-white/80">
                Nama {selectedType === "league" ? "liga" : "turnamen"}
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selectedType === "league" ? "Contoh: Liga Billiard Jakarta 2026" : "Contoh: Turnamen HUT RI Cup"}
                className="w-full bg-black/30 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/20 transition-all placeholder:text-white/30"
                onKeyDown={(e) => e.key === "Enter" && handleNextFromSetup()}
              />
              {name.trim() && (
                <div className="mt-2 text-xs text-white/50">
                  URL:{" "}
                  <code className="text-emerald-300 font-mono">
                    /t/{name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "")}
                  </code>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/15 border border-red-400/30 text-red-100 rounded-xl px-4 py-3 text-sm flex items-start gap-2 animate-shake">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleNextFromSetup}
              className={`w-full font-black py-3 rounded-xl transition-all active:scale-[0.98] text-base shadow-xl text-white ${
                selectedType === "league"
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 shadow-emerald-500/30"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/30"
              }`}
            >
              Lanjut ke Pemain →
            </button>
          </div>
        </div>
      )}

      {step === "players" && (
        <div className="max-w-2xl mx-auto space-y-6 animate-scale-in">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="w-10 h-10 rounded-xl glass hover:bg-white/15 flex items-center justify-center transition-all hover:scale-105" aria-label="Kembali">←</button>
            <div>
              <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-1 ${selectedType === "league" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
                {selectedType === "league" ? "🏆 LIGA" : "🎯 GUGUR"}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                {name}
              </h2>
            </div>
          </div>

          <div className="rounded-2xl glass-strong p-5 sm:p-6 space-y-5 shadow-xl shadow-black/20">
            <div>
              <label className="block text-sm font-semibold mb-3 text-white/80 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs">👥</span>
                Jumlah pemain
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => handleCountChange(playerCount - 1)} className="w-11 h-11 rounded-xl glass hover:bg-white/15 active:scale-95 font-bold text-lg transition-all">−</button>
                <input
                  type="number"
                  min={2}
                  max={64}
                  value={playerCount}
                  onChange={(e) => handleCountChange(parseInt(e.target.value) || 2)}
                  className="flex-1 bg-black/30 border border-white/15 rounded-xl px-4 py-3 text-center text-xl font-black focus:outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/20 transition-all"
                />
                <button onClick={() => handleCountChange(playerCount + 1)} className="w-11 h-11 rounded-xl glass hover:bg-white/15 active:scale-95 font-bold text-lg transition-all">+</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {[2, 4, 8, 16, 32].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleCountChange(n)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                      playerCount === n
                        ? selectedType === "league"
                          ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30"
                          : "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                        : "glass hover:bg-white/15 text-white/70"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <label className="block text-sm font-semibold mb-3 text-white/80 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs">✏️</span>
                Nama-nama pemain
              </label>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {names.map((pname, i) => (
                  <div key={i} className="flex items-center gap-2 group animate-slide-up" style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}>
                    <span className={`w-9 h-10 flex items-center justify-center text-xs font-bold flex-shrink-0 rounded-lg ${pname.trim() ? "text-emerald-300" : "text-white/40"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <input
                      type="text"
                      value={pname}
                      onChange={(e) => handleNameChange(i, e.target.value)}
                      placeholder={`Pemain ${i + 1}`}
                      className="flex-1 bg-black/30 border border-white/15 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder:text-white/30"
                      autoComplete="off"
                    />
                    {pname.trim() && <span className="w-6 text-emerald-400 text-sm flex-shrink-0 text-center">✓</span>}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/15 border border-red-400/30 text-red-100 rounded-xl px-4 py-3 text-sm flex items-start gap-2 animate-shake">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full relative overflow-hidden font-black py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-base shadow-xl text-white ${
                selectedType === "league"
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 shadow-emerald-500/30 hover:shadow-emerald-500/50"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/30 hover:shadow-amber-500/50"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Membuat bagan...
                </span>
              ) : (
                <>Buat Bagan 🎱</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
