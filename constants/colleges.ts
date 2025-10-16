export const COLLEGES = [
  'Indiana University',
  'Stanford University',
  'Louisiana State University',
  'Penn State',
  'None of the Above'
] as const;

export type College = typeof COLLEGES[number]; 