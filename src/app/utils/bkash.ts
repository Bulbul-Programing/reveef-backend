import axios from "axios";
import AppError from "../error/AppError.ts";
import { envVars } from "../envConfig/index.ts";

const BKASH_BASE_URL = process.env.BKASH_BASE_URL as string; // e.g. https://tokenized.sandbox.bka.sh/v1.2.0-beta
const BKASH_USERNAME = process.env.BKASH_USERNAME as string;
const BKASH_PASSWORD = process.env.BKASH_PASSWORD as string;
const BKASH_APP_KEY = process.env.BKASH_APP_KEY as string;
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET as string;
const BKASH_CALLBACK_URL = process.env.BKASH_CALLBACK_URL as string;

let cachedToken: { idToken: string; expiresAt: number } | null = null;

/**
 * bKash id_tokens are short-lived (~1hr). Cached in memory and re-granted
 * only when close to expiry, instead of on every single payment call.
 */
const grantToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.idToken;
  }

  const { data } = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/token/grant`,
    {
      app_key: BKASH_APP_KEY,
      app_secret: BKASH_APP_SECRET,
    },
    {
      headers: {
        username: BKASH_USERNAME,
        password: BKASH_PASSWORD,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!data?.id_token) {
    throw new AppError(502, "Failed to authenticate with bKash");
  }

  cachedToken = {
    idToken: data.id_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.idToken;
};

const authHeaders = async () => {
  const idToken = await grantToken();
  return {
    Authorization: idToken,
    "X-App-Key": BKASH_APP_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

const createPayment = async (params: {
  amount: number;
  orderNumber: string;
  payerReference: string;
}) => {
  
  const headers = await authHeaders();
  const { data } = await axios.post(
    `${envVars.BKASH_BASE_URL}/tokenized/checkout/create`,
    {
      mode: "0011",
      payerReference: params.payerReference,
      callbackURL: envVars.BKASH_CALLBACK_URL,
      amount: params.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.orderNumber,
    },
    { headers }
  );
  
  if (!data?.paymentID || !data?.bkashURL) {
    throw new AppError(502, "Failed to create bKash payment");
  }

  return data as { paymentID: string; bkashURL: string };
};

const executePayment = async (paymentID: string) => {
  const headers = await authHeaders();

  const { data } = await axios.post(
    `${envVars.BKASH_BASE_URL}/tokenized/checkout/execute`,
    { paymentID },
    { headers }
  );

  return data as {
    transactionStatus: string;
    trxID?: string;
    paymentID: string;
    amount?: string;
  };
};

const queryPayment = async (paymentID: string) => {
  const headers = await authHeaders();

  const { data } = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/payment/status`,
    { paymentID },
    { headers }
  );

  return data;
};

export const BkashService = {
  createPayment,
  executePayment,
  queryPayment,
};