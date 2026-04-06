import "server-only";

import { load } from "cheerio";

const LOCATION_CODES: Record<string, string> = {
  India: "in",
  USA: "us",
  "Global / US": "us",
  Argentina: "ar",
  Brasil: "br",
  Brazil: "br",
  Canada: "ca",
  France: "fr",
  Germany: "de",
  Kenya: "ke",
  Nigeria: "ng",
  Switzerland: "ch",
  Italia: "it",
  Italy: "it",
  Bangladesh: "bd",
  Belgium: "be",
  Denmark: "dk",
  Greece: "gr",
  Malaysia: "my",
  Netherlands: "nl",
  Oman: "om",
  Spain: "es",
  Taiwan: "tw",
  UAE: "ae",
};

function extractDomain(input: string) {
  try {
    const normalized = input.startsWith("http") ? input : `https://${input}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? input;
  }
}

export async function checkRankSerper(keyword: string, location: string, targetDomain: string, apiKey: string) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: keyword, location, num: 100 }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { position: null, url: null, error: `API error: ${response.status}` };
  }

  const data = (await response.json()) as { organic?: { link?: string }[] };
  const domain = extractDomain(targetDomain);
  const organic = data.organic ?? [];
  for (let i = 0; i < organic.length; i += 1) {
    const link = organic[i]?.link ?? "";
    if (extractDomain(link).includes(domain)) {
      return { position: i + 1, url: link, error: null };
    }
  }
  return { position: null, url: null, error: null };
}

export async function checkRankDataForSeo(
  keyword: string,
  location: string,
  targetDomain: string,
  username: string,
  password: string,
) {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword,
        location_name: location,
        language_name: "English",
        depth: 100,
      },
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    return { position: null, url: null, error: `API error ${response.status}` };
  }

  const data = (await response.json()) as {
    tasks?: Array<{ result?: Array<{ items?: Array<{ type?: string; url?: string; rank_absolute?: number }> }> }>;
  };

  const domain = extractDomain(targetDomain);
  const items = data.tasks?.[0]?.result?.[0]?.items ?? [];
  for (const item of items) {
    if (item.type === "organic" && item.url && extractDomain(item.url).includes(domain)) {
      return { position: item.rank_absolute ?? null, url: item.url, error: null };
    }
  }
  return { position: null, url: null, error: null };
}

export async function checkRankScrapingRobot(keyword: string, location: string, targetDomain: string, apiKey: string) {
  const gl = LOCATION_CODES[location] ?? "us";
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&num=100&gl=${gl}`;
  const response = await fetch(`https://api.scrapingrobot.com/?token=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(googleUrl)}&render=false`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return { position: null, url: null, error: `API error: ${response.status}` };
  }

  const html = await response.text();
  const $ = load(html);
  const domain = extractDomain(targetDomain);
  let position = 0;

  $("a[href]").each((_, element) => {
    if (position > 100) return false;
    const href = $(element).attr("href") ?? "";
    if (!href.includes("/url?q=")) return undefined;
    const actualUrl = href.split("/url?q=")[1]?.split("&")[0] ?? "";
    position += 1;
    if (extractDomain(actualUrl).includes(domain)) {
      position = -position;
      return false;
    }
    return undefined;
  });

  if (position < 0) {
    return { position: Math.abs(position), url: null, error: null };
  }
  return { position: null, url: null, error: null };
}

