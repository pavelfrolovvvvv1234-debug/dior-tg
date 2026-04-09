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

const PROFILE_LINKS_RU =
  '<a href="https://dior.host">Web Site</a> | <a href="https://t.me/diorhost">Support</a> | <a href="https://t.me/+C27tBPXXpj40ZGE6">Dior News</a>';

export interface ProfileTextRuParams {
  userId: number;
  balanceStr: string;
  primeLine: string;
}

/** Профиль по-русски: ветки ├ │ └ как в английском профиле. */
export function getProfileTextRu(params: ProfileTextRuParams): string {
  const { userId, balanceStr, primeLine } = params;
  const idSafe = String(userId).split("").join("&#8203;");
  return `<b>├ 💻 DIOR ПРОФИЛЬ</b>
│
└ <b>✅ СТАТИСТИКА</b>
    ├ ID: ${idSafe}
    ├ ${primeLine}
    └ Баланс: ${balanceStr} $

${PROFILE_LINKS_RU}`;
}
