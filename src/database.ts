import { DataSource } from "typeorm";
import User from "@entities/User";
import TempLink from "@entities/TempLink";
import TopUp from "@entities/TopUp";
import DomainRequest from "@entities/DomainRequest";
import Promo from "@entities/Promo";

const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "data.db",
  synchronize: true,
  entities: [User, TempLink, TopUp, DomainRequest, Promo],
  enableWAL: true,
});

export async function getAppDataSource() {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }
  return await AppDataSource.initialize();
}
