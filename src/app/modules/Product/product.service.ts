import mongoose, { Types } from "mongoose";
import { productModel } from "./product.model.ts";
import { categoryModel } from "../Category/category.model.ts";
import AppError from "../../error/AppError.ts";
import { collectionModel } from "../Collection/collection.model.ts";
import type { TProduct } from "./product.interface.ts";
import type { TProductImage } from "../ProductImage/productImage.interface.ts";
import type { TProductVariant } from "../ProductVariant/productVariant.interface.ts";
import { productImageModel } from "../ProductImage/productImage.model.ts";
import { productVariantModel } from "../ProductVariant/productVariant.model.ts";
import type { TUserRole } from "../User/user.interface.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";

const productSearchableFields = ["name", "description"];

const generateSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const ensureUniqueSlug = async (baseSlug: string, excludeId?: string) => {
  let slug = baseSlug;
  let suffix = 1;

  for (; ;) {
    const existing = await productModel.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
};

const validateReferences = async (
  categoryId: Types.ObjectId | string,
  collectionIds?: (Types.ObjectId | string)[]
) => {
  const category = await categoryModel.findById(categoryId);
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  if (collectionIds?.length) {
    const count = await collectionModel.countDocuments({
      _id: { $in: collectionIds },
    });
    if (count !== collectionIds.length) {
      throw new AppError(404, "One or more collections not found");
    }
  }
};

const createProductIntoDB = async (payload: TProduct) => {
  await validateReferences(payload.category, payload.collections);

  if (
    payload.discountPrice !== undefined &&
    payload.discountPrice >= payload.basePrice
  ) {
    throw new AppError(400, "Discount price must be less than base price");
  }

  const baseSlug = generateSlug(payload.slug || payload.name);
  const slug = await ensureUniqueSlug(baseSlug);

  const result = await productModel.create({ ...payload, slug });
  return result;
};

const generateVariantSku = (productId: string, size: string, colorName: string) =>
  `${productId.slice(-6)}-${size}-${colorName}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

type TCreateProductWithDetailsPayload = TProduct & {
  images?: Pick<TProductImage, "url" | "alt" | "sortOrder">[];
  variants: Omit<
    TProductVariant,
    "_id" | "product" | "createdAt" | "updatedAt"
  >[];
};

/**
 * One admin form submit -> Product + its ProductImages + its ProductVariants,
 * created atomically in a single transaction. If anything fails (a bad
 * reference, a duplicate SKU caught by the unique index, a DB hiccup), the
 * whole thing rolls back — you never end up with an orphaned product that
 * has no variants and therefore can't be sold.
 *
 * IMPORTANT: transactions require MongoDB to be running as a replica set
 * (Atlas already is, by default). A standalone local `mongod` will throw
 * "Transaction numbers are only allowed on a replica set member or mongos."
 */
const createProductWithDetailsIntoDB = async (
  payload: TCreateProductWithDetailsPayload
) => {
  const { images = [], variants, ...productData } = payload;

  await validateReferences(productData.category, productData.collections);

  if (
    productData.discountPrice !== undefined &&
    productData.discountPrice >= productData.basePrice
  ) {
    throw new AppError(400, "Discount price must be less than base price");
  }

  const baseSlug = generateSlug(productData.slug || productData.name);
  const slug = await ensureUniqueSlug(baseSlug);

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [product] = await productModel.create([{ ...productData, slug }], {
      session,
    });

    let createdImages: unknown[] = [];
    if (images.length) {
      createdImages = await productImageModel.insertMany(
        images.map((image, index) => ({
          ...image,
          product: product._id,
          sortOrder: image.sortOrder ?? index,
        })),
        { session }
      );
    }

    // Duplicate SKUs are caught by the unique index on `sku` — that throw
    // aborts the transaction below, and your existing handleDupleacteError
    // formats the response, so no manual pre-check is needed here.
    const createdVariants = await productVariantModel.insertMany(
      variants.map((variant) => ({
        ...variant,
        product: product._id,
        sku:
          variant.sku ||
          generateVariantSku(
            String(product._id),
            variant.size,
            variant.color.name
          ),
      })),
      { session }
    );

    await session.commitTransaction();

    return {
      ...product.toObject(),
      images: createdImages,
      variants: createdVariants,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * requesterRole is only populated when checkAuth has run (admin/stuff
 * management routes). Public storefront calls this without a role, so
 * deactivated products stay hidden from browsing/search.
 */
const getAllProductsFromDB = async (
  query: Record<string, unknown>,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const baseFilter = canSeeInactive ? {} : { isActive: true };

  const productQuery = new QueryBuilder(
    productModel
      .find(baseFilter)
      .populate("category", "name slug")
      .populate("collections", "name slug")
      .populate("images", "url alt sortOrder"),
    query
  )
    .search(productSearchableFields)
    .filter()
    .priceRange("basePrice")
    .sort()
    .paginate()
    .fields();

  const result = await productQuery.modelQuery;
  const meta = await productQuery.countTotal();

  return { meta, result };
};

/**
 * Product detail also pulls in its variants (size/color/price/stock),
 * since a product detail page needs those to render buy options.
 */
const getSingleProductFromDB = async (
  idOrSlug: string,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const isObjectId = Types.ObjectId.isValid(idOrSlug);

  const product = await productModel
    .findOne(isObjectId ? { _id: idOrSlug } : { slug: idOrSlug })
    .populate("category", "name slug")
    .populate("collections", "name slug")
    // .populate("images", "url");

  if (!product || (!canSeeInactive && !product.isActive)) {
    throw new AppError(404, "Product not found");
  }

  const variantFilter: Record<string, unknown> = { product: product._id };
  if (!canSeeInactive) {
    variantFilter.isActive = true;
  }

  const variants = await productVariantModel
    .find(variantFilter)
    .sort({ price: 1 })
    .select("color sku size price stock image")
    ;

  const images = await productImageModel
    .find({ product: product._id })
    .sort({ sortOrder: 1 })
    .select("url alt sortOrder")
    ;

  return { ...product.toObject(), variants, images };
};

const updateProductIntoDB = async (
  targetId: string,
  payload: Partial<TProduct>
) => {
  const product = await productModel.findById(targetId);
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  if (payload.category || payload.collections) {
    await validateReferences(
      payload.category ?? product.category,
      payload.collections
    );
  }

  const nextBasePrice = payload.basePrice ?? product.basePrice;
  const nextDiscountPrice =
    payload.discountPrice !== undefined
      ? payload.discountPrice
      : product.discountPrice;

  if (nextDiscountPrice !== undefined && nextDiscountPrice >= nextBasePrice) {
    throw new AppError(400, "Discount price must be less than base price");
  }

  if (payload.name || payload.slug) {
    const baseSlug = generateSlug(
      payload.slug || payload.name || product.name
    );
    payload.slug = await ensureUniqueSlug(baseSlug, targetId);
  }

  const result = await productModel.findByIdAndUpdate(targetId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};


const deactivateProductIntoDB = async (targetId: string) => {
  const product = await productModel.findById(targetId);
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  const result = await productModel.findByIdAndUpdate(
    targetId,
    { isActive: false },
    { returnDocument: 'after' }
  );

  await productVariantModel.updateMany(
    { product: targetId },
    { isActive: false }
  );

  return result;
};

export const ProductServices = {
  createProductIntoDB,
  createProductWithDetailsIntoDB,
  getAllProductsFromDB,
  getSingleProductFromDB,
  updateProductIntoDB,
  deactivateProductIntoDB,
};