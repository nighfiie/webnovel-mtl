export const REVIEW_MAX = 5000;
export const COMMENT_MAX = 2000;

export function validateReview(rating: number, body: string): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Pick a rating from 1 to 5 stars.";
  if (body.length > REVIEW_MAX) return `Reviews can be at most ${REVIEW_MAX} characters.`;
  return null;
}

export function validateComment(body: string): string | null {
  const t = body.trim();
  if (!t) return "Comment can't be empty.";
  if (t.length > COMMENT_MAX) return `Comments can be at most ${COMMENT_MAX} characters.`;
  return null;
}
