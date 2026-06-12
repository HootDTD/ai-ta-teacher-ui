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

  const brand = (
    <div className="auth-brand">
      <video src="/thinking.mp4" autoPlay loop muted playsInline className="auth-brand__owl" aria-hidden />
      <div className="auth-brand__wordmark">Hoot</div>
      <div className="auth-brand__subtitle">{resolved?.role === 'student' ? 'AI Teaching Assistant' : 'Teacher Console'}</div>
    </div>
  );

  if (!SUPABASE_AUTH_ENABLED) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          {brand}
          <div className="teacher-alert teacher-alert--danger px-3 py-2 text-sm">
            Hoot isn&apos;t fully set up yet. Please contact your administrator.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="boot-screen">
          <video src="/thinking.mp4" autoPlay loop muted playsInline className="boot-screen__owl" aria-hidden />
          <div className="boot-screen__wordmark">Hoot</div>
          <div className="boot-screen__bar" />
          <div className="boot-screen__label">Checking your invite…</div>
        </div>
      </div>
    );
  }

  if (resolveError) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          {brand}
          <h1 className="text-lg font-semibold teacher-section-title" style={{ textAlign: 'center', margin: 0 }}>
            Invalid invite link
          </h1>
          <div className="teacher-alert teacher-alert--danger px-3 py-2 text-sm">{resolveError}</div>
          <p className="text-sm teacher-muted" style={{ textAlign: 'center', margin: 0 }}>
            Ask the course owner for a valid invite link.
          </p>
        </div>
      </div>
    );
  }

  if (redeemSuccess && resolved) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          {brand}
          <h1 className="text-lg font-semibold teacher-section-title" style={{ textAlign: 'center', margin: 0 }}>
            You&apos;re in!
          </h1>
          <p className="text-sm teacher-muted" style={{ textAlign: 'center', margin: 0 }}>
            Joined <strong>{resolved.course_name}</strong> as {resolved.role}.
          </p>
          <p className="text-sm teacher-muted" style={{ textAlign: 'center', margin: 0 }}>
            Redirecting to the Teacher Console…
          </p>
        </div>
      </div>
    );
  }

  if (!session && authReady) {
    return (
      <div className="auth-screen">
        <form onSubmit={handleSignIn} className="auth-card">
          {brand}
          <h1 className="text-lg font-semibold teacher-section-title" style={{ textAlign: 'center', margin: 0 }}>
            Join {resolved?.course_name ?? 'this course'}
          </h1>
          <p className="text-sm teacher-muted" style={{ textAlign: 'center', margin: 0 }}>
            Sign in or create an account to join this course.
          </p>
          {authError && (
            <div className="teacher-alert teacher-alert--danger px-3 py-2 text-sm">{authError}</div>
          )}
          {authNotice && (
            <div className="teacher-alert teacher-alert--success px-3 py-2 text-sm">{authNotice}</div>
          )}
          <label className="block text-sm teacher-muted">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="teacher-input mt-1 h-10 w-full px-3 outline-none"
            />
          </label>
          <label className="block text-sm teacher-muted">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="teacher-input mt-1 h-10 w-full px-3 outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={authLoading}
            className="teacher-button-primary h-10 w-full text-sm font-semibold"
          >
            {authLoading ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            disabled={authLoading}
            onClick={handleSignUp}
            className="auth-link-button"
          >
            {authLoading ? 'Working…' : 'New here? Create an account'}
          </button>
        </form>
      </div>
    );
  }

  if (redeemError) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          {brand}
          <div className="teacher-alert teacher-alert--danger px-3 py-2 text-sm">{redeemError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="boot-screen">
        <video src="/thinking.mp4" autoPlay loop muted playsInline className="boot-screen__owl" aria-hidden />
        <div className="boot-screen__wordmark">Hoot</div>
        <div className="boot-screen__bar" />
        <div className="boot-screen__label">
          Enrolling you in {resolved?.course_name ?? 'this course'}…
        </div>
      </div>
    </div>
  );
}
