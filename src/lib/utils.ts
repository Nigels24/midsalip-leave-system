// Used by shadcn/ui components to merge Tailwind class names.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Usernames are stored lowercase with no spaces (same as the prototype).
 * PostgreSQL compares text case-sensitively, so call this on every write AND every lookup,
 * e.g. login: findUnique({ where: { username: normalizeUsername(input) } }).
 */
export function normalizeUsername(username: string) {
  return username.toLowerCase().replace(/\s/g, "");
}
