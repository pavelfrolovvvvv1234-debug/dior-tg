import { DataSource } from "typeorm";
import User from "@entities/User";
import TempLink from "@entities/TempLink";

const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "data.db",
  synchronize: true,
  entities: [User, TempLink],
  enableWAL: true,
});

export async function getAppDataSource() {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }
  return await AppDataSource.initialize();
}
