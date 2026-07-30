import { bandForScore, CHART_COLOR_VAR, formatScore, formatSigned, MIN_CORRELATION_N } from './utils';
import type { Insights } from './types';

const CHART_W = 480;
const CHART_H = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 28;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

function CorrelationScatter({ correlation }: { correlation: Insights['correlation'] }) {
  if (!correlation) {
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-semibold teacher-value">Effort vs. grade</h3>
        <p className="text-sm teacher-muted">
          Not enough data yet — shown once at least {MIN_CORRELATION_N} students have graded attempts.
        </p>
      </div>
    );
  }

  const maxTurns = Math.max(1, ...correlation.points.map((p) => p.turns));
  const xScale = (turns: number) => PAD_LEFT + (turns / maxTurns) * PLOT_W;
  const yScale = (score: number) => PAD_TOP + PLOT_H - (Math.max(0, Math.min(100, score)) / 100) * PLOT_H;

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold teacher-value">Effort vs. grade</h3>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Scatter plot of teaching turns versus average grade per student"
        className="w-full h-auto"
      >
        {/* axes */}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={PAD_TOP + PLOT_H}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP + PLOT_H}
          x2={PAD_LEFT + PLOT_W}
          y2={PAD_TOP + PLOT_H}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {[0, 50, 100].map((tick) => (
          <text key={tick} x={PAD_LEFT - 6} y={yScale(tick) + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
            {tick}
          </text>
        ))}
        <text x={PAD_LEFT} y={CHART_H - 4} textAnchor="start" fontSize={9} fill="var(--muted)">
          0 turns
        </text>
        <text x={PAD_LEFT + PLOT_W} y={CHART_H - 4} textAnchor="end" fontSize={9} fill="var(--muted)">
          {maxTurns} turns
        </text>
        {correlation.points.map((p, i) => (
          <circle
            key={`${p.email ?? 'anon'}-${i}`}
            cx={xScale(p.turns)}
            cy={yScale(p.avg_best)}
            r={5}
            fill={CHART_COLOR_VAR[bandForScore(p.avg_best)]}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            <title>{`${p.email ?? 'Student'} — ${p.turns} teaching turns, avg grade ${Math.round(p.avg_best)}`}</title>
          </circle>
        ))}
      </svg>
      <p className="text-xs teacher-muted">
        Pearson r = {correlation.pearson_r.toFixed(2)} · Spearman ρ = {correlation.spearman_rho.toFixed(2)} · n ={' '}
        {correlation.n} students
      </p>
    </div>
  );
}

function EffortQuartiles({ quartiles }: { quartiles: Insights['effort_quartiles'] }) {
  if (!quartiles) {
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-semibold teacher-value">Effort quartiles</h3>
        <p className="text-sm teacher-muted">
          Not enough data yet — shown once at least {MIN_CORRELATION_N} students have graded attempts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold teacher-value">Grade by teaching-turns quartile</h3>
      <div className="flex items-end gap-3 h-28 border-b" style={{ borderColor: 'var(--border)' }}>
        {quartiles.map((q) => (
          <div key={q.quartile} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <span className="text-[11px] teacher-muted">{Math.round(q.avg_grade)}</span>
            <div
              className="w-3/4 max-w-10 rounded-t"
              style={{ background: CHART_COLOR_VAR[bandForScore(q.avg_grade)], height: `${(q.avg_grade / 100) * 88}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {quartiles.map((q) => (
          <span key={q.quartile} className="flex-1 text-center text-[11px] teacher-muted">
            {q.label} · {q.students}
          </span>
        ))}
      </div>
    </div>
  );
}

function RetryPayoffStrip({ payoff }: { payoff: Insights['retry_payoff'] }) {
  if (!payoff) {
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-semibold teacher-value">Retry payoff</h3>
        <p className="text-sm teacher-muted">No repeated attempts yet.</p>
      </div>
    );
  }

  const gainBand = payoff.avg_gain > 0 ? 'green' : payoff.avg_gain < 0 ? 'red' : 'blue';

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold teacher-value">Retry payoff</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs teacher-muted">Students retried</p>
          <p className="text-lg font-semibold teacher-value">{payoff.students_retried}</p>
        </div>
        <div>
          <p className="text-xs teacher-muted">Avg first attempt</p>
          <p className="text-lg font-semibold teacher-value">{formatScore(payoff.avg_first)}</p>
        </div>
        <div>
          <p className="text-xs teacher-muted">Avg best attempt</p>
          <p className="text-lg font-semibold teacher-value">{formatScore(payoff.avg_best)}</p>
        </div>
        <div>
          <p className="text-xs teacher-muted">Avg gain</p>
          <p className="text-lg font-semibold" style={{ color: CHART_COLOR_VAR[gainBand] }}>
            {formatSigned(payoff.avg_gain)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EngagementInsights({ insights }: { insights: Insights }) {
  return (
    <div className="rounded-3xl teacher-panel-soft p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold teacher-section-title">Engagement insights</h2>
        <p className="text-xs teacher-muted">
          Algorithmic signals from teaching activity — no LLM or knowledge-graph calls.
        </p>
      </div>
      <CorrelationScatter correlation={insights.correlation} />
      <EffortQuartiles quartiles={insights.effort_quartiles} />
      <RetryPayoffStrip payoff={insights.retry_payoff} />
    </div>
  );
}
