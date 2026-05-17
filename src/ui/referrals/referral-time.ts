export function formatRelativeTime(date: Date, locale: string, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const ru = locale === "en" ? false : true;

  if (diffMin < 1) return ru ? "только что" : "just now";
  if (diffMin < 60) return ru ? `${diffMin} мин назад` : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return ru ? `${diffH} ч назад` : `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return ru ? `${diffD} дн назад` : `${diffD}d ago`;
  return date.toLocaleDateString(ru ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatShortDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function miniBar(amount: number, max: number, width = 8): string {
  if (max <= 0) return "░".repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round((amount / max) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}
