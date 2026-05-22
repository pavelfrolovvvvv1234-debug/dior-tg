import crypto from "crypto";

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateApiKeyPair(): { publicKey: string; secretKey: string; prefix: string; hash: string } {
  const body = crypto.randomBytes(24).toString("hex");
  const publicKey = `rh_live_${body}`;
  const secretBody = crypto.randomBytes(32).toString("hex");
  const secretKey = `rh_sec_${secretBody}`;
  const prefix = publicKey.slice(0, 16);
  return { publicKey, secretKey, prefix, hash: sha256Hex(publicKey) };
}

export function generateSigningSecret(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: sha256Hex(raw) };
}

export function generateWebhookSecret(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(24).toString("hex");
  return { raw, hash: sha256Hex(raw) };
}

export function generateReferralCode(resellerId: string): string {
  const tail = crypto.randomBytes(3).toString("hex");
  return `REF_${resellerId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}_${tail}`;
}
