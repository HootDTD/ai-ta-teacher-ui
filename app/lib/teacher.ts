// Shared teacher-console types and constants.
// Lives in lib/ so both the page orchestrator and the section components can
// import from a single source without creating a page <-> component cycle.

export const WEEK_KINDS = {
  notes: 'Course Notes',
  slides: 'Course Slides',
} as const;

export const RESOURCE_WEIGHT_LABELS = {
  textbook: 'Textbook',
  slides: 'Slides',
  notes: 'Notes',
} as const;

export type WeekKind = keyof typeof WEEK_KINDS;
export type WeightKind = keyof typeof RESOURCE_WEIGHT_LABELS;
export type UploadStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'superseded';

export type ClassOption = {
  id: number;
  slug: string;
  name: string;
  subject_name: string;
};

export type UploadSummary = {
  id: string;
  week: number;
  kind: WeekKind | 'textbook';
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

export type SectionState = {
  latest: UploadSummary | null;
  history: UploadSummary[];
};

export type WeekState = {
  week: number;
  notes: SectionState;
  slides: SectionState;
};

export type CourseState = {
  search_space_id: number;
  course: string;
  slug: string;
  current_week: number;
  weeks: WeekState[];
  // Course-wide textbook (not pinned to a week). Always present from the API.
  textbook: SectionState;
};

export type RetrievalWeights = Record<WeightKind, number>;

export type RetrievalWeightResponse = {
  search_space_id: number;
  course: string;
  weights: RetrievalWeights;
  defaults: RetrievalWeights;
  bounds: {
    min: number;
    max: number;
  };
};

export type InviteLink = {
  id: number;
  code: string;
  search_space_id: number;
  role: 'student' | 'teacher';
  is_active: boolean;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
};

export const MAX_WEEKS = 16;
export const POLL_INTERVAL_MS = 4000;

export const isPendingStatus = (status?: string): status is 'queued' | 'processing' => {
  return status === 'queued' || status === 'processing';
};
