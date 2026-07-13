"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Lightbulb,
  ListChecks,
  SlidersHorizontal,
  Link2,
  FileText,
  Menu,
  Calendar,
  Sun,
  Moon,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import {
  SUPABASE_AUTH_ENABLED,
  clearStoredSession,
  ensureActiveSession,
  ensureFreshStoredSession,
  loadStoredSession,
  saveStoredSession,
  signInWithPassword,
  signUpWithPassword,
  type StoredSession,
} from './lib/auth';
import {
  WEEK_KINDS,
  RESOURCE_WEIGHT_LABELS,
  POLL_INTERVAL_MS,
  isPendingStatus,
  type WeekKind,
  type WeightKind,
  type ClassOption,
  type UploadSummary,
  type CourseState,
  type RetrievalWeights,
  type RetrievalWeightResponse,
  type InviteLink,
} from './lib/teacher';
import AuthoredSetsPanel from './components/AuthoredSetsPanel';
import ConceptsPanel from './components/ConceptsPanel';
import GeneratedProblemsPanel from './components/GeneratedProblemsPanel';
import { APOLLO_ONLY } from './lib/flags';
import TeacherSidebar, { type SectionKey } from './components/TeacherSidebar';
import MaterialsSection from './components/MaterialsSection';
import AiTuningSection from './components/AiTuningSection';
import InvitesSection from './components/InvitesSection';
import ReportsSection from './components/ReportsSection';

// Apollo-only deployments hide the Hoot-specific sections: AI Tuning
// (retrieval weights) and Reports (AI-use reports on Hoot chats) — the
// student deployment has Hoot Q&A off. Everything else feeds Apollo.
const HOOT_ONLY_SECTIONS: SectionKey[] = ['ai-tuning', 'reports'];

const ALL_SECTIONS: { key: SectionKey; label: string; icon: typeof BookOpen }[] = [
  { key: 'materials', label: 'Materials', icon: BookOpen },
  { key: 'concepts', label: 'Concepts', icon: Lightbulb },
  { key: 'problem-sets', label: 'Problem Sets', icon: ListChecks },
  { key: 'generated-problems', label: 'Generated Problems', icon: Sparkles },
  { key: 'ai-tuning', label: 'AI Tuning', icon: SlidersHorizontal },
  { key: 'invites', label: 'Invites', icon: Link2 },
  { key: 'reports', label: 'Reports', icon: FileText },
];

const SECTIONS = ALL_SECTIONS.filter(
  (s) => !APOLLO_ONLY || !HOOT_ONLY_SECTIONS.includes(s.key),
);

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
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
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
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [loadingInvites, setLoadingInvites] = useState<boolean>(false);
  const [generatingInvite, setGeneratingInvite] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('materials');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    document.documentElement.classList.add('theme-transition');
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 450);
  };
  const accessToken = session?.access_token || '';
  const userLabel = session?.user_email || session?.user_id || 'Signed in';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!SUPABASE_AUTH_ENABLED) {
        console.error('Auth is not configured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.');
        if (!cancelled) {
          setAuthError("Hoot isn't fully set up yet. Please contact your administrator.");
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

  // Proactive token refresh: Supabase tokens expire after ~1h and the panels
  // hold the token via the accessToken prop, so a console tab left open would
  // start 401ing ("Invalid bearer token"). Refresh the stored session on a
  // 4-min tick (auth.ts buffers 7 min) + on tab-visible (wake-from-sleep,
  // where timers didn't fire), and adopt the rotated token into React state.
  useEffect(() => {
    if (!authReady || !session) return;
    const sync = async () => {
      const fresh = await ensureFreshStoredSession();
      if (fresh && fresh.access_token !== session.access_token) {
        setSession(fresh);
      }
    };
    const timer = setInterval(() => void sync(), 240_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authReady, session]);

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
      const resp = await fetch('/api/my-classes', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to load classes');
      }
      const data = (await resp.json()) as ClassOption[];
      setClassOptions(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedClassId((previous) => {
          if (previous && data.some((option) => option.id === previous)) {
            return previous;
          }
          return data[0].id;
        });
      } else {
        setSelectedClassId(null);
        setShowCreateClass(true);
      }
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
        let msg = 'Failed to load weekly uploads';
        try { const j = JSON.parse(text); if (j.detail) msg = j.detail; } catch { if (text) msg = text; }
        throw new Error(msg);
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
        let msg = 'Failed to load retrieval weights';
        try { const j = JSON.parse(text); if (j.detail) msg = j.detail; } catch { if (text) msg = text; }
        throw new Error(msg);
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

  const fetchInviteLinks = useCallback(async (searchSpaceId: number, silent = false) => {
    if (!accessToken || !Number.isFinite(searchSpaceId) || searchSpaceId <= 0) return;
    if (!silent) setLoadingInvites(true);
    try {
      const resp = await fetch(`/api/invite-links?search_space_id=${searchSpaceId}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to load invite links');
      }
      const data = (await resp.json()) as InviteLink[];
      setInviteLinks(Array.isArray(data) ? data : []);
    } catch {
      setInviteLinks([]);
    } finally {
      setLoadingInvites(false);
    }
  }, [accessToken]);

  const handleGenerateInvite = async (role: 'student' | 'teacher') => {
    if (!accessToken || !selectedClassId) return;
    setGeneratingInvite(role);
    setError(null);
    try {
      const resp = await fetch('/api/invite-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ search_space_id: selectedClassId, role }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to generate invite link');
      }
      await fetchInviteLinks(selectedClassId, true);
      setFlash(`${role === 'student' ? 'Student' : 'Teacher'} invite link generated.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate invite link';
      setError(msg);
    } finally {
      setGeneratingInvite(null);
    }
  };

  const handleRevokeInvite = async (linkId: number) => {
    if (!accessToken) return;
    setError(null);
    try {
      const resp = await fetch(`/api/invite-links/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.status !== 204 && !resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to revoke invite link');
      }
      if (selectedClassId) await fetchInviteLinks(selectedClassId, true);
      setFlash('Invite link revoked.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke invite link';
      setError(msg);
    }
  };

  const studentAppUrl = process.env.NEXT_PUBLIC_STUDENT_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  const getInviteUrl = (code: string, role: 'student' | 'teacher') => {
    const baseUrl = role === 'student' ? studentAppUrl : (typeof window !== 'undefined' ? window.location.origin : '');
    return `${baseUrl}/join/${code}`;
  };

  const handleCopyInvite = async (code: string, role: 'student' | 'teacher') => {
    const url = getInviteUrl(code, role);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const handleCreateClass = async () => {
    const name = newClassName.trim();
    if (!name || !accessToken) return;
    setCreatingClass(true);
    setError(null);
    try {
      const resp = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to create class');
      }
      const created = (await resp.json()) as ClassOption;
      setClassOptions((prev) => [...prev, created]);
      setSelectedClassId(created.id);
      setShowCreateClass(false);
      setNewClassName('');
      setFlash(`Class "${created.name}" created.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create class';
      setError(msg);
    } finally {
      setCreatingClass(false);
    }
  };

  useEffect(() => {
    if (!authReady || !accessToken || !selectedClassId) {
      setInviteLinks([]);
      return;
    }
    void fetchInviteLinks(selectedClassId);
  }, [authReady, accessToken, selectedClassId, fetchInviteLinks]);

  const activeStudentLink = useMemo(
    () => inviteLinks.find((l) => l.role === 'student' && l.is_active) ?? null,
    [inviteLinks],
  );
  const activeTeacherLink = useMemo(
    () => inviteLinks.find((l) => l.role === 'teacher' && l.is_active) ?? null,
    [inviteLinks],
  );

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

  const handleUploadTextbook = async (file: File | null) => {
    if (!accessToken) {
      setError('Sign in is required.');
      return;
    }
    if (!file || !selectedClassId) return;
    setUploadingKey('textbook');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('search_space_id', String(selectedClassId));
      // Course-wide material: week is ignored by the backend (forced to the
      // course-wide sentinel), but the field is required by the endpoint.
      formData.append('week', '0');
      formData.append('kind', 'textbook');
      formData.append('title', file.name.replace(/\.pdf$/i, '').trim() || 'Textbook');
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
      setFlash('Textbook queued for processing.');
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
      if (upload.kind === 'textbook') {
        setFlash('Textbook re-queued.');
      } else {
        setFlash(`${WEEK_KINDS[upload.kind]} for week ${upload.week} re-queued.`);
      }
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
      <div className="auth-screen">
        <div className="boot-screen">
          <video src="/thinking.mp4" autoPlay loop muted playsInline className="boot-screen__owl" aria-hidden />
          <div className="boot-screen__wordmark">Hoot</div>
          <div className="boot-screen__bar" />
        </div>
      </div>
    );
  }

  if (!SUPABASE_AUTH_ENABLED) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <video src="/thinking.mp4" autoPlay loop muted playsInline className="auth-brand__owl" aria-hidden />
            <div className="auth-brand__wordmark">Hoot</div>
            <div className="auth-brand__subtitle">Teacher Console</div>
          </div>
          <div className="teacher-alert teacher-alert--danger px-3 py-2 text-sm">
            Hoot isn&apos;t fully set up yet. Please contact your administrator.
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <form onSubmit={handleSignIn} className="auth-card">
          <div className="auth-brand">
            <video src="/thinking.mp4" autoPlay loop muted playsInline className="auth-brand__owl" aria-hidden />
            <div className="auth-brand__wordmark">Hoot</div>
            <div className="auth-brand__subtitle">Teacher Console</div>
          </div>
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

  return (
    <div className="teacher-layout teacher-shell">
      <TeacherSidebar
        sections={SECTIONS}
        active={activeSection}
        onSelect={(key) => {
          setActiveSection(key);
          setSidebarOpen(false);
        }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="teacher-main">
        <header className="teacher-topbar">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="header-menu-trigger lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Class context */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              {showCreateClass ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Class name (e.g. Fluid Mechanics)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateClass(); }}
                    className="teacher-input h-9 rounded-2xl px-3 text-sm flex-1 min-w-0"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateClass()}
                    disabled={creatingClass || !newClassName.trim()}
                    className="teacher-button-primary rounded-2xl px-3 h-9 text-sm font-semibold whitespace-nowrap"
                  >
                    {creatingClass ? 'Creating…' : 'Create'}
                  </button>
                  {classOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCreateClass(false)}
                      className="teacher-button-secondary rounded-2xl px-3 h-9 text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <select
                    value={selectedClassId ?? ''}
                    onChange={(e) => setSelectedClassId(Number(e.target.value))}
                    disabled={loadingClasses || classOptions.length === 0}
                    className="teacher-input h-9 rounded-2xl px-3 text-sm min-w-0 flex-1 max-w-[16rem]"
                    aria-label="Active class"
                  >
                    {classOptions.length === 0 && <option value="">No classes yet</option>}
                    {classOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCreateClass(true)}
                    className="teacher-button-secondary rounded-2xl px-3 h-9 text-sm font-semibold whitespace-nowrap"
                  >
                    + New
                  </button>
                </>
              )}
            </div>

            {/* Active-week indicator */}
            {courseState && !showCreateClass && (
              <span className="teacher-week-pill hidden sm:inline-flex">
                <Calendar className="h-3.5 w-3.5" />
                Week {courseState.current_week}
              </span>
            )}

            {/* User menu */}
            <div ref={headerMenuRef} className="relative">
              <button
                onClick={() => setHeaderMenuOpen((prev) => !prev)}
                className="header-menu-trigger"
                type="button"
                aria-label="Account menu"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {headerMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="header-menu"
                  >
                    <button onClick={toggleTheme} className="header-menu-item" type="button">
                      {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                      {darkMode ? 'Light mode' : 'Dark mode'}
                    </button>
                    <button
                      onClick={() => { handleSignOut(); setHeaderMenuOpen(false); }}
                      className="header-menu-item"
                      type="button"
                    >
                      Sign out of {userLabel}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8">
          {(error || flash) && (
            <div className="space-y-2 mb-5">
              {error && (
                <div className="rounded-2xl teacher-alert teacher-alert--danger px-4 py-3 text-sm">{error}</div>
              )}
              {flash && (
                <div className="rounded-2xl teacher-alert teacher-alert--success px-4 py-3 text-sm">{flash}</div>
              )}
            </div>
          )}

          {!selectedClassId ? (
            <div className="rounded-3xl teacher-panel p-8 text-center space-y-3">
              <h1 className="text-xl font-semibold teacher-section-title">No class yet</h1>
              <p className="text-sm teacher-muted">
                Create your first class to start uploading materials and inviting students.
              </p>
              {!showCreateClass && (
                <button
                  type="button"
                  onClick={() => setShowCreateClass(true)}
                  className="teacher-button-primary rounded-2xl px-4 h-10 text-sm font-semibold"
                >
                  + New Class
                </button>
              )}
            </div>
          ) : (
            <>
              {activeSection === 'materials' && (
                <MaterialsSection
                  courseState={courseState}
                  loading={loading}
                  pendingWeek={pendingWeek}
                  onPendingWeekChange={setPendingWeek}
                  savingWeek={savingWeek}
                  onSaveCurrentWeek={handleCurrentWeekSave}
                  hasPendingUploads={hasPendingUploads}
                  uploadingKey={uploadingKey}
                  retryingUploadId={retryingUploadId}
                  onUpload={handleUpload}
                  onUploadTextbook={handleUploadTextbook}
                  onRetry={handleRetryUpload}
                />
              )}

              {activeSection === 'concepts' && (
                <div className="space-y-6">
                  <header className="space-y-1">
                    <h1 className="text-2xl font-semibold teacher-section-title">Concepts</h1>
                    <p className="text-sm teacher-muted">
                      Write the concepts students will teach back. Problem sets you upload are
                      matched against this list.
                    </p>
                  </header>
                  <ConceptsPanel
                    searchSpaceId={selectedClassId}
                    accessToken={accessToken}
                    onGoToGenerated={() => {
                      setFlash('Generation started');
                      setActiveSection('generated-problems');
                    }}
                  />
                </div>
              )}

              {activeSection === 'problem-sets' && (
                <div className="space-y-6">
                  <header className="space-y-1">
                    <h1 className="text-2xl font-semibold teacher-section-title">Problem sets</h1>
                    <p className="text-sm teacher-muted">
                      Upload paired problem and solution PDFs. Hoot extracts and validates each problem for you.
                    </p>
                  </header>
                  <AuthoredSetsPanel
                    searchSpaceId={selectedClassId}
                    accessToken={accessToken}
                    onGoToConcepts={() => setActiveSection('concepts')}
                  />
                </div>
              )}

              {activeSection === 'generated-problems' && (
                <div className="space-y-6">
                  <header className="space-y-1">
                    <h1 className="text-2xl font-semibold teacher-section-title">
                      Generated problems
                    </h1>
                    <p className="text-sm teacher-muted">
                      Inspect AI-generated variants and approve their reference solutions before
                      students can teach them back.
                    </p>
                  </header>
                  <GeneratedProblemsPanel
                    searchSpaceId={selectedClassId}
                    accessToken={accessToken}
                    onGoToConcepts={() => setActiveSection('concepts')}
                  />
                </div>
              )}

              {activeSection === 'ai-tuning' && (
                <AiTuningSection
                  weights={weights}
                  defaultWeights={defaultWeights}
                  weightBounds={weightBounds}
                  loadingWeights={loadingWeights}
                  savingWeights={savingWeights}
                  weightsDirty={weightsDirty}
                  canResetToDefaults={canResetToDefaults}
                  onWeightChange={handleWeightChange}
                  onSave={handleSaveWeights}
                  onReset={handleResetWeights}
                />
              )}

              {activeSection === 'invites' && (
                <InvitesSection
                  loadingInvites={loadingInvites}
                  activeStudentLink={activeStudentLink}
                  activeTeacherLink={activeTeacherLink}
                  generatingInvite={generatingInvite}
                  copiedCode={copiedCode}
                  getInviteUrl={getInviteUrl}
                  onGenerate={handleGenerateInvite}
                  onCopy={handleCopyInvite}
                  onRevoke={handleRevokeInvite}
                />
              )}

              {activeSection === 'reports' && <ReportsSection />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
