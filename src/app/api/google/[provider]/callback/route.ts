import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/server/google";
import { getSessionUser } from "@/lib/server/session";
import { getBaseUrl } from "@/lib/server/url";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (provider !== "sheets" && provider !== "gsc") {
    return NextResponse.redirect(new URL("/settings?google_error=invalid-provider", request.url));
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get(`seo_google_state_${provider}`)?.value;
  store.delete(`seo_google_state_${provider}`);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`/settings?google_error=${provider}-state`, request.url));
  }

  try {
    const baseUrl = await getBaseUrl();
    await exchangeGoogleCode(user.id, provider, baseUrl, code);
    return NextResponse.redirect(new URL(`/settings?google_${provider}=connected`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth-failed";
    return NextResponse.redirect(new URL(`/settings?google_error=${encodeURIComponent(message)}`, request.url));
  }
}
