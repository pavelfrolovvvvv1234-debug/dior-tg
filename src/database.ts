/**
 * @deprecated Import from `infrastructure/db/datasource` — single shared DataSource.
 * Kept for `@/database` imports; do not create a second SQLite connection here.
 */
export {
  getAppDataSource,
  closeDataSource,
} from "./infrastructure/db/datasource.js";
