import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserById, type User } from "@/lib/server/repo";

const SESSION_COOKIE = "seo_tool_session";
const SESSION_SECRET = process.env.SEO_TOOL_SESSION_SECRET ?? "seo-tool-new-local-secret";

function sign(value: string) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function createPayload(userId: number) {
  const timestamp = Date.now().toString();
  const value = `${userId}.${timestamp}`;
  return `${value}.${sign(value)}`;
}

function verifyPayload(payload: string) {
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  const [userId, timestamp, signature] = parts;
  const value = `${userId}.${timestamp}`;
  if (sign(value) !== signature) return null;
  const age = Date.now() - Number(timestamp);
  if (Number.isNaN(age) || age > 1000 * 60 * 60 * 24 * 14) return null;
  return Number(userId);
}

export async function createSession(userId: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createPayload(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const payload = store.get(SESSION_COOKIE)?.value;
  if (!payload) return null;
  const userId = verifyPayload(payload);
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user || !user.is_active) return null;
  return user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
