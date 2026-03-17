export const WIDTH = 320;
export const HEIGHT = 160;
export const PIECE_LENGTH = 42;
export const PIECE_RADIUS = 9;
export const PIECE_SIZE = PIECE_LENGTH + PIECE_RADIUS * 2 + 3;
export const PI = Math.PI;
export const TOLERANCE = 6;

export const BG_THEMES = [
  { colors: ['#dbeafe', '#bfdbfe', '#93c5fd'], accent: '#3b82f6' },
  { colors: ['#e0e7ff', '#c7d2fe', '#a5b4fc'], accent: '#6366f1' },
  { colors: ['#d1fae5', '#a7f3d0', '#6ee7b7'], accent: '#10b981' },
  { colors: ['#fef3c7', '#fde68a', '#fcd34d'], accent: '#f59e0b' },
  { colors: ['#fce7f3', '#fbcfe8', '#f9a8d4'], accent: '#ec4899' },
] as const;
