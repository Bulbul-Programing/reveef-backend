import AppError from "../../error/AppError.ts";
import type { TFreeShipping } from "./FreeShipping.interface.ts";
import { freeShippingModel } from "./FreeShipping.model.ts";

const CONFIG_ID = "free-shipping-config";

const createFreeShippingIntoDB = async (
  payload: Partial<TFreeShipping>
) => {
  console.log(payload);
  const existingConfig = await freeShippingModel.findById(CONFIG_ID);

  if (existingConfig) {
    throw new AppError(
      409,
      "Free shipping configuration already exists. Please update it instead."
    );
  }

  const config = await freeShippingModel.create({
    _id: CONFIG_ID,
    minimumPurchase: payload.minimumPurchase ?? 1000,
    isActive: payload.isActive ?? true,
  });

  return config;
};

const getFreeShippingFromDB = async () => {
  let config = await freeShippingModel.findById(CONFIG_ID);

  if (!config) {
    config = await freeShippingModel.create({
      _id: CONFIG_ID,
      minimumPurchase: 1000,
      isActive: true,
    });
  }

  return config;
};

const updateFreeShippingIntoDB = async (
  payload: Partial<TFreeShipping>
) => {
  const config = await getFreeShippingFromDB();

  const updatedConfig = await freeShippingModel.findByIdAndUpdate(
    config._id,
    { $set: payload },
    {
      new: true,
      runValidators: true,
    }
  );

  return updatedConfig;
};

const checkFreeShippingEligibility = async (subtotal: number) => {
  const config = await getFreeShippingFromDB();

  const eligible =
    config.isActive && subtotal >= config.minimumPurchase;

  return {
    eligible,
    minimumPurchase: config.minimumPurchase,
    subtotal,
    remainingAmount: eligible
      ? 0
      : Math.max(0, config.minimumPurchase - subtotal),
  };
};

export const freeShippingService = {
  createFreeShippingIntoDB,
  getFreeShippingFromDB,
  updateFreeShippingIntoDB,
  checkFreeShippingEligibility,
};