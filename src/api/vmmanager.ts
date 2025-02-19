import axios from "axios";

type CreatePublicTokenResponse = {
  id: number;
  token: string;
  expires_at: string;
  confirmed: boolean;
};

type CreateVMSuccesffulyResponse = {
  id: number;
  task: number;
  recipe_task_list: number[];
  recipe_task: number;
  spice_task: number;
};

type GetOsListResponse = {
  last_notify: number;
  list: Os[];
};

interface Os {
  adminonly: boolean;
  clusters: {
    id: number;
    name: string;
  };
  comment: null | string;
  cpu_mode: null | string;
  efi_boot: boolean;
  hdd_mib_required: number;
  id: number;
  is_lxd_image: boolean;
  kms_ip: null;
  kms_port: null | string;
  kms_supported: boolean;
  min_ram_mib: number;
  name: string;
  nodes: {
    id: number;
    ip_addr: string;
    name: string;
    ssh_port: number;
  };
  os_group: string;
  product_key: null;
  repository: "ISPsystem" | "IPSsystem EOL" | "ISPsystem LXD" | "local";
  repository_id: number;
  state: string;
  tags: string[];
  updated_at: string;
}

export class VMManager {
  // x-xsrf-token
  private token?: string;

  constructor(private email: string, private password: string) {
    // this.login();
    this.token = "bad-token";
  }

  async login(): Promise<void> {
    try {
      const { status, data } = await axios.post<CreatePublicTokenResponse>(
        `${process.env.VMM_ENDPOINT_URL}auth/v4/public/token`,
        {
          email: this.email,
          password: this.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (status === 201) {
        this.token = data.token;
      }
    } catch (error) {
      if (axios.isAxiosError<{ error: { code: number; msg: string } }>(error)) {
        console.error("Error Authenticate in VMManager:", error.response?.data);
      }
    }
  }

  async getOsList() {
    try {
      const { status, data } = await axios.get<GetOsListResponse>(
        `${process.env.VMM_ENDPOINT_URL}vm/v3/os`,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-xsrf-token": this.token,
          },
        }
      );

      if (status === 200) {
        return data;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error Get OS List in VMManager:", error.response?.data);
      }
    }
  }

  async createVM(
    name: string,
    password: string,
    cpuNumber: number,
    ramSize: number,
    osId: number,
    comment: string,
    diskSize: number,
    ipv4Count: number
  ) {
    try {
      const { status, data } = await axios.post<CreateVMSuccesffulyResponse>(
        `${process.env.VMM_ENDPOINT_URL}vm/v3/host`,
        {
          name: name,
          password: password,
          cpu_number: cpuNumber,
          // In Gigabytes
          ram_mib: ramSize * 1024,
          net_in_mbitps: 150,
          net_out_mbitps: 150,
          os: osId,
          comment: comment,
          // In Gigabytes
          hdd_mib: diskSize * 1024,
          ipv4_number: ipv4Count,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-xsrf-token": this.token,
          },
        }
      );

      if (status === 200) {
        return data;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error Create VM in VMManager:", error.response?.data);
      }
    }
  }
}
