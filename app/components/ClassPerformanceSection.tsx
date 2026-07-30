"use client";

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import ActivityByDay from './performance/ActivityByDay';
import EngagementInsights from './performance/EngagementInsights';
import GradeDistribution from './performance/GradeDistribution';
import ProblemsByConcept from './performance/ProblemsByConcept';
import RubricLossBars from './performance/RubricLossBars';
import StatTiles from './performance/StatTiles';
import StudentTable from './performance/StudentTable';
import { notStartedCount } from './performance/utils';
import type { PerformancePayload } from './performance/types';

// Payload contract: GET /apollo/teacher/classroom/{search_space_id}/performance
// (apollo/projections/performance.py + performance_insights.py). Grades are
// best-attempt-wins per (student, problem) and carry the SERVED letter —
// teacher and student always see the same grade. Full type mirror lives in
// performance/types.ts; this file is fetch/poll/error/layout only — every
// rendered block is a component under performance/.
const POLL_INTERVAL_MS = 60_000;

export default function ClassPerformanceSection({
  searchSpaceId,
  accessToken,
}: {
  searchSpaceId: number | null;
  accessToken: string | null;
}) {
  const [data, setData] = useState<PerformancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchPerformance = useCallback(
    async (background = false) => {
      if (!accessToken || !searchSpaceId) return;
      if (!background) setLoading(true);
      try {
        const resp = await fetch(`/api/teacher/classroom/${searchSpaceId}/performance`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!resp.ok) {
          let detail = `Request failed (${resp.status})`;
          try {
            const body = await resp.json();
            if (body?.detail) detail = String(body.detail);
          } catch {
            /* non-JSON error body — keep the status message */
          }
          throw new Error(detail);
        }
        setData((await resp.json()) as PerformancePayload);
        setUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load class performance');
      } finally {
        if (!background) setLoading(false);
      }
    },
    [accessToken, searchSpaceId],
  );

  useEffect(() => {
    setData(null);
    setError(null);
    void fetchPerformance();
    const timer = setInterval(() => void fetchPerformance(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchPerformance]);

  const notStarted = data ? notStartedCount(data.roster, data.totals) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold teacher-section-title">Class performance</h1>
          <p className="text-sm teacher-muted">
            Apollo teaching grades, best attempt per student per problem — the same grade students
            see. Refreshes automatically every minute.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-xs teacher-muted">
              Updated {updatedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void fetchPerformance()}
            disabled={loading}
            className="teacher-button-secondary h-9 rounded-2xl px-3 text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && <div className="teacher-alert teacher-alert--danger rounded-2xl p-3 text-sm">{error}</div>}

      {!data && loading && <p className="text-sm teacher-muted">Loading class performance…</p>}

      {data && (
        <>
          <StatTiles roster={data.roster} totals={data.totals} classAverage={data.class_average} />

          <div className="grid gap-3 lg:grid-cols-2">
            <GradeDistribution buckets={data.grade_distribution} />
            <ActivityByDay days={data.activity_by_day} />
          </div>

          <ProblemsByConcept problems={data.problems} />

          {/* Both full-width: RubricLossBars is a compact 3-bar strip and
              EngagementInsights is the taller flagship card with its own
              internal grid — pairing them in a 2-col row forced the short
              card to match the tall one's height (see dataviz row-balance
              review). */}
          <RubricLossBars averages={data.rubric_averages} />
          <EngagementInsights insights={data.insights} />

          <StudentTable students={data.students} notStarted={notStarted} />
        </>
      )}
    </div>
  );
}
