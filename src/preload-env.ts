/**
 * Must be imported first so .env is loaded before config.ts and other modules.
 *
 * @module preload-env
 */

import { loadEnvFile } from "./app/load-env.js";

loadEnvFile(__dirname);
