import axios from "axios";

interface ResponseCreatedInvoice {
  id: string;
  url: string;
  type: "purchase";
  rub_amount: string;
}

interface ResponseInvoiceInfo {
  error: boolean;
  errors: string[];
  id: string;
  url: string;
  state:
    | "notpayed"
    | "processing"
    | "wrongamount"
    | "failed"
    | "payed"
    | "unavailable";
  type: string;
  method: string | null;
  required_method: string | null;
  amount_currency: string;
  rub_amount: string;
  initial_amount: string;
  remaining_amount: string;
  balance_amount: string;
  commission_amount: string;
  description: string | null;
  redirect_url: string;
  callback_url: string | null;
  extra: string | null;
  created_at: string;
  expired_at: string;
  final_at: string | null;
}

export class CrystalPayClient {
  private endpoint: string = "https://api.crystalpay.io/v3/";
  private axiosClient: axios.AxiosInstance;

  constructor(private login: string, private secretKey: string) {
    this.axiosClient = axios.create({
      baseURL: this.endpoint,
      headers: {
        "User-Agent": "DripHosting/Bot 1.1",
      },
    });
  }

  async createInvoice(amount: number): Promise<ResponseCreatedInvoice> {
    try {
      const response = await this.axiosClient<ResponseCreatedInvoice>(
        "/invoice/create/",
        {
          method: "POST",
          data: JSON.stringify({
            auth_login: this.login,
            auth_secret: this.secretKey,
            amount,
            amount_currency: "USD",
            lifetime: 30,
            type: "purchase",
            redirect_url: `https://t.me/@${process.env["BOT_USERNAME"]}/`,
          }),
        }
      );
      return response.data;
    } catch (err) {
      throw new Error("Failed Create");
    }
  }

  async getInvoice(id: string) {
    const response = await this.axiosClient<ResponseInvoiceInfo>(
      "/invoice/info/",
      {
        method: "POST",
        data: {
          auth_login: this.login,
          auth_secret: this.secretKey,
          id,
        },
      }
    );

    return response.data;
  }
}
