/**
 * Amper DNS / SSL types (https://amper.lat/api/v1/docs/).
 *
 * @module infrastructure/domains/amper-dns-types
 */

export type AmperDnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV";

export type AmperDnsRecord = {
  id?: string;
  type: AmperDnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
};

export type AmperDnsListResult = {
  records: AmperDnsRecord[];
  proxyNotice?: string | null;
  raw?: unknown;
};

export type AmperSslMode = "FLEXIBLE" | "FULL";

export type AmperSslStatus = {
  mode?: AmperSslMode | string | null;
  status?: string | null;
  certificateStatus?: string | null;
  raw?: unknown;
};

export const AMPER_DNS_RECORD_TYPES: AmperDnsRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
];
