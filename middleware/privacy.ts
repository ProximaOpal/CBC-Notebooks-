/**
 * Kenya Data Protection Act, 2019 / ODPC compliance helpers.
 * Strip identifiers before telemetry ingest; honour access and erasure requests.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { loadJson, saveJson } from "@/lib/persist/json-store";
import { hmacSecret } from "@/lib/security/secrets";

export const PII_KEYS = [
  "email",
  "name",
  "firstName",
  "lastname",
  "lastName",
  "phone",
  "mobile",
  "msisdn",
  "nationalId",
  "idNumber",
  "address",
  "password",
  "token",
  "ip",
  "ipAddress",
  "clientIp",
  "xForwardedFor",
  "userAgent",
  "cookie",
] as const;

export type PrivacyRequestType = "export" | "delete" | "rectify";
export type PrivacyRequestStatus = "received" | "verified" | "fulfilled" | "rejected";

export type PrivacyRequest = {
  id: string;
  type: PrivacyRequestType;
  subjectHash: string;
  status: PrivacyRequestStatus;
  createdAt: string;
  fulfilledAt?: string;
  lawfulBasis: "Kenya Data Protection Act 2019 ss.26-28";
};

export type AnonymizedPayload = Record<string, unknown>;

const FILE = "privacy-store.json";

type PrivacyStore = {
  subjects: Record<string, Record<string, unknown>>;
  requests: PrivacyRequest[];
};

function store(): PrivacyStore {
  return loadJson<PrivacyStore>(FILE, { subjects: {}, requests: [] });
}

function persist(next: PrivacyStore) {
  saveJson(FILE, next);
}

function secret() {
  return hmacSecret("privacy");
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(`${secret()}:${value.trim().toLowerCase()}`).digest("hex");
}

export function signPrivacyToken(subject: string, type: PrivacyRequestType): string {
  return createHmac("sha256", secret()).update(`${type}:${subject.trim().toLowerCase()}`).digest("hex");
}

export function verifyPrivacyToken(subject: string, type: PrivacyRequestType, token: string): boolean {
  const expected = signPrivacyToken(subject, type);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token || ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function clientIpFromHeaders(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  const read = (key: string) => {
    if (headers instanceof Headers) return headers.get(key);
    const value = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  const forwarded = read("x-forwarded-for") || read("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip || null;
}

export function anonymizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.0.0`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 3).join(":")}::`;
  }
  return hashIdentifier(ip).slice(0, 16);
}

export function anonymizeTelemetry(
  payload: Record<string, unknown>,
  headers?: Headers | Record<string, string | string[] | undefined>
): AnonymizedPayload {
  const blocked = new Set(PII_KEYS.map((key) => key.toLowerCase()));
  const clean: AnonymizedPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key.toLowerCase())) continue;
    if (typeof value === "string" && /@/.test(value) && key.toLowerCase().includes("user")) {
      clean[key] = hashIdentifier(value);
      continue;
    }
    clean[key] = value;
  }
  if (headers) {
    const ip = anonymizeIp(clientIpFromHeaders(headers));
    if (ip) clean.network_prefix = ip;
  }
  delete clean.ip;
  delete clean.ipAddress;
  delete clean.userAgent;
  return clean;
}

export function rememberSubjectRecord(subject: string, record: Record<string, unknown>): void {
  const next = store();
  next.subjects[hashIdentifier(subject)] = {
    ...record,
    email: undefined,
    stored_at: new Date().toISOString(),
  };
  persist(next);
}

export function createPrivacyRequest(type: PrivacyRequestType, subject: string): PrivacyRequest {
  const row: PrivacyRequest = {
    id: randomBytes(12).toString("hex"),
    type,
    subjectHash: hashIdentifier(subject),
    status: "received",
    createdAt: new Date().toISOString(),
    lawfulBasis: "Kenya Data Protection Act 2019 ss.26-28",
  };
  const next = store();
  next.requests.push(row);
  persist(next);
  return row;
}

export function exportUserData(subject: string): {
  request: PrivacyRequest;
  data: Record<string, unknown>;
} {
  const request = createPrivacyRequest("export", subject);
  request.status = "fulfilled";
  request.fulfilledAt = new Date().toISOString();
  const next = store();
  const idx = next.requests.findIndex((row) => row.id === request.id);
  if (idx >= 0) next.requests[idx] = request;
  persist(next);
  const data = next.subjects[hashIdentifier(subject)] || {
    notice: "No account profile stored for this identifier. Telemetry is stored without personal identifiers.",
  };
  return {
    request,
    data: {
      controller: "CBC Notebooks",
      contact: "privacy@cbcnotebooks.co.ke",
      odpc: "Office of the Data Protection Commissioner, Kenya",
      generated_at: new Date().toISOString(),
      subject_hash: request.subjectHash,
      records: data,
    },
  };
}

export function deleteUserData(subject: string): PrivacyRequest {
  const request = createPrivacyRequest("delete", subject);
  const next = store();
  delete next.subjects[hashIdentifier(subject)];
  request.status = "fulfilled";
  request.fulfilledAt = new Date().toISOString();
  const idx = next.requests.findIndex((row) => row.id === request.id);
  if (idx >= 0) next.requests[idx] = request;
  persist(next);
  return request;
}

export function listPrivacyRequests(): PrivacyRequest[] {
  return store().requests;
}
