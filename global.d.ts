declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: string;
      BOT_TOKEN: string;
      WEBSITE_URL: string;
      SUPPORT_USERNAME_TG: string;
      BOT_USERNAME: string;
    }
  }
}
export {};
