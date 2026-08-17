import QueryBuilder from "../../builder/QueryBuilder.ts";
import AppError from "../../error/AppError.ts";
import { productModel } from "../Product/product.model.ts";
import type { TUserRole } from "../User/user.interface.ts";
import type { TProductVariant } from "./productVariant.interface.ts";
import { productVariantModel } from "./productVariant.model.ts";


const productVariantSearchableFields = ["sku", "size", "color.name"];

const generateSku = (productId: string, size: string, colorName: string) => {
  const base = `${productId.slice(-6)}-${size}-${colorName}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return base;
};

const ensureUniqueSku = async (baseSku: string, excludeId?: string) => {
  let sku = baseSku;
  let suffix = 1;

  for (;;) {
    const existing = await productVariantModel.findOne({
      sku,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return sku;
    sku = `${baseSku}-${suffix++}`;
  }
};

const createProductVariantIntoDB = async (payload: TProductVariant) => {
  const product = await productModel.findById(payload.product);
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  const baseSku =
    payload.sku ||
    generateSku(String(payload.product), payload.size, payload.color.name);
  const sku = await ensureUniqueSku(baseSku);

  const result = await productVariantModel.create({ ...payload, sku });
  return result;
};

/**
 * requesterRole is only populated when checkAuth has run (admin/stuff
 * management routes). Public storefront calls this without a role, so
 * deactivated variants (e.g. discontinued colorway) stay hidden.
 */
const getAllProductVariantsFromDB = async (
  query: Record<string, unknown>,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const baseFilter = canSeeInactive ? {} : { isActive: true };

  const variantQuery = new QueryBuilder(
    productVariantModel.find(baseFilter).populate("product", "name slug"),
    query
  )
    .search(productVariantSearchableFields)
    .filter()
    .priceRange("price")
    .sort()
    .paginate()
    .fields();

  const result = await variantQuery.modelQuery;
  const meta = await variantQuery.countTotal();

  return { meta, result };
};

const getSingleProductVariantFromDB = async (
  variantId: string,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";

  const variant = await productVariantModel
    .findById(variantId)
    .populate("product", "name slug");

  if (!variant || (!canSeeInactive && !variant.isActive)) {
    throw new AppError(404, "Product variant not found");
  }

  return variant;
};

const updateProductVariantIntoDB = async (
  variantId: string,
  payload: Partial<TProductVariant>
) => {
  const variant = await productVariantModel.findById(variantId);
  if (!variant) {
    throw new AppError(404, "Product variant not found");
  }

  if (payload.sku) {
    payload.sku = await ensureUniqueSku(
      payload.sku.toUpperCase(),
      variantId
    );
  }

  const result = await productVariantModel.findByIdAndUpdate(
    variantId,
    payload,
    { new: true, runValidators: true }
  );

  return result;
};

/**
 * Atomic stock adjustment.
 * quantity > 0 -> restock. quantity < 0 -> deduct (order placed, damage, etc).
 * The $gte guard on the filter makes the deduction atomic at the DB level,
 * so two simultaneous checkouts can't both pass a stale "is there enough
 * stock" check and oversell the last item.
 */
const adjustStockIntoDB = async (variantId: string, quantity: number) => {
  if (quantity < 0) {
    const result = await productVariantModel.findOneAndUpdate(
      { _id: variantId, stock: { $gte: -quantity } },
      { $inc: { stock: quantity } },
      { returnDocument: 'after' }
    );

    if (!result) {
      const exists = await productVariantModel.findById(variantId);
      if (!exists) {
        throw new AppError(404, "Product variant not found");
      }
      throw new AppError(400, "Insufficient stock for this operation");
    }

    return result;
  }

  const result = await productVariantModel.findByIdAndUpdate(
    variantId,
    { $inc: { stock: quantity } },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new AppError(404, "Product variant not found");
  }

  return result;
};

const deactivateProductVariantIntoDB = async (variantId: string) => {
  const variant = await productVariantModel.findById(variantId);
  if (!variant) {
    throw new AppError(404, "Product variant not found");
  }

  const result = await productVariantModel.findByIdAndUpdate(
    variantId,
    { isActive: false },
    { returnDocument: 'after' }
  );

  return result;
};

export const ProductVariantServices = {
  createProductVariantIntoDB,
  getAllProductVariantsFromDB,
  getSingleProductVariantFromDB,
  updateProductVariantIntoDB,
  adjustStockIntoDB,
  deactivateProductVariantIntoDB,
};