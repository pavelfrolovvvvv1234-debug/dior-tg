import { Fluent } from "@moebius/fluent";
import { join } from "node:path";

function pathToFtl(lang: string, name: string) {
  return join(process.cwd(), "locales", lang, name);
}

/** Обёртка для сервисов: translate(locale, key, vars) без useLocale. */
export type FluentTranslator = {
  translate(locale: string, key: string, vars?: Record<string, string | number>): string;
};

/** Два изолированных инстанса — нет useLocale/гонок. fluent — обёртка для сервисов (translate с locale). */
export async function initFluent(): Promise<{
  fluentRu: Fluent;
  fluentEn: Fluent;
  fluent: FluentTranslator;
  availableLocales: string[];
}> {
  const fluentRu = new Fluent();
  await fluentRu.addTranslation({
    locales: "ru",
    filePath: [
      pathToFtl("ru", "translation.ftl"),
      pathToFtl("ru", "services.ftl"),
    ],
    isDefault: true,
    bundleOptions: { useIsolating: false },
  });

  const fluentEn = new Fluent();
  await fluentEn.addTranslation({
    locales: "en",
    filePath: [
      pathToFtl("en", "translation.ftl"),
      pathToFtl("en", "services.ftl"),
    ],
    isDefault: true,
    bundleOptions: { useIsolating: false },
  });

  const fluent = {
    translate(locale: string, key: string, vars?: Record<string, string | number>) {
      const f = locale === "en" ? fluentEn : fluentRu;
      return f.translate(locale, key, vars ?? {});
    },
  };

  return { fluentRu, fluentEn, fluent, availableLocales: ["en", "ru"] };
}
