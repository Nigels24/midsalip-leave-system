// Used by shadcn/ui components to merge Tailwind class names.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Ramon T. Villarosa" (same format as the prototype). */
export function fullName(e: { firstName: string; middleInitial: string | null; lastName: string }) {
  return `${e.firstName} ${e.middleInitial ? `${e.middleInitial}. ` : ""}${e.lastName}`;
}

/** "VILLAROSA, Ramon T." (Last, First Middle, as on CS Form 6 and in the prototype). */
export function formName(e: { firstName: string; middleInitial: string | null; lastName: string }) {
  return `${e.lastName.toUpperCase()}, ${e.firstName}${e.middleInitial ? ` ${e.middleInitial}.` : ""}`;
}

/**
 * Usernames are stored lowercase with no spaces (same as the prototype).
 * PostgreSQL compares text case-sensitively, so call this on every write AND every lookup,
 * e.g. login: findUnique({ where: { username: normalizeUsername(input) } }).
 */
export function normalizeUsername(username: string) {
  return username.toLowerCase().replace(/\s/g, "");
}
