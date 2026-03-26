"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCcw, UploadCloud } from 'lucide-react';
import {
  SUPABASE_AUTH_ENABLED,
  clearStoredSession,
  ensureActiveSession,
  loadStoredSession,
  saveStoredSession,
  signInWithPassword,
  signUpWithPassword,
  type StoredSession,
} from './lib/auth';

const WEEK_KINDS = {
  notes: 'Course Notes',
  slides: 'Course Slides',
} as const;

const RESOURCE_WEIGHT_LABELS = {
  slides: 'Slides',
  notes: 'Notes',
} as const;

type WeekKind = keyof typeof WEEK_KINDS;
type WeightKind = keyof typeof RESOURCE_WEIGHT_LABELS;
type UploadStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'superseded';

type ClassOption = {
  id: number;
  slug: string;
  name: string;
  subject_name: string;
};

type UploadSummary = {
  id: string;
  week: number;
  kind: WeekKind;
  title: string;
  status?: UploadStatus;
  uploaded_at?: string;
  source_name?: string;
  page_count?: number;
  index_path?: string;
  doc_id?: string;
  error_message?: string;
  warning_count?: number;
  started_at?: string;
  completed_at?: string;
  ocr_provider?: string;
  ocr_summary?: Record<string, unknown>;
};

type SectionState = {
  latest: UploadSummary | null;
  history: UploadSummary[];
};

type WeekState = {
  week: number;
  notes: SectionState;
  slides: SectionState;
};

type CourseState = {
  search_space_id: number;
  course: string;
  slug: string;
  current_week: number;
  weeks: WeekState[];
};

type RetrievalWeights = Record<WeightKind, number>;

type RetrievalWeightResponse = {
  search_space_id: number;
  course: string;
  weights: RetrievalWeights;
  defaults: RetrievalWeights;
  bounds: {
    min: number;
    max: number;
  };
};

const MAX_WEEKS = 16;
const POLL_INTERVAL_MS = 4000;



const isPendingStatus = (status?: string): status is 'queued' | 'processing' => {
  return status === 'queued' || status === 'processing';
};


export default function TeacherConsole() {
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [loadingClasses, setLoadingClasses] = useState<boolean>(true);
  const [courseState, setCourseState] = useState<CourseState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [savingWeek, setSavingWeek] = useState<boolean>(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [retryingUploadId, setRetryingUploadId] = useState<string | null>(null);
  const [pendingWeek, setPendingWeek] = useState<number>(1);
  const [weights, setWeights] = useState<RetrievalWeights | null>(null);
  const [serverWeights, setServerWeights] = useState<RetrievalWeights | null>(null);
  const [defaultWeights, setDefaultWeights] = useState<RetrievalWeights | null>(null);
  const [weightBounds, setWeightBounds] = useState<{ min: number; max: number } | null>(null);
  const [loadingWeights, setLoadingWeights] = useState<boolean>(true);
  const [savingWeights, setSavingWeights] = useState<boolean>(false);
  const accessToken = session?.access_token || '';
  const userLabel = session?.user_email || session?.user_id || 'Signed in';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!SUPABASE_AUTH_ENABLED) {
        if (!cancelled) {
          setAuthError('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.');
          setSession(null);
          setAuthReady(true);
        }
        return;
      }

      const active = await ensureActiveSession(loadStoredSession());
      if (cancelled) return;
      if (active) {
        saveStoredSession(active);
        setSession(active);
      } else {
        clearStoredSession();
        setSession(null);
      }
      setAuthReady(true);
    })().catch((err: unknown) => {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : 'Failed to initialize auth session.';
      setAuthError(msg);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchClassOptions = useCallback(async () => {
    if (!accessToken) {
      setClassOptions([]);
      setSelectedClassId(null);
      setCourseState(null);
      setWeights(null);
      setServerWeights(null);
      setDefaultWeights(null);
      setWeightBounds(null);
      setLoadingClasses(false);
      return;
    }
    setLoadingClasses(true);
    setError(null);
    try {
      const resp = await fetch('/api/classes', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to load classes');
      }
      const data = (await resp.json()) as ClassOption[];
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No classes are available for this account.');
      }
      setClassOptions(data);
      setSelectedClassId((previous) => {
        if (previous && data.some((option) => option.id === previous)) {
          return previous;
        }
        return data[0].id;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load classes';
      setError(msg);
      setClassOptions([]);
      setSelectedClassId(null);
      setCourseState(null);
      setWeights(null);
      setServerWeights(null);
      setDefaultWeights(null);
      setWeightBounds(null);
    } finally {
      setLoadingClasses(false);
    }
  }, [accessToken]);

  const fetchWeeks = useCallback(async (searchSpaceId: number, options?: { background?: boolean }) => {
    if (!accessToken || !Number.isFinite(searchSpaceId) || searchSpaceId <= 0) return;
    const background = Boolean(options?.background);
    if (!background) {
      setLoading(true);
    }
    setError(null);
    try {
      const resp = await fetch(`/api/teacher/weeks?search_space_id=${searchSpaceId}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to load weekly uploads');
      }
      const data = (await resp.json()) as CourseState;
      setCourseState((previous) => {
        setPendingWeek((current) => {
          if (!previous) return data.current_week;
          return current === previous.current_week ? data.current_week : current;
        });
        return data;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load weekly uploads';
      setError(msg);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [accessToken]);

  const fetchWeights = useCallback(async (searchSpaceId: number) => {
    if (!accessToken || !Number.isFinite(searchSpaceId) || searchSpaceId <= 0) return;
    setLoadingWeights(true);
    try {
      const resp = await fetch(`/api/teacher/retrieval-weights?search_space_id=${searchSpaceId}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to load retrieval weights');
      }
      const data = (await resp.json()) as RetrievalWeightResponse;
      setWeights(data.weights);
      setServerWeights(data.weights);
      setDefaultWeights(data.defaults);
      setWeightBounds(data.bounds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load retrieval weights';
      setError(msg);
      setWeights(null);
      setServerWeights(null);
    } finally {
      setLoadingWeights(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authReady) return;
    void fetchClassOptions();
  }, [authReady, fetchClassOptions]);

  useEffect(() => {
    if (!authReady) return;
    if (!accessToken) {
      setCourseState(null);
      setLoading(false);
      setLoadingWeights(false);
      return;
    }
    if (!selectedClassId) {
      setCourseState(null);
      setLoading(false);
      setLoadingWeights(false);
      return;
    }
    void fetchWeeks(selectedClassId);
    void fetchWeights(selectedClassId);
  }, [accessToken, authReady, selectedClassId, fetchWeeks, fetchWeights]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const weeks = useMemo(() => courseState?.weeks ?? [], [courseState]);
  const hasPendingUploads = useMemo(() => {
    return weeks.some((week) =>
      (Object.keys(WEEK_KINDS) as WeekKind[]).some((kind) => {
        const section = kind === 'notes' ? week.notes : week.slides;
        return section.history.some((entry) => isPendingStatus(entry.status));
      }),
    );
  }, [weeks]);

  useEffect(() => {
    if (!accessToken || !selectedClassId || !hasPendingUploads) return;
    const timer = setInterval(() => {
      void fetchWeeks(selectedClassId, { background: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [accessToken, selectedClassId, hasPendingUploads, fetchWeeks]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    if (!email.trim() || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    try {
      const nextSession = await signInWithPassword(email.trim(), password);
      saveStoredSession(nextSession);
      setSession(nextSession);
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    setAuthError(null);
    setAuthNotice(null);
    if (!email.trim() || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    try {
      const result = await signUpWithPassword(email.trim(), password);
      if (result.session) {
        saveStoredSession(result.session);
        setSession(result.session);
        setPassword('');
        return;
      }
      setAuthNotice(
        result.requiresEmailConfirmation
          ? 'Account created. Check your email to confirm, then sign in.'
          : 'Account created. You can sign in now.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    clearStoredSession();
    setSession(null);
    setClassOptions([]);
    setSelectedClassId(null);
    setCourseState(null);
    setWeights(null);
    setServerWeights(null);
    setDefaultWeights(null);
    setWeightBounds(null);
    setFlash(null);
    setError(null);
  };

  const handleCurrentWeekSave = async () => {
    if (!accessToken) {
      setError('Sign in is required.');
      return;
    }
    if (!courseState) return;
    if (pendingWeek === courseState.current_week) return;
    setSavingWeek(true);
    setError(null);
    try {
      const resp = await fetch('/api/teacher/current-week', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          search_space_id: courseState.search_space_id,
          current_week: pendingWeek,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to update current week');
      }
      const data = (await resp.json()) as CourseState;
      setCourseState(data);
      setFlash(`Current week set to ${pendingWeek}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update current week';
      setError(msg);
    } finally {
      setSavingWeek(false);
    }
  };

  const handleUpload = async (file: File | null, week: number, kind: WeekKind) => {
    if (!accessToken) {
      setError('Sign in is required.');
      return;
    }
    if (!file || !selectedClassId) return;
    const key = `${week}-${kind}`;
    setUploadingKey(key);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('search_space_id', String(selectedClassId));
      formData.append('week', String(week));
      formData.append('kind', kind);
      formData.append('title', `${WEEK_KINDS[kind]} · Week ${week}`);
      formData.append('file', file);
      const resp = await fetch('/api/teacher/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Upload failed');
      }
      await fetchWeeks(selectedClassId, { background: true });
      setFlash(`${WEEK_KINDS[kind]} for week ${week} queued for processing.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRetryUpload = async (upload: UploadSummary) => {
    if (!accessToken) {
      setError('Sign in is required.');
      return;
    }
    setRetryingUploadId(upload.id);
    setError(null);
    try {
      const resp = await fetch(`/api/teacher/uploads/${encodeURIComponent(upload.id)}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Retry failed');
      }
      if (selectedClassId) {
        await fetchWeeks(selectedClassId, { background: true });
      }
      setFlash(`${WEEK_KINDS[upload.kind]} for week ${upload.week} re-queued.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      setError(msg);
    } finally {
      setRetryingUploadId(null);
    }
  };

  const handleWeightChange = (kind: WeightKind, value: number) => {
    setWeights((prev) => {
      if (!prev) return prev;
      const rounded = Math.round(value * 100) / 100;
      return { ...prev, [kind]: rounded };
    });
  };

  const handleResetWeights = () => {
    if (!defaultWeights) return;
    setWeights({ ...defaultWeights });
  };

  const handleSaveWeights = async () => {
    if (!accessToken) {
      setError('Sign in is required.');
      return;
    }
    if (!weights || !selectedClassId) return;
    setSavingWeights(true);
    setError(null);
    try {
      const resp = await fetch('/api/teacher/retrieval-weights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ search_space_id: selectedClassId, weights }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to update retrieval weights');
      }
      const data = (await resp.json()) as RetrievalWeightResponse;
      setWeights(data.weights);
      setServerWeights(data.weights);
      setDefaultWeights(data.defaults);
      setWeightBounds(data.bounds);
      setFlash('Retrieval weights updated for this course.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update retrieval weights';
      setError(msg);
    } finally {
      setSavingWeights(false);
    }
  };


  const weightsDirty = useMemo(() => {
    if (!weights || !serverWeights) return false;
    return (Object.keys(RESOURCE_WEIGHT_LABELS) as WeightKind[]).some((key) => {
      return Math.abs(weights[key] - serverWeights[key]) > 0.0001;
    });
  }, [weights, serverWeights]);

  const canResetToDefaults = useMemo(() => {
    if (!weights || !defaultWeights) return false;
    return (Object.keys(RESOURCE_WEIGHT_LABELS) as WeightKind[]).some((key) => Math.abs(weights[key] - defaultWeights[key]) > 0.0001);
  }, [weights, defaultWeights]);


  if (!authReady) {
    return (
      <div className="min-h-screen teacher-shell flex items-center justify-center px-4">
        <div className="text-sm teacher-muted">Checking authentication…</div>
      </div>
    );
  }

  if (!SUPABASE_AUTH_ENABLED) {
    return (
      <div className="min-h-screen teacher-shell flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl teacher-alert teacher-alert--danger p-4 text-sm">
          Supabase auth is not configured. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen teacher-shell flex items-center justify-center px-4">
        <form
          onSubmit={handleSignIn}
          className="w-full max-w-sm rounded-2xl teacher-panel p-5 space-y-4"
        >
          <div>
            <h1 className="text-lg font-semibold tracking-tight teacher-section-title">Teacher sign in</h1>
            <p className="mt-1 text-sm teacher-muted">Use your Supabase account with teacher membership.</p>
          </div>
          {authError && (
            <div className="rounded-xl teacher-alert teacher-alert--danger px-3 py-2 text-sm">
              {authError}
            </div>
          )}
          {authNotice && (
            <div className="rounded-xl teacher-alert teacher-alert--success px-3 py-2 text-sm">
              {authNotice}
            </div>
          )}
          <label className="block text-sm teacher-muted">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="teacher-input mt-1 h-10 w-full rounded-xl px-3 outline-none"
            />
          </label>
          <label className="block text-sm teacher-muted">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="teacher-input mt-1 h-10 w-full rounded-xl px-3 outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={authLoading}
            className="teacher-button-primary h-10 w-full rounded-xl text-sm font-semibold"
          >
            {authLoading ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            disabled={authLoading}
            onClick={handleSignUp}
            className="teacher-button-secondary h-10 w-full rounded-xl text-sm font-semibold"
          >
            {authLoading ? 'Working…' : 'Create account'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen teacher-shell flex flex-col">
      <header className="teacher-header border-b sticky top-0 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="teacher-brand font-semibold tracking-tight">Hoot | Teacher Console</div>
          <div className="flex items-center gap-3">
            <div className="text-xs teacher-muted hidden lg:block max-w-[220px] truncate" title={userLabel}>
              {userLabel}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="teacher-button-secondary px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 space-y-4">
        <div className="rounded-3xl teacher-panel p-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide teacher-muted mb-1">Class</span>
              <select
                value={selectedClassId ?? ''}
                onChange={(e) => setSelectedClassId(Number(e.target.value))}
                disabled={loadingClasses || classOptions.length === 0}
                className="teacher-input h-10 rounded-2xl px-3 text-sm"
              >
                {classOptions.length === 0 && <option value="">No classes available</option>}
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide teacher-muted mb-1">Current Week</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={MAX_WEEKS}
                  value={pendingWeek}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isNaN(value)) {
                      setPendingWeek(1);
                      return;
                    }
                    const clamped = Math.min(MAX_WEEKS, Math.max(1, value));
                    setPendingWeek(clamped);
                  }}
                  className="teacher-input h-10 w-16 rounded-2xl px-2 text-center text-sm"
                />
                <button
                  onClick={handleCurrentWeekSave}
                  disabled={savingWeek || !courseState || pendingWeek === courseState.current_week}
                  className="teacher-button-primary h-10 rounded-2xl px-4 text-sm font-semibold"
                >
                  {savingWeek ? 'Saving…' : 'Update'}
                </button>
              </div>
              <p className="text-xs teacher-muted flex items-center gap-1.5 mt-1">
                <Calendar className="h-3.5 w-3.5" />
                Students see uploads through the active week.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl teacher-alert teacher-alert--danger px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {flash && (
          <div className="rounded-2xl teacher-alert teacher-alert--success px-4 py-3 text-sm">
            {flash}
          </div>
        )}
        {hasPendingUploads && (
          <div className="rounded-2xl teacher-alert teacher-alert--warning px-4 py-3 text-sm flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Uploads are being processed. This page will update automatically.
          </div>
        )}

        <div className="rounded-3xl teacher-panel-soft p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold teacher-section-title">Retrieval Resource Weights</h2>
            <p className="text-sm teacher-muted">
              Adjust how much the AI prioritises each resource type. Higher values push that material to the top.
            </p>
          </div>
          {loadingWeights && (
            <div className="rounded-2xl teacher-panel-subtle px-4 py-4 text-sm teacher-muted">Loading weights…</div>
          )}
          {!loadingWeights && weights && (
            <>
              <div className="space-y-3">
                {(Object.keys(RESOURCE_WEIGHT_LABELS) as WeightKind[]).map((kind) => {
                  const label = RESOURCE_WEIGHT_LABELS[kind];
                  const value = weights[kind];
                  const defaultValue = defaultWeights?.[kind];
                  return (
                    <div key={kind} className="rounded-2xl teacher-panel-subtle p-4 space-y-3">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm font-semibold teacher-section-title">{label}</div>
                        <div className="text-xs teacher-muted">
                          Current <span className="teacher-value">{value.toFixed(2)}</span>
                          {typeof defaultValue === 'number' && (
                            <span className="ml-3 teacher-muted">Default {defaultValue.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={weightBounds?.min ?? 0}
                        max={weightBounds?.max ?? 1}
                        step={0.01}
                        value={value}
                        onChange={(event) => handleWeightChange(kind, Number(event.target.value))}
                        className="w-full teacher-range"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSaveWeights}
                  disabled={!weightsDirty || savingWeights}
                  className="teacher-button-primary h-11 rounded-2xl px-4 text-sm font-semibold"
                >
                  {savingWeights ? 'Saving…' : weightsDirty ? 'Save weights' : 'Saved'}
                </button>
                <button
                  type="button"
                  onClick={handleResetWeights}
                  disabled={!canResetToDefaults || savingWeights}
                  className="teacher-button-secondary h-11 rounded-2xl px-4 text-sm font-semibold"
                >
                  Reset to defaults
                </button>
              </div>
            </>
          )}
          {!loadingWeights && !weights && (
            <div className="rounded-2xl teacher-alert teacher-alert--danger px-4 py-4 text-sm">
              Failed to load retrieval weights. Please retry selecting the class.
            </div>
          )}
        </div>

        {loading && (
          <div className="rounded-2xl teacher-panel-soft px-4 py-6 text-sm teacher-muted">
            Loading weekly timeline…
          </div>
        )}

        <div className="space-y-4">
          {weeks.map((week) => (
            <motion.div
              key={week.week}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-3xl teacher-panel-soft p-5"
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold teacher-section-title">Week {week.week}</div>
                {courseState?.current_week === week.week && (
                  <span className="rounded-full teacher-pill teacher-pill--success px-3 py-1 text-xs">Active week</span>
                )}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(Object.keys(WEEK_KINDS) as WeekKind[]).map((kind) => {
                  const section = kind === 'notes' ? week.notes : week.slides;
                  const latest = section.latest;
                  const uploading = uploadingKey === `${week.week}-${kind}`;
                  const pendingAttempt =
                    section.history.find((entry) => entry.id !== latest?.id && isPendingStatus(entry.status)) ?? null;
                  const failedAttempt =
                    section.history.find((entry) => entry.id !== latest?.id && entry.status === 'failed') ??
                    (!latest ? section.history.find((entry) => entry.status === 'failed') ?? null : null);
                  return (
                    <div key={kind} className="rounded-2xl teacher-panel-subtle p-4 flex flex-col gap-3">
                      {latest && (
                        <div className="text-sm teacher-muted">
                          {latest.source_name || latest.title} · {latest.page_count ? `${latest.page_count} pages` : 'Processing'}
                        </div>
                      )}
                      {pendingAttempt && (
                        <div className="rounded-2xl teacher-alert teacher-alert--warning px-3 py-2 text-sm flex items-center gap-2">
                          <RefreshCcw className="h-4 w-4 animate-spin" />
                          {latest ? 'New version processing…' : 'Processing…'}
                        </div>
                      )}
                      {failedAttempt && !pendingAttempt && (
                        <div className="rounded-2xl teacher-alert teacher-alert--danger px-3 py-2 text-sm flex items-center justify-between gap-2">
                          <span>{latest ? 'Replacement failed' : 'Upload failed'}{failedAttempt.error_message ? ` — ${failedAttempt.error_message}` : ''}</span>
                          <button
                            type="button"
                            onClick={() => void handleRetryUpload(failedAttempt)}
                            disabled={retryingUploadId === failedAttempt.id}
                            className="teacher-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold"
                          >
                            {retryingUploadId === failedAttempt.id ? 'Retrying…' : 'Retry'}
                          </button>
                        </div>
                      )}
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl teacher-button-secondary px-3 py-2 text-sm font-semibold self-start">
                        <UploadCloud className="h-4 w-4" />
                        {uploading ? 'Uploading…' : `Upload Week ${week.week} ${kind === 'notes' ? 'Notes' : 'Slides'}`}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            handleUpload(file, week.week, kind);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
