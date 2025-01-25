import { Fluent } from "@moebius/fluent";
import { join } from "node:path";

export async function initFluent(): Promise<{
  fluent: Fluent;
  availableLocales: string[];
}> {
  const fluent = new Fluent();

  await fluent.addTranslation({
    locales: "en",
    filePath: [join(process.cwd(), "locales", "en", "translation.ftl")],
    isDefault: true,
    bundleOptions: {
      useIsolating: false,
    },
  });

  await fluent.addTranslation({
    locales: "ru",
    filePath: [join(process.cwd(), "locales", "ru", "translation.ftl")],
    isDefault: false,
    bundleOptions: {
      useIsolating: false,
    },
  });

  return { fluent, availableLocales: ["en", "ru"] };
}
