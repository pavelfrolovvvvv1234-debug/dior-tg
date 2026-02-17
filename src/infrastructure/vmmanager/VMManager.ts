/**
 * VMManager API client with retry and error handling.
 *
 * @module infrastructure/vmmanager/VMManager
 */

import axios, { AxiosError } from "axios";
import { config } from "../../app/config.js";
import { Logger } from "../../app/logger.js";
import { retry } from "../../shared/utils/retry.js";
import { ExternalApiError } from "../../shared/errors/index.js";
import ms from "../../lib/multims.js";
import { generatePassword } from "../../entities/VirtualDedicatedServer.js";
import type {
  CreatePublicTokenResponse,
  CreateVMSuccesffulyResponse,
  GetOsListResponse,
  GetVMResponse,
} from "../../api/vmmanager.js";

// Re-export types
export type {
  GetOsListResponse,
  Os,
  GetVMResponse,
  ListItem,
} from "../../api/vmmanager.js";

/**
 * VMManager API client with automatic retry and error handling.
 */
export class VMManager {
  private token?: string;
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private loginInterval?: NodeJS.Timeout;

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
    this.baseUrl = config.VMM_ENDPOINT_URL;

    // Initial login
    this.login().catch((error) => {
      Logger.error("Failed initial VMManager login", error);
    });

    // Auto-login every 5 minutes
    this.loginInterval = setInterval(() => {
      this.login().catch((error) => {
        Logger.error("Failed periodic VMManager login", error);
      });
    }, ms("5m"));

    Logger.info("VMManager instance created");
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    if (this.loginInterval) {
      clearInterval(this.loginInterval);
      this.loginInterval = undefined;
    }
    Logger.info("VMManager instance destroyed");
  }

  /**
   * Login and get authentication token.
   */
  private async login(): Promise<void> {
    try {
      Logger.debug("Attempting VMManager authentication");

      const { status, data } = await axios.post<CreatePublicTokenResponse>(
        `${this.baseUrl}auth/v4/public/token`,
        {
          email: this.email,
          password: this.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      if (status === 201 && data.token) {
        this.token = data.token;
        Logger.info("VMManager authentication successful");
      } else {
        throw new Error(`Unexpected response status: ${status}`);
      }
    } catch (error) {
      if (axios.isAxiosError<{ error: { code: number; msg: string } }>(error)) {
        const errorData = error.response?.data;
        Logger.error("VMManager authentication failed", {
          status: error.response?.status,
          code: errorData?.error?.code,
          message: errorData?.error?.msg,
        });
      } else {
        Logger.error("VMManager authentication failed", error);
      }
      throw new ExternalApiError(
        "Failed to authenticate with VMManager",
        "VMManager",
        error
      );
    }
  }

  /**
   * Get headers with authentication token.
   */
  private getHeaders(): Record<string, string> {
    if (!this.token) {
      throw new ExternalApiError("Not authenticated with VMManager", "VMManager");
    }
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-xsrf-token": this.token,
    };
  }

  /**
   * Handle API errors and retry if needed.
   */
  private async handleApiCall<T>(
    apiCall: () => Promise<T>,
    operation: string
  ): Promise<T> {
    return retry(
      async () => {
        try {
          return await apiCall();
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const errorData = error.response?.data as { error?: { code?: number } } | undefined;
            // Code 1000 = unauthorized, retry login
            if (errorData?.error?.code === 1000) {
              Logger.warn("VMManager token expired, re-authenticating");
              await this.login();
              // Retry the call after login
              return await apiCall();
            }
          }
          throw error;
        }
      },
      {
        maxAttempts: 3,
        delayMs: 1000,
        exponentialBackoff: true,
      }
    ).catch((error) => {
      Logger.error(`VMManager ${operation} failed`, error);
      throw new ExternalApiError(
        `${operation} failed: ${error.message || "Unknown error"}`,
        "VMManager",
        error
      );
    });
  }

  /**
   * Get OS list.
   */
  async getOsList(): Promise<GetOsListResponse | undefined> {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.get<GetOsListResponse>(
        `${this.baseUrl}vm/v3/os`,
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "getOsList");
  }

  /**
   * Create VM.
   */
  async createVM(
    name: string,
    password: string,
    cpuNumber: number,
    ramSize: number,
    osId: number,
    comment: string,
    diskSize: number,
    ipv4Count: number,
    networkIn: number,
    networkOut: number
  ): Promise<CreateVMSuccesffulyResponse | false> {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.post<CreateVMSuccesffulyResponse>(
        `${this.baseUrl}vm/v3/host`,
        {
          name,
          password,
          cpu_number: cpuNumber,
          ram_mib: ramSize * 1024, // Convert GB to MiB
          net_in_mbitps: networkIn,
          net_out_mbitps: networkOut,
          os: osId,
          comment,
          hdd_mib: diskSize * 1024, // Convert GB to MiB
          ipv4_number: ipv4Count,
        },
        {
          headers: this.getHeaders(),
          timeout: 30000, // 30 seconds for VM creation
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "createVM").catch(() => false);
  }

  /**
   * Get VM info.
   */
  async getInfoVM(id: number) {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.get(
        `${this.baseUrl}vm/v3/host/${id}`,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "getInfoVM");
  }

  /**
   * Get IPv4 addresses for VM.
   */
  async getIpv4AddrVM(id: number) {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.get(
        `${this.baseUrl}vm/v3/host/${id}/ipv4`,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "getIpv4AddrVM");
  }

  /**
   * Start VM.
   */
  async startVM(id: number) {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.post(
        `${this.baseUrl}vm/v3/host/${id}/start`,
        undefined,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "startVM");
  }

  /**
   * Stop VM.
   */
  async stopVM(id: number) {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.post(
        `${this.baseUrl}vm/v3/host/${id}/stop`,
        { force: false },
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "stopVM");
  }

  /**
   * Delete VM.
   */
  async deleteVM(id: number) {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.delete<{
        id: number;
        task: number;
      }>(
        `${this.baseUrl}vm/v3/host/${id}`,
        {
          params: { force: false },
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "deleteVM");
  }

  /**
   * Reinstall OS on VM.
   */
  async reinstallOS(id: number, osId: number, password?: string) {
    return this.handleApiCall(async () => {
      const { status, data } = await axios.post<{
        id: number;
        task: number;
        recipe_task_list: number[];
        recipe_task: number;
        spice_task: number;
      }>(
        `${this.baseUrl}vm/v3/host/${id}/reinstall`,
        {
          os: osId,
          password: password || generatePassword(12),
        },
        {
          headers: this.getHeaders(),
          timeout: 20000,
        }
      );

      if (status === 200) {
        return data;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "reinstallOS");
  }

  /**
   * Change VM password.
   */
  async changePasswordVM(id: number): Promise<string> {
    const newPassword = generatePassword(12);
    await this.handleApiCall(async () => {
      const { status } = await axios.post(
        `${this.baseUrl}vm/v3/host/${id}/password`,
        { password: newPassword },
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (status === 200) {
        return true;
      }
      throw new Error(`Unexpected status: ${status}`);
    }, "changePasswordVM");

    return newPassword;
  }
}
