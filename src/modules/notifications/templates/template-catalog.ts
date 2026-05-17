/**
 * Premium operator-tone message templates (RU/EN).
 *
 * @module modules/notifications/templates/template-catalog
 */

import type { NotificationLocale, NotificationTemplate, RenderContext } from "../types.js";

type LocalizedBody = Record<NotificationLocale, string>;

export interface CatalogEntry extends NotificationTemplate {
  bodies: LocalizedBody;
}

const T = (
  key: string,
  category: CatalogEntry["category"],
  commercial: boolean,
  bodies: LocalizedBody,
  priority = 50,
  buttons?: CatalogEntry["buttons"]
): CatalogEntry => ({
  key,
  category,
  commercial,
  priority,
  bodies,
  buttons,
});

export const TEMPLATE_CATALOG: Record<string, CatalogEntry> = {
  "onboarding.welcome": T(
    "onboarding.welcome",
    "onboarding",
    false,
    {
      ru: `<b>DiorHost</b> — инфраструктура для production-нагрузок

Абузоустойчивая сеть · мгновенный деплой · прозрачный статус

Доступно: VPS/VDS, Dedicated, Domains, CDN`,
      en: `<b>DiorHost</b> — infrastructure for production workloads

Abuse-resistant network · instant deploy · transparent status

Available: VPS/VDS, Dedicated, Domains, CDN`,
    },
    10,
    [
      { textKey: "btn.deploy_vps", callback: "ntf:open:vds" },
      { textKey: "btn.dedicated", callback: "ntf:open:dedicated" },
      { textKey: "btn.domains", callback: "ntf:open:domains" },
    ]
  ),
  "onboarding.ready_1h": T(
    "onboarding.ready_1h",
    "onboarding",
    true,
    {
      ru: `<b>Аккаунт готов к запуску</b>

Популярные направления: EU / US / Asia edge
Anti-abuse routing · low-latency uplinks · изолированные пулы IPv4

Можно развернуть первую VPS за несколько минут.`,
      en: `<b>Your account is ready</b>

Popular regions: EU / US / Asia edge
Anti-abuse routing · low-latency uplinks · isolated IPv4 pools

Deploy your first VPS in minutes.`,
    },
    40
  ),
  "onboarding.nudge_24h": T(
    "onboarding.nudge_24h",
    "onboarding",
    true,
    {
      ru: `Вы ещё не развернули первую VPS.

Сейчас доступны EU/Asia nodes с обновлёнными uplinks. Dedicated pool — ограниченная доступность.`,
      en: `You have not deployed your first VPS yet.

EU/Asia nodes with refreshed uplinks are available. Dedicated pool — limited availability.`,
    },
    45
  ),
  "feed.node_added": T(
    "feed.node_added",
    "infrastructure_feed",
    false,
    {
      ru: `<b>Infrastructure update</b>

Новая VPS-нода: <code>{{location}}</code>
{{specs}}

Статус: <a href="https://status.dior.host">status</a>`,
      en: `<b>Infrastructure update</b>

New VPS node: <code>{{location}}</code>
{{specs}}

Status: <a href="https://status.dior.host">status</a>`,
    },
    30
  ),
  "feed.low_stock": T(
    "feed.low_stock",
    "infrastructure_feed",
    true,
    {
      ru: `<b>Inventory notice</b>

Осталось <code>{{count}}</code> {{resource}} в пуле {{location}}.
Резерв обновляется по мере выделения.`,
      en: `<b>Inventory notice</b>

<code>{{count}}</code> {{resource}} left in {{location}} pool.
Stock refreshes as allocations complete.`,
    },
    35
  ),
  "feed.network_upgrade": T(
    "feed.network_upgrade",
    "infrastructure_feed",
    false,
    {
      ru: `<b>Network operations</b>

{{detail}}

Маршрутизация и фильтрация обновлены без планового downtime.`,
      en: `<b>Network operations</b>

{{detail}}

Routing and filtering updated with no scheduled downtime.`,
    },
    25
  ),
  "digest.weekly": T(
    "digest.weekly",
    "weekly_digest",
    false,
    {
      ru: `<b>Weekly infrastructure digest</b>

{{body}}

Uptime (30d): <code>{{uptime}}</code> · Active nodes: <code>{{nodes}}</code>`,
      en: `<b>Weekly infrastructure digest</b>

{{body}}

Uptime (30d): <code>{{uptime}}</code> · Active nodes: <code>{{nodes}}</code>`,
    },
    20
  ),
  "intel.operator": T(
    "intel.operator",
    "market_intel",
    false,
    {
      ru: `<b>Operator intelligence</b>

{{insight}}

Источник: публичные routing/abuse-policy тренды. Без operational advice.`,
      en: `<b>Operator intelligence</b>

{{insight}}

Source: public routing / abuse-policy trends. No operational instructions.`,
    },
    25
  ),
  "tech.tip": T(
    "tech.tip",
    "tech_tip",
    false,
    {
      ru: `<b>Infrastructure note</b>

{{tip}}`,
      en: `<b>Infrastructure note</b>

{{tip}}`,
    },
    15
  ),
  "abandoned.15m": T(
    "abandoned.15m",
    "abandoned_deploy",
    true,
    {
      ru: `Конфигурация <code>{{config}}</code> всё ещё доступна для деплоя.

Резерв не гарантируется при высокой загрузке пула.`,
      en: `Configuration <code>{{config}}</code> is still available for deploy.

Pool reservation is not guaranteed under high load.`,
    },
    55
  ),
  "abandoned.6h": T(
    "abandoned.6h",
    "abandoned_deploy",
    true,
    {
      ru: `Часть выбранных ресурсов (<code>{{config}}</code>) ограничена по availability.

Рекомендуем завершить деплой или выбрать альтернативный план.`,
      en: `Some selected resources (<code>{{config}}</code>) have limited availability.

Complete deploy or pick an alternative plan.`,
    },
    50
  ),
  "abandoned.24h": T(
    "abandoned.24h",
    "abandoned_deploy",
    true,
    {
      ru: `Последнее уведомление по резерву конфигурации <code>{{config}}</code>.

Дальнейшие напоминания по этому заказу отправляться не будут.`,
      en: `Final notice for configuration hold <code>{{config}}</code>.

No further reminders will be sent for this checkout.`,
    },
    48
  ),
  "post_purchase.d1": T(
    "post_purchase.d1",
    "post_purchase",
    false,
    {
      ru: `<b>Service health check</b>

Ваша {{serviceType}} активна. Если нужен тюнинг сети или апгрейд — поддержка в разделе Tickets.`,
      en: `<b>Service health check</b>

Your {{serviceType}} is active. For network tuning or upgrades — open Tickets.`,
    },
    35
  ),
  "post_purchase.d3": T(
    "post_purchase.d3",
    "post_purchase",
    true,
    {
      ru: `Доступны storage upgrades и дополнительные IPv4 для вашей зоны.

Новые low-latency locations добавлены в EU.`,
      en: `Storage upgrades and extra IPv4 are available in your region.

New low-latency EU locations are online.`,
    },
    40
  ),
  "post_purchase.d7": T(
    "post_purchase.d7",
    "post_purchase",
    true,
    {
      ru: `Рекомендация по производительности: проверьте geo-routing и резервирование DNS для вашего стека.`,
      en: `Performance tip: review geo-routing and DNS redundancy for your stack.`,
    },
    38
  ),
  "post_purchase.d14": T(
    "post_purchase.d14",
    "post_purchase",
    true,
    {
      ru: `Для multi-service deployments доступны dedicated и private networking. Запрос через поддержку.`,
      en: `Dedicated and private networking are available for multi-service setups. Contact support.`,
    },
    36
  ),
  "expansion.offer": T(
    "expansion.offer",
    "expansion",
    true,
    {
      ru: `<b>Infrastructure expansion</b>

По активности аккаунта доступны: dedicated, multi-node, CDN edge.

{{detail}}`,
      en: `<b>Infrastructure expansion</b>

Based on account activity: dedicated, multi-node, CDN edge.

{{detail}}`,
    },
    42
  ),
  "vip.early_access": T(
    "vip.early_access",
    "vip_alert",
    true,
    {
      ru: `<b>Priority inventory</b>

{{detail}}

Ранний доступ для high-value аккаунтов.`,
      en: `<b>Priority inventory</b>

{{detail}}

Early access for high-value accounts.`,
    },
    30
  ),
  "reactivation.14d": T(
    "reactivation.14d",
    "reactivation",
    true,
    {
      ru: `<b>Platform update since your last visit</b>

{{updates}}

Инфраструктура и маршруты обновлялись — актуальный статус в боте.`,
      en: `<b>Platform update since your last visit</b>

{{updates}}

Infrastructure and routes were upgraded — check status in the bot.`,
    },
    44
  ),
};

export const BUTTON_LABELS: Record<string, LocalizedBody> = {
  "btn.deploy_vps": { ru: "Deploy VPS", en: "Deploy VPS" },
  "btn.dedicated": { ru: "Dedicated", en: "Dedicated" },
  "btn.domains": { ru: "Domains", en: "Domains" },
  "btn.cdn": { ru: "CDN", en: "CDN" },
  "btn.status": { ru: "Status", en: "Status" },
  "btn.services": { ru: "My services", en: "My services" },
};

export function getCatalogEntry(key: string): CatalogEntry | undefined {
  return TEMPLATE_CATALOG[key];
}
