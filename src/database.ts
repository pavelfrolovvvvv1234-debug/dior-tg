import { DataSource } from "typeorm";
import User from "@entities/User";
import TempLink from "@entities/TempLink";
import DomainService from "@entities/DomainService";
import TopUp from "./entities/TopUp";

const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "data.db",
  synchronize: true,
  entities: [User, TempLink, DomainService, TopUp],
  enableWAL: true,
});

export async function getAppDataSource() {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }
  return await AppDataSource.initialize();
}
