import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { loadJson, saveJson } from "@/lib/persist/json-store";

const FILE = "users.json";

export type StoredAccount = {
  id: string;
  email: string;
  name?: string;
  passwordHash?: string;
  google_id?: string;
  email_verified?: boolean;
  full_name?: string;
  given_name?: string;
  family_name?: string;
  picture_url?: string;
  locale?: string;
  auth_provider?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
};

function all(): Record<string, StoredAccount> {
  return loadJson<Record<string, StoredAccount>>(FILE, {});
}

function persist(rows: Record<string, StoredAccount>) {
  saveJson(FILE, rows);
}

export function publicAccount(user: StoredAccount) {
  return {
    id: user.id,
    google_id: user.google_id || null,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    full_name: user.full_name || user.name || null,
    given_name: user.given_name || null,
    family_name: user.family_name || null,
    picture_url: user.picture_url || null,
    locale: user.locale || null,
    auth_provider: user.auth_provider || "credentials",
    last_login_at: user.last_login_at || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function getAccount(id: string) {
  return all()[id] || null;
}

export function findAccountByEmail(email: string) {
  const needle = email.trim().toLowerCase();
  return Object.values(all()).find((row) => row.email === needle) || null;
}

export function findAccountByGoogleId(googleId: string) {
  return Object.values(all()).find((row) => row.google_id === googleId) || null;
}

export function upsertGoogleAccount(profile: {
  google_id: string;
  email: string;
  email_verified: boolean;
  full_name: string;
  given_name: string;
  family_name: string;
  picture_url: string;
  locale: string;
}) {
  const now = new Date().toISOString();
  const rows = all();
  const existing =
    findAccountByGoogleId(profile.google_id) ||
    (profile.email ? findAccountByEmail(profile.email) : null);
  const id = existing?.id || randomUUID();
  const row: StoredAccount = {
    ...(existing || { created_at: now }),
    id,
    email: (profile.email || existing?.email || "").toLowerCase(),
    name: profile.full_name || existing?.name,
    google_id: profile.google_id,
    email_verified: profile.email_verified,
    full_name: profile.full_name,
    given_name: profile.given_name,
    family_name: profile.family_name,
    picture_url: profile.picture_url,
    locale: profile.locale,
    auth_provider: "GOOGLE",
    last_login_at: now,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  rows[id] = row;
  persist(rows);
  return row;
}

export async function registerCredentialsAccount(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (findAccountByEmail(email)) {
    const error = new Error("Email already exists");
    error.name = "DuplicateEmailError";
    throw error;
  }
  const now = new Date().toISOString();
  const row: StoredAccount = {
    id: randomUUID(),
    email,
    name: input.name.trim(),
    full_name: input.name.trim(),
    passwordHash: await bcrypt.hash(input.password, 12),
    auth_provider: "credentials",
    email_verified: false,
    last_login_at: now,
    created_at: now,
    updated_at: now,
  };
  const rows = all();
  rows[row.id] = row;
  persist(rows);
  return row;
}

export async function verifyCredentialsAccount(email: string, password: string) {
  const user = findAccountByEmail(email);
  if (!user?.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const rows = all();
  rows[user.id] = { ...user, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  persist(rows);
  return rows[user.id];
}
