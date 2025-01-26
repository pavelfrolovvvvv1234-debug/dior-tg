// Reference: https://domainr.com/
// Documentaion here: https://domainr.com/docs/api
import axios from "axios";

type DomainStatus = "Available" | "Unavailable";

interface DomainStatusAPI {
  domain: string;
  zone: string;
  status: DomainStatusResponseAPI;
  // deprecated in v2 (Do Not Use)
  summary: string;
}

const AvailableDomainsZones = [
  ".com",
  ".org",
  ".net",
  ".biz",
  ".club",
  ".pro",
  ".uk",
  ".cc",
  ".io",
  ".us",
  ".at",
  ".ca",
  ".guru",
  ".link",
  ".info",
];

// https://domainr.com/docs/api/v2/status
type DomainStatusResponseAPI =
  | "unknown"
  | "undelegated"
  | "inactive"
  | "pending"
  | "disallowed"
  | "claimed"
  | "reserved"
  | "dpml"
  | "invalid"
  | "active"
  | "parked"
  | "marketed"
  | "expiring"
  | "deleting"
  | "priced"
  | "transferable"
  | "premium"
  | "suffix"
  | "zone"
  | "tld";

class DomainChecker {
  private api: axios.AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: "https://api.domainr.com/v2",
      params: {
        "mashape-key": process.env.DOMAINR_TOKEN,
      },
      httpAgent: "node-fetch",
    });
  }

  async getStatus(domain: string): Promise<DomainStatus> {
    const response = await this.api.get<{ status: DomainStatusAPI[] }>(
      "/status",
      {
        params: {
          domain,
        },
      }
    );

    console.log(response.data);

    return "Unavailable";
  }

  domainIsValid(domain: string) {
    return domain.match(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i);
  }

  domainIsAvailable(domain: string) {
    return AvailableDomainsZones.some((zone) => domain.endsWith(zone));
  }
}
