import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDataAmount(amount: string): number {
  if (!amount) return 0;
  // Match number and unit (MB, GB, TB)
  const match = amount.match(/^(\d+(?:\.\d+)?)\s*(MB|GB|TB)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'MB').toUpperCase();

  switch (unit) {
    case 'TB': return value * 1024 * 1024;
    case 'GB': return value * 1024;
    case 'MB': return value;
    default: return value;
  }
}
