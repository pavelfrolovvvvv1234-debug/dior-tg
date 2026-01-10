/**
 * Session data types for Grammy sessions.
 *
 * @module shared/types/session
 */

import { Role } from "../../entities/User.js";

/**
 * Main session data (persisted).
 */
export interface MainSessionData {
  locale: string;
  user: {
    id: number;
    balance: number;
    role: Role;
    isBanned: boolean;
  };
  lastSumDepositsEntered: number;
}

/**
 * Other session data (in-memory).
 */
export interface OtherSessionData {
  controlUsersPage: {
    orderBy: "balance" | "id";
    sortBy: "ASC" | "DESC";
    page: number;
    pickedUserData?: {
      id: number;
    };
  };
  vdsRate: {
    bulletproof: boolean;
    selectedRateId: number;
    selectedOs: number;
  };
  manageVds: {
    page: number;
    lastPickedId: number;
  };
  domains: {
    lastPickDomain: string;
    page: number;
  };
}

/**
 * Complete session data structure.
 */
export interface SessionData {
  main: MainSessionData;
  other: OtherSessionData;
}
