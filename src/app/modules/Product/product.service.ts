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
import { ReviewServices } from "../Review/review.service.ts";

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

  for (;;) {
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

  const result = await productModel.create({
    ...payload,
    slug,
    isDeleted: false,
    isActive: payload.isActive ?? true,
  });

  return result;
};

const generateVariantSku = (
  productId: string,
  size: string,
  colorName: string
) =>
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
 * One admin form submit -> Product + ProductImages + ProductVariants
 * in a single transaction.
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

    const [product] = await productModel.create(
      [
        {
          ...productData,
          slug,
          isDeleted: false,
          isActive: productData.isActive ?? true,
        },
      ],
      { session }
    );

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

const getAllProductsFromDB = async (
  query: Record<string, unknown>,
  requesterRole?: TUserRole
) => {
  const canManageProducts =
    requesterRole === "admin" || requesterRole === "stuff";

  const baseFilter = canManageProducts
    ? {}
    : {
        isActive: true,
        isDeleted: false,
      };

  const productQuery = new QueryBuilder(
    productModel
      .find(baseFilter)
      .populate("category", "name slug")
      .populate("collections", "name slug"),
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

const getSingleProductFromDB = async (
  idOrSlug: string,
  requesterRole?: TUserRole
) => {
  const canManageProducts =
    requesterRole === "admin" || requesterRole === "stuff";

  const isObjectId = Types.ObjectId.isValid(idOrSlug);

  const product = await productModel
    .findOne(isObjectId ? { _id: idOrSlug } : { slug: idOrSlug })
    .populate("category", "name slug")
    .populate("collections", "name slug");

  if (
    !product ||
    (!canManageProducts &&
      (!product.isActive || product.isDeleted))
  ) {
    throw new AppError(404, "Product not found");
  }

  const variantFilter: Record<string, unknown> = {
    product: product._id,
  };

  if (!canManageProducts) {
    variantFilter.isActive = true;
  }

  const variants = await productVariantModel
    .find(variantFilter)
    .sort({ price: 1 });

  const images = await productImageModel
    .find({ product: product._id })
    .sort({ sortOrder: 1 });

  const ratingSummary = await ReviewServices.getProductRatingSummary(
    String(product._id)
  );

  return {
    ...product.toObject(),
    variants,
    images,
    ratingSummary,
  };
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
      payload.collections ?? product.collections
    );
  }

  const nextBasePrice = payload.basePrice ?? product.basePrice;

  const nextDiscountPrice =
    payload.discountPrice !== undefined
      ? payload.discountPrice
      : product.discountPrice;

  if (
    nextDiscountPrice !== undefined &&
    nextDiscountPrice >= nextBasePrice
  ) {
    throw new AppError(400, "Discount price must be less than base price");
  }

  if (payload.name || payload.slug) {
    const baseSlug = generateSlug(
      payload.slug || payload.name || product.name
    );

    payload.slug = await ensureUniqueSlug(baseSlug, targetId);
  }

  delete payload.isDeleted;

  const result = await productModel.findByIdAndUpdate(
    targetId,
    payload,
    {
      new: true,
      runValidators: true,
    }
  );

  return result;
};

const softDeleteProductIntoDB = async (targetId: string) => {
  const product = await productModel.findById(targetId);

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  if (product.isDeleted) {
    throw new AppError(400, "Product is already deleted");
  }

  const result = await productModel.findByIdAndUpdate(
    targetId,
    {
      isDeleted: true,
      isActive: false,
    },
    {
      new: true,
    }
  );

  await productVariantModel.updateMany(
    { product: targetId },
    { isActive: false }
  );

  return result;
};

const restoreProductIntoDB = async (targetId: string) => {
  const product = await productModel.findById(targetId);

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  if (!product.isDeleted) {
    throw new AppError(400, "Product is not deleted");
  }

  const result = await productModel.findByIdAndUpdate(
    targetId,
    {
      isDeleted: false,
      isActive: true,
    },
    {
      new: true,
    }
  );

  await productVariantModel.updateMany(
    { product: targetId },
    { isActive: true }
  );

  return result;
};

const deactivateProductIntoDB = async (targetId: string) => {
  const product = await productModel.findById(targetId);

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  if (product.isDeleted) {
    throw new AppError(400, "Deleted product cannot be deactivated");
  }

  const result = await productModel.findByIdAndUpdate(
    targetId,
    {
      isActive: false,
    },
    {
      new: true,
    }
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
  softDeleteProductIntoDB,
  restoreProductIntoDB,
};

