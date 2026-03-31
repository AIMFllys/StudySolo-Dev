export interface RatingOverview {
  total_count: number;
  avg_rating: number | null;
  rating_distribution: Record<number, number>;
  reward_applied_count: number;
}

export interface RatingItem {
  id: string;
  user_id: string;
  email: string | null;
  nickname: string | null;
  rating: number;
  issue_type: string;
  content: string;
  reward_days: number;
  reward_applied: boolean;
  created_at: string;
}

export interface PaginatedRatingList {
  ratings: RatingItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type RatingScoreFilter = 1 | 2 | 3 | 4 | 5 | '';
