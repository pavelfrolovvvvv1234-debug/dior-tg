/**
 * Жёстко заданные русские тексты для приветствия и профиля.
 * Не используют Fluent/сессию — язык не может переключиться на EN.
 *
 * @module shared/ru-texts
 */

/** Русское приветствие (всегда). */
export function getWelcomeTextRu(balance: number): string {
  const b = Number.isFinite(balance) ? Math.round(balance) : 0;
  return `DiorHost • Абузоустойчивая Инфраструктура

Покупка и управление услугами хостинга прямо в тг боте
24/7 работа • Абузоустойчивость • Офшорность
@diorhost

<blockquote>Баланс: ${b} $</blockquote>`;
}

const PROFILE_STATUS_RU: Record<string, string> = {
  newbie: "🆕 Новичок",
  user: "👤 Пользователь",
  admin: "👑 Админ",
};

const PROFILE_LINKS_RU =
  '<a href="https://dior.host">Сайт</a> | <a href="https://t.me/diorhost">Поддержка</a> | <a href="https://t.me/+C27tBPXXpj40ZGE6">Новости Dior</a>';

export interface ProfileTextRuParams {
  userId: number;
  statusKey: string;
  balanceStr: string;
  primeLine: string;
}

/** Профиль по-русски. Символы │ ├ └ — рамка, отображаются в Telegram. */
export function getProfileTextRu(params: ProfileTextRuParams): string {
  const { userId, statusKey, balanceStr, primeLine } = params;
  const idSafe = String(userId).split("").join("&#8203;");
  const userStatus = PROFILE_STATUS_RU[statusKey] ?? "👤 Пользователь";
  return `<b>├💻 DIOR ПРОФИЛЬ</b>
│
└<b>✅ СТАТИСТИКА</b>
    ├ ID: ${idSafe}
    ├ Статус: ${userStatus}
    ├ ${primeLine}
    └ Баланс: ${balanceStr} $

${PROFILE_LINKS_RU}`;
}
