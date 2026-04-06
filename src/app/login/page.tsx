import { loginAction } from "@/lib/server/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "1";

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="panel w-full max-w-md rounded-[32px] p-8">
        <div className="eyebrow">SEO Tool New</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">Sign in</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          Local auth is enabled by default. Use the existing admin account from the original tracker data.
        </p>

        {hasError ? (
          <div className="mt-5 rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            Incorrect username, email, or password.
          </div>
        ) : null}

        <form action={loginAction} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="eyebrow">Username or email</span>
            <input
              name="login"
              className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-3 outline-none"
              placeholder="admin"
            />
          </label>
          <label className="grid gap-2">
            <span className="eyebrow">Password</span>
            <input
              name="password"
              type="password"
              className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-3 outline-none"
              placeholder="admin123"
            />
          </label>
          <button className="mt-2 rounded-[20px] bg-[var(--green)] px-4 py-3 font-medium text-slate-950">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
