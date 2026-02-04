import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a unique ID (cuid-like format).
 * Uses crypto.randomUUID() and formats it to be more compact.
 */
export function createId(): string {
  // Use crypto.randomUUID() which is available in Node.js 19+ and all modern browsers
  const uuid = crypto.randomUUID();
  // Remove dashes and take first 25 chars for a cuid-like format
  return uuid.replace(/-/g, "").slice(0, 25);
}

/**
 * Removes specified keys from an object or an array of objects.
 * 
 * @param data The object or array of objects to strip keys from.
 * @param keys An array of keys to remove.
 * @returns A new object or array of objects with the keys removed.
 */
export function removeKeys<T extends Record<string, any>>(
  data: T | T[],
  keys: string[]
): any {
  if (Array.isArray(data)) {
    return data.map((item) => removeKeys(item, keys));
  }

  const result = { ...data };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
}

/**
 * Retains only the specified "safe" keys from an object or an array of objects.
 * 
 * @param data The object or array of objects to strip.
 * @param safeKeys An array of keys to keep.
 * @returns A new object or array of objects with only the safe keys.
 */
export function retainSafeKeys<T extends Record<string, any>>(
  data: T | T[],
  safeKeys: string[]
): any {
  if (Array.isArray(data)) {
    return data.map((item) => retainSafeKeys(item, safeKeys));
  }

  const result: Record<string, any> = {};
  safeKeys.forEach((key) => {
    if (key in data) {
      result[key] = data[key];
    }
  });
  return result;
}
