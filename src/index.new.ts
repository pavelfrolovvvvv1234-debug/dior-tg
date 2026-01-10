/**
 * New entry point for the bot using refactored architecture.
 * This file will replace the old index.ts after full migration.
 *
 * @module index
 */

import { createBot, startBot } from "./app/bot.js";
import { Logger } from "./app/logger.js";

/**
 * Main entry point for the bot.
 */
async function main() {
  try {
    Logger.info("Initializing bot...");

    // Create bot with all services and middlewares
    const { bot, cleanup } = await createBot();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      Logger.info("Received SIGINT, shutting down gracefully...");
      await cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      Logger.info("Received SIGTERM, shutting down gracefully...");
      await cleanup();
      process.exit(0);
    });

    // Start the bot
    await startBot(bot);

    Logger.info("Bot started successfully");
  } catch (error) {
    Logger.error("Failed to start bot", error);
    process.exit(1);
  }
}

// Run the bot
main().catch((error) => {
  Logger.error("Unhandled error in main", error);
  process.exit(1);
});
