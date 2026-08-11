# 🎱 Billiard Bracket Maker

Aplikasi web untuk membuat bagan turnamen billiard dengan dua sistem:
- **🏆 Liga (Round-Robin)** — semua pemain saling bertemu
- **🎯 Sistem Gugur (Single Elimination)** — kalah sekali tersingkir

Data disimpan di **Supabase** (PostgreSQL cloud), jadi bisa diakses dari perangkat manapun.

---

## 🚀 Cara deploy ke Vercel (disarankan, gratis)

GitHub Pages **tidak bisa** digunakan karena aplikasi ini butuh server (Next.js API routes). Pakai Vercel:

### 1. Push kode ke GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TURNAMENBL/turnamenbl.github.io.git
git push -u origin main
```

> Kalau repo Anda bernama `turnamenbl.github.io`, tidak masalah — Vercel akan deploy ke domain Vercel, atau Anda bisa custom domain.

### 2. Deploy ke Vercel
1. Buka [vercel.com](https://vercel.com/) dan login/daftar dengan akun GitHub.
2. Klik **Add New Project** → import repository `turnamenbl.github.io`.
3. Di bagian **Environment Variables**, tambahkan:
   - `DATABASE_URL` (isi dengan URL Postgres dari Vercel Postgres / Neon / Supabase, atau biarkan kosong kalau Anda akan set credentials via admin panel dan membuat tabel app_settings)
   - `ADMIN_PASSWORD` (opsional, default: `admin123`)
   - `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (opsional, kalau mau set langsung dari env)
4. Klik **Deploy**.

> ⚠️ Penting: Supabase project URL + Anon Key juga bisa di-set lewat halaman admin setelah deploy. Kalau Anda set via env var, panel admin akan read-only.

### 3. Setup Supabase
1. Buat project di [supabase.com](https://supabase.com/).
2. Setelah deploy Vercel selesai, buka website Anda, klik titik **•** kecil di tengah footer untuk masuk ke admin.
3. Login dengan password admin (default `admin123`).
4. Klik **"Salin SQL"** di panel SQL Schema, lalu buka Supabase Dashboard → **SQL Editor** → New query → paste → **Run**.
5. Klik **Simpan & Hubungkan** di panel admin.
6. Selesai — bagan bisa dibuat dan diakses dari perangkat manapun!

---

## 🔑 Fitur
- Admin hanya (password `admin123`):
  - Input/edit skor pertandingan
  - Reset skor
  - Hapus bagan
  - Konfigurasi koneksi Supabase
- Pengunjung (share link):
  - Bisa melihat bagan, klasemen, dan skor
  - Tidak bisa mengubah apapun (mode read-only)
  - Ikon gembok 🔒 di kartu pertandingan
- Nama liga/turnamen **wajib diisi**, akan jadi slug URL (contoh: `/t/rgbc-2026`).
- Tie-breaker liga: Poin → Selisih game → Urutan abjad.
- Menang 3 poin, seri/kalah 0 poin.
- Mobile friendly, glassmorphism UI, animasi modern.

---

## 💻 Development lokal
```bash
npm install
npm run dev
```
Aplikasi berjalan di `http://localhost:3000`.

Pastikan Postgres lokal berjalan dan `DATABASE_URL` di `.env` sudah benar.
