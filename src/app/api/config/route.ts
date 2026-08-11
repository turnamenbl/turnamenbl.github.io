import { NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Read config: env vars take priority (set at deploy time), then fall back to DB.
async function readStored() {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 1));
    return row;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Environment variables take priority (immutable at runtime from admin panel)
    const envUrl = process.env.SUPABASE_URL || null;
    const envKey = process.env.SUPABASE_ANON_KEY || null;

    if (envUrl && envKey) {
      return NextResponse.json({
        configured: true,
        supabaseUrl: envUrl,
        supabaseAnonKey: envKey,
        fromEnv: true,
      });
    }

    const row = await readStored();
    return NextResponse.json({
      configured: Boolean(row?.supabaseUrl && row?.supabaseAnonKey),
      supabaseUrl: row?.supabaseUrl || null,
      supabaseAnonKey: row?.supabaseAnonKey || null,
      fromEnv: false,
    });
  } catch (error) {
    console.error("Config fetch error:", error);
    return NextResponse.json(
      {
        configured: false,
        supabaseUrl: null,
        supabaseAnonKey: null,
        fromEnv: false,
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, supabaseUrl, supabaseAnonKey } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    // If env vars are set, do not allow overwriting via admin
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Supabase credentials di-set via environment variable (tidak bisa diubah dari admin panel)." },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "URL dan Anon Key harus diisi" },
        { status: 400 }
      );
    }

    const url = String(supabaseUrl).trim().replace(/\/$/, "");
    const key = String(supabaseAnonKey).trim();

    if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
      return NextResponse.json(
        { error: "URL Supabase harus berupa https://xxxxx.supabase.co" },
        { status: 400 }
      );
    }

    await db
      .insert(appSettings)
      .values({
        id: 1,
        supabaseUrl: url,
        supabaseAnonKey: key,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: {
          supabaseUrl: url,
          supabaseAnonKey: key,
          updatedAt: new Date().toISOString(),
        },
      });

    return NextResponse.json({ success: true, configured: true });
  } catch (error) {
    console.error("Config update error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan konfigurasi" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Credentials dikelola via environment variable." },
        { status: 400 }
      );
    }
    await db
      .update(appSettings)
      .set({
        supabaseUrl: null,
        supabaseAnonKey: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(appSettings.id, 1));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Gagal menghapus konfigurasi" }, { status: 500 });
  }
}
