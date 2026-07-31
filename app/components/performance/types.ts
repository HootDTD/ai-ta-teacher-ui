// v2 payload contract: GET /apollo/teacher/classroom/{search_space_id}/performance
// (apollo/projections/performance.py + performance_insights.py). Grades are
// best-attempt-wins per (student, problem) and carry the SERVED letter —
// teacher and student always see the same grade.

export type BestGrade = { problem_id: number; score: number; letter: string };

export type AttentionFlag = 'not_started' | 'low_effort' | 'gave_up' | 'grinding';

export type StudentEngagement = {
  teaching_turns: number;
  median_words: number | null;
  problems_retried: number;
  avg_gain: number | null;
};

export type StudentRow = {
  user_id: string;
  email: string | null;
  // Present in the contract but intentionally unused for display — the
  // student label is `email ?? "Student " + id8` (see utils.ts studentLabel).
  full_name: string | null;
  attempts: number;
  graded: number;
  problems_tried: number;
  best_grades: BestGrade[];
  avg_best: number | null;
  letter: string | null;
  last_active: string | null;
  engagement: StudentEngagement;
  flags: AttentionFlag[];
};

export type DistributionBucket = { letter: string; count: number };

export type ProblemRow = {
  problem_id: number;
  problem_code: string;
  concept_id: number;
  concept_name: string;
  students_graded: number;
  avg_best: number | null;
  distribution: DistributionBucket[];
};

export type CorrelationPoint = { turns: number; avg_best: number; email: string | null };

export type Correlation = {
  n: number;
  pearson_r: number;
  spearman_rho: number;
  points: CorrelationPoint[];
} | null;

export type EffortQuartile = { quartile: number; label: string; students: number; avg_grade: number };

export type RetryPayoff = {
  students_retried: number;
  avg_first: number;
  avg_best: number;
  avg_gain: number;
} | null;

export type Insights = {
  correlation: Correlation;
  effort_quartiles: EffortQuartile[] | null;
  retry_payoff: RetryPayoff;
};

export type PerformancePayload = {
  roster: { students: number; teachers: number };
  totals: { attempts: number; graded: number; active_students: number; signed_in_only: number };
  class_average: { score: number | null; letter: string | null; students_graded: number };
  grade_distribution: DistributionBucket[];
  activity_by_day: { day: string; graded: number; in_progress: number }[];
  // misconception_corrected REMOVED vs v1.
  rubric_averages: {
    procedure: number | null;
    justification: number | null;
    simplification: number | null;
  };
  concepts: {
    concept_id: number;
    display_name: string;
    attempts: number;
    graded: number;
    problems_graded: number;
    avg_best: number | null;
  }[];
  problems: ProblemRow[];
  students: StudentRow[];
  insights: Insights;
};
