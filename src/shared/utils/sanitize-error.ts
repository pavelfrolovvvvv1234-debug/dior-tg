/**
 * Strip internal error details before showing users (SQLite, stack traces, paths).
 *
 * @module shared/utils/sanitize-error
 */

const GENERIC_BUSY =
  "⚠️ <strong>Сервис перегружен</strong>\n\nПодождите несколько секунд и повторите.";
const GENERIC =
  "⚠️ <strong>Не удалось выполнить операцию</strong>\n\nПопробуйте позже или обратитесь в поддержку.";

function isSqliteBusyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("database is locked") ||
    msg.includes("sqlite_busy") ||
    error.name === "SqliteError"
  );
}

/** Sanitize `error` field in Fluent vars before translate. */
export function patchTranslateVars(
  vars?: Record<string, string | number>
): Record<string, string | number> | undefined {
  if (!vars || vars.error === undefined) return vars;
  const raw = vars.error;
  return {
    ...vars,
    error: sanitizeErrorForUser(typeof raw === "string" ? raw : String(raw)),
  };
}

/**
 * User-safe error text for `error-unknown` and alerts (no SqliteError / paths / SQL).
 */
export function sanitizeErrorForUser(error: unknown): string {
  if (isSqliteBusyError(error)) {
    return GENERIC_BUSY;
  }

  if (error instanceof Error) {
    const msg = error.message.trim();
    if (!msg) return GENERIC;

    const lower = msg.toLowerCase();
    if (
      lower.includes("locking is not supported") ||
      lower.includes("блокировка не поддерживается") ||
      lower.includes("locknotsupported")
    ) {
      return GENERIC_BUSY;
    }
    if (
      lower.includes("sqlite") ||
      lower.includes("typeorm") ||
      lower.includes("econnrefused") ||
      lower.includes("enotfound") ||
      lower.includes("stack") ||
      /\/[a-z]:\\/i.test(msg) ||
      msg.includes(":\\")
    ) {
      return GENERIC;
    }

    if (msg.length > 180) {
      return `${msg.slice(0, 177)}…`;
    }
    return msg;
  }

  const s = String(error).trim();
  if (!s || s.length > 180) return GENERIC;
  return s;
}

/** Safe vars for ctx.t("error-unknown", …). */
export function errorUnknownVars(error: unknown): { error: string } {
  return { error: sanitizeErrorForUser(error) };
}
