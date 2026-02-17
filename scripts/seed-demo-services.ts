import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import User, { Role, UserStatus } from "../src/entities/User.js";
import Domain, { DomainStatus } from "../src/entities/Domain.js";
import VirtualDedicatedServer, { generatePassword } from "../src/entities/VirtualDedicatedServer.js";
import DedicatedServer, { DedicatedServerStatus } from "../src/entities/DedicatedServer.js";
import ms from "../src/lib/multims.js";
import { UserRepository } from "../src/infrastructure/db/repositories/UserRepository.js";

const DEFAULT_TELEGRAM_ID = 7568177886;

const parseTelegramId = (value: string | undefined): number => {
  const parsed = Number(value ?? DEFAULT_TELEGRAM_ID);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid telegram id: ${value}`);
  }
  return parsed;
};

const ensureUser = async (telegramId: number) => {
  const dataSource = await getAppDataSource();
  const userRepo = new UserRepository(dataSource);

  let user = await userRepo.findByTelegramId(telegramId);
  if (!user) {
    user = new User();
    user.telegramId = telegramId;
    user.status = UserStatus.User;
    user.role = Role.User;
    user = await userRepo.save(user);
  }

  return user;
};

const ensureDemoDomain = async (userId: number) => {
  const dataSource = await getAppDataSource();
  const repo = dataSource.getRepository(Domain);
  const demoDomain = "demo-domain.com";

  const existing = await repo.findOne({
    where: { userId, domain: demoDomain },
  });

  if (existing) {
    return existing;
  }

  const domain = new Domain();
  domain.userId = userId;
  domain.domain = demoDomain;
  domain.tld = "com";
  domain.period = 1;
  domain.price = 9.99;
  domain.status = DomainStatus.REGISTERED;
  domain.ns1 = "ns1.demo.local";
  domain.ns2 = "ns2.demo.local";
  domain.provider = "amper";
  domain.providerDomainId = "demo-001";

  return repo.save(domain);
};

const ensureDemoVds = async (userId: number) => {
  const dataSource = await getAppDataSource();
  const repo = dataSource.getRepository(VirtualDedicatedServer);

  const existing = await repo.findOne({
    where: { targetUserId: userId, vdsId: -1 },
  });

  if (existing) {
    return existing;
  }

  const vds = new VirtualDedicatedServer();
  vds.vdsId = -1;
  vds.login = "root";
  vds.password = generatePassword(12);
  vds.ipv4Addr = "10.10.10.10";
  vds.cpuCount = 2;
  vds.networkSpeed = 100;
  vds.isBulletproof = false;
  vds.payDayAt = null as unknown as Date;
  vds.ramSize = 4;
  vds.diskSize = 40;
  vds.lastOsId = 0;
  vds.rateName = "Demo VDS";
  const expiresInMs = ms("30d") ?? 30 * 24 * 60 * 60 * 1000;
  vds.expireAt = new Date(Date.now() + expiresInMs);
  vds.targetUserId = userId;
  vds.renewalPrice = 10.0;
  vds.displayName = "Demo VDS";

  return repo.save(vds);
};

const ensureDemoDedicated = async (userId: number) => {
  const dataSource = await getAppDataSource();
  const repo = dataSource.getRepository(DedicatedServer);

  const existing = await repo.findOne({
    where: { userId, label: "Demo Dedicated" },
  });

  if (existing) {
    return existing;
  }

  const dedicated = new DedicatedServer();
  dedicated.userId = userId;
  dedicated.label = "Demo Dedicated";
  dedicated.status = DedicatedServerStatus.ACTIVE;
  dedicated.ticketId = null;
  dedicated.credentials = JSON.stringify({
    ip: "192.0.2.10",
    login: "root",
    password: generatePassword(12),
    panel: "https://demo.panel.local",
    notes: "Demo dedicated server for testing.",
  });

  return repo.save(dedicated);
};

const run = async () => {
  const telegramId = parseTelegramId(process.argv[2]);

  try {
    const user = await ensureUser(telegramId);
    await ensureDemoDomain(user.id);
    await ensureDemoVds(user.id);
    await ensureDemoDedicated(user.id);

    console.info(
      `Demo services added for telegramId=${telegramId} (userId=${user.id}).`
    );
  } finally {
    await closeDataSource();
  }
};

run().catch((error) => {
  console.error("Failed to seed demo services:", error);
  process.exitCode = 1;
});
