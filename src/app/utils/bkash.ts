
import httpStatus from "http-status"; // swap for your status-code source if different
import { envVars } from "../envConfig/index.ts";
import axios from "axios";
import AppError from "../error/AppError.ts";

const BKASH_BASE_URL = envVars.BKASH_BASE_URL as string;

type TBkashToken = {
  id_token: string;
  expiresAt: number; // epoch ms
};

let cachedToken: TBkashToken | null = null;

const grantToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.id_token;
  }

  const { data } = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/token/grant`,
    {
      app_key: envVars.BKASH_APP_KEY,
      app_secret: envVars.BKASH_APP_SECRET,
    },
    {
      headers: {
        username: envVars.BKASH_USERNAME,
        password: envVars.BKASH_PASSWORD,
        "Content-Type": "application/json",
      },
    }
  );

  if (!data?.id_token) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to authenticate with bKash"
    );
  }

  // bKash tokens are typically valid ~1 hour; refresh a bit early
  cachedToken = {
    id_token: data.id_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  return cachedToken.id_token;
};

const authHeaders = async () => {
  const idToken = await grantToken();
  return {
    Authorization: idToken,
    "X-App-Key": envVars.BKASH_APP_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

const createPayment = async (payload: {
  amount: number;
  orderNumber: string;
  payerReference: string;
}) => {
  const headers = await authHeaders();

  const { data } = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/create`,
    {
      mode: "0011",
      payerReference: payload.payerReference,
      callbackURL: envVars.BKASH_CALLBACK_URL,
      amount: payload.amount.toString(),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: payload.orderNumber,
    },
    { headers }
  );

  if (!data?.paymentID || !data?.bkashURL) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      data?.statusMessage || "Failed to initiate bKash payment"
    );
  }

  return data as {
    paymentID: string;
    bkashURL: string;
    paymentCreateTime: string;
  };
};

const executePayment = async (paymentID: string) => {
  const headers = await authHeaders();

  const { data } = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/execute`,
    { paymentID },
    { headers }
  );

  return data as {
    trxID?: string;
    transactionStatus?: string;
    amount?: string;
    paymentExecuteTime?: string;
    statusCode?: string;
    statusMessage?: string;
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

const refundPayment = async (payload: {
  paymentID: string;
  trxID: string;
  amount: number;
  reason: string;
  sku: string;
}) => {
  const headers = await authHeaders();
  const { data } = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/payment/refund`,
    {
      paymentID: payload.paymentID,
      trxID: payload.trxID,
      amount: payload.amount.toString(),
      reason: payload.reason,
      sku: payload.sku,
    },
    { headers }
  );
  return data;
};

export const Bkash = {
  grantToken,
  createPayment,
  executePayment,
  queryPayment,
  refundPayment,
};