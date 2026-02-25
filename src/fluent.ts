import { Fluent } from "@moebius/fluent";
import { join } from "node:path";

function pathToFtl(lang: string, name: string) {
  return join(process.cwd(), "locales", lang, name);
}

export async function initFluent(): Promise<{
  fluent: Fluent;
  availableLocales: string[];
}> {
  const fluent = new Fluent();

  await fluent.addTranslation({
    locales: "en",
    filePath: [
      pathToFtl("en", "translation.ftl"),
      pathToFtl("en", "services.ftl"),
    ],
    isDefault: false,
    bundleOptions: {
      useIsolating: false,
    },
  });

  await fluent.addTranslation({
    locales: "ru",
    filePath: [
      pathToFtl("ru", "translation.ftl"),
      pathToFtl("ru", "services.ftl"),
    ],
    isDefault: true,
    bundleOptions: {
      useIsolating: false,
    },
  });

  return { fluent, availableLocales: ["en", "ru"] };
}
