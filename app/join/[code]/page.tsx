"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SUPABASE_AUTH_ENABLED,
  loadStoredSession,
  saveStoredSession,
  ensureActiveSession,
  signInWithPassword,
  signUpWithPassword,
  type StoredSession,
} from "../../lib/auth";

type ResolvedLink = {
  search_space_id: number;
  course_name: string;
  role: string;
};

type RedeemResult = {
  success: boolean;
  search_space_id: number;
  role: string;
  course_name: string;
};

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;

  const [resolved, setResolved] = useState<ResolvedLink | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState<StoredSession | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = loadStoredSession();
      const active = await ensureActiveSession(stored);
      if (active) {
        setSession(active);
        saveStoredSession(active);
      }
      setAuthReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch(`/api/invite-links/resolve/${encodeURIComponent(code)}`);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(
            (body as { detail?: string }).detail || `Invalid invite code (${resp.status})`
          );
        }
        const data: ResolvedLink = await resp.json();
        setResolved(data);
        setResolveError(null);
      } catch (err) {
        setResolveError(err instanceof Error ? err.message : "Failed to resolve invite code");
        setResolved(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const redeem = useCallback(
    async (token: string) => {
      if (!code || redeemSuccess) return;
      setRedeemLoading(true);
      setRedeemError(null);
      try {
        const resp = await fetch(`/api/invite-links/redeem/${encodeURIComponent(code)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(
            (body as { detail?: string }).detail || `Failed to join class (${resp.status})`
          );
        }
        const data: RedeemResult = await resp.json();
        if (data.success) {
          setRedeemSuccess(true);
          setTimeout(() => router.push("/"), 1500);
        }
      } catch (err) {
        setRedeemError(err instanceof Error ? err.message : "Failed to redeem invite code");
      } finally {
        setRedeemLoading(false);
      }
    },
    [code, redeemSuccess, router]
  );

  useEffect(() => {
    if (session?.access_token && resolved && !redeemSuccess) {
      void redeem(session.access_token);
    }
  }, [session, resolved, redeemSuccess, redeem]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const sess = await signInWithPassword(email, password);
      saveStoredSession(sess);
      setSession(sess);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const result = await signUpWithPassword(email, password);
      if (result.session) {
        saveStoredSession(result.session);
        setSession(result.session);
      } else if (result.requiresEmailConfirmation) {
        setAuthNotice("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (!SUPABASE_AUTH_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="module w-full max-w-sm">
          <h1 className="text-lg font-semibold">Auth not configured</h1>
          <p className="text-sm text-gray-500">Supabase auth is not enabled.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-gray-500">Checking invite code...</p>
      </div>
    );
  }

  if (resolveError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">Invalid Invite Link</h1>
          <p className="text-sm text-red-400">{resolveError}</p>
          <p className="text-sm text-gray-500">Ask the course owner for a valid invite code.</p>
        </div>
      </div>
    );
  }

  if (redeemSuccess && resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-2">
          <h1 className="text-lg font-semibold">You&apos;re in!</h1>
          <p className="text-sm text-gray-400">
            Joined <strong>{resolved.course_name}</strong> as {resolved.role}.
          </p>
          <p className="text-sm text-gray-500">Redirecting to Teacher Console...</p>
        </div>
      </div>
    );
  }

  if (!session && authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleSignIn} className="w-full max-w-sm space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Join {resolved?.course_name} as Teacher</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sign in or create an account to join this course.
            </p>
          </div>
          {authError && <p className="text-sm text-red-400">{authError}</p>}
          {authNotice && <p className="text-sm text-yellow-400">{authNotice}</p>}
          <label className="block text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-gray-600 bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-gray-600 bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-xl bg-white text-black py-2 text-sm font-semibold"
          >
            {authLoading ? "Signing in..." : "Sign in"}
          </button>
          <button
            type="button"
            disabled={authLoading}
            onClick={handleSignUp}
            className="w-full rounded-xl border border-gray-600 py-2 text-sm font-semibold"
          >
            {authLoading ? "Working..." : "Create account"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3">
        <h1 className="text-lg font-semibold">Joining {resolved?.course_name}...</h1>
        {redeemLoading && <p className="text-sm text-gray-500">Enrolling you now...</p>}
        {redeemError && <p className="text-sm text-red-400">{redeemError}</p>}
      </div>
    </div>
  );
}
