import "server-only";

import { cookies } from "next/headers";
import { getUserSetting } from "@/lib/server/repo";

const SERP_SETTING_KEYS = [
  "serper_api_key",
  "dataforseo_username",
  "dataforseo_password",
  "scrapingrobot_api_key",
  "default_serp_api",
] as const;

const COOKIE_PREFIX = "seo_setting_";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type SerpSettingKey = (typeof SERP_SETTING_KEYS)[number];

function getCookieName(key: SerpSettingKey) {
  return `${COOKIE_PREFIX}${key}`;
}

export async function getSerpSetting(userId: number, key: SerpSettingKey, fallbackGlobal = false) {
  const dbValue = getUserSetting(userId, key, fallbackGlobal);
  if (dbValue) return dbValue;
  const store = await cookies();
  return store.get(getCookieName(key))?.value ?? null;
}

export async function setSerpSettingCookie(key: SerpSettingKey, value: string) {
  const store = await cookies();
  if (value) {
    store.set(getCookieName(key), value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return;
  }

  store.delete(getCookieName(key));
}

export { SERP_SETTING_KEYS };
