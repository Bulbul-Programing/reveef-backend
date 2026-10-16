import mongoose, { Types, type ClientSession } from "mongoose";
import { productModel } from "./product.model.ts";
import { categoryModel } from "../Category/category.model.ts";
import AppError from "../../error/AppError.ts";
import { collectionModel } from "../Collection/collection.model.ts";

import type { TDetailProduct, TProduct } from "./product.interface.ts";
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

  const {
    category,
    color,
    size,
    inStock,
    onSale,
    ...remainingQuery
  } = query;

  const baseFilter: Record<string, any> = {
    isDeleted: false,
    ...(!canManageProducts && { isActive: true }),
  };

  // 1. Filter by category slug
  if (category) {
    const categorySlugs = String(category)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const categories = await categoryModel
      .find({ slug: { $in: categorySlugs } })
      .select("_id")
      .lean();

    const categoryIds = categories.map((item) => item._id);

    baseFilter.category = { $in: categoryIds };
  }

  // 2. Filter by color, size, and stock through variants
  const variantFilter: Record<string, unknown> = {};

  if (color) {
    const colors = String(color)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    variantFilter["color.name"] = {
      $in: colors.map(
        (value) =>
          new RegExp(
            `^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          )
      ),
    };
  }

  if (size) {
    variantFilter.size = {
      $in: String(size)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };
  }

  if (inStock === "true" || inStock === true) {
    variantFilter.stock = { $gt: 0 };
    variantFilter.isActive = true;
  }

  const hasVariantFilters = Object.keys(variantFilter).length > 0;

  if (hasVariantFilters) {
    const matchingVariants = await productVariantModel
      .find(variantFilter)
      .select("product")
      .lean();

    const productIds = [
      ...new Set(
        matchingVariants.map((variant) => String(variant.product))
      ),
    ];

    // No matching variants means no matching products.
    baseFilter._id = {
      $in: productIds.map((id) => new Types.ObjectId(id)),
    };
  }

  // 3. Filter products that are on sale
  if (onSale === "true" || onSale === true) {
    baseFilter.$expr = {
      $and: [
        { $gt: ["$discountPrice", 0] },
        { $lt: ["$discountPrice", "$basePrice"] },
      ],
    };
  }

  // 4. Run the existing QueryBuilder.
  // Custom filter parameters have already been handled above.
  const productQuery = new QueryBuilder(
    productModel
      .find(baseFilter)
      .populate("category", "name slug")
      .populate("collections", "name slug")
      .populate("images", "url alt sortOrder")
      .populate("variants"),
    remainingQuery
  )
    .search(productSearchableFields)
    .filter()
    .priceRange("discountPrice")
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

type TImageInput = { url: string; alt?: string; sortOrder?: number };

type TVariantInput = {
  _id?: string; // present for existing variants, absent for new ones
  sku?: string;
  size: string;
  color: { name: string; hexCode?: string, color: string };
  price: number;
  stock?: number;
  image?: string;
  isActive?: boolean;
};


// Images are matched by url: keep, update alt/order, insert new, delete removed
const syncProductImages = async (
  productId: string,
  images: TImageInput[],
  session: ClientSession
) => {
  const existing = await productImageModel
    .find({ product: productId })
    .session(session);

  const incomingUrls = new Set(images.map((img) => img.url));
  const existingByUrl = new Map(existing.map((img) => [img.url, img]));

  const removedIds = existing
    .filter((img) => !incomingUrls.has(img.url))
    .map((img) => img._id);

  if (removedIds.length) {
    await productImageModel.deleteMany({ _id: { $in: removedIds } }, { session });
  }

  const ops = images.map((img, index) => {
    const sortOrder = img.sortOrder ?? index;
    const found = existingByUrl.get(img.url);

    return found
      ? {
        updateOne: {
          filter: { _id: found._id },
          update: { $set: { alt: img.alt ?? "", sortOrder } },
        },
      }
      : {
        insertOne: {
          document: {
            product: productId,
            url: img.url,
            alt: img.alt ?? "",
            sortOrder,
          },
        },
      };
  });

  if (ops.length) {
    await productImageModel.bulkWrite(ops, { session });
  }
};

// Variants are matched by _id: update existing, create new, delete removed
const syncProductVariants = async (
  product: { _id: Types.ObjectId; name: string },
  variants: TVariantInput[],
  session: ClientSession
) => {
  const existing = await productVariantModel
    .find({ product: product._id })
    .session(session);

  const existingIds = new Set(existing.map((v) => String(v._id)));
  const keptIds = new Set(
    variants.filter((v) => v._id).map((v) => String(v._id))
  );

  // Guard: never touch a variant that belongs to another product
  for (const v of variants) {
    if (v._id && !existingIds.has(String(v._id))) {
      throw new AppError(400, "A variant does not belong to this product");
    }
  }

  // Variants removed in the form.
  // NOTE: if orders/carts reference variant ids, soft-delete here instead
  // (e.g. { isDeleted: true }) so old orders keep resolving.
  const removedIds = existing
    .filter((v) => !keptIds.has(String(v._id)))
    .map((v) => v._id);

  if (removedIds.length) {
    await productVariantModel.deleteMany({ _id: { $in: removedIds } }, { session });
  }

  for (const v of variants) {
    if (v._id) {
      const { _id, image, sku, ...fields } = v;

      await productVariantModel.updateOne(
        { _id },
        {
          $set: {
            ...fields,
            ...(sku ? { sku } : {}),
            ...(image ? { image } : {}),
          },
          // image removed in the form
          ...(image ? {} : { $unset: { image: 1 } }),
        },
        { runValidators: true, session }
      );
    } else {
      const { _id, ...fields } = v;

      await productVariantModel.create(
        [
          {
            ...fields,
            product: product._id,
            // use the same SKU generator as your create service
            sku: fields.sku || generateVariantSku(product._id.toString(), v.size, v.color.name),
          },
        ],
        { session }
      );
    }
  }
};

const updateProductIntoDB = async (
  targetId: string,
  payload: Partial<TDetailProduct>
) => {
  const product = await productModel.findById(targetId);

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  // images/variants live in their own collections, so split them off
  const { images, variants, ...productFields } = payload;

  delete (productFields as Record<string, unknown>).isDeleted;

  if (variants && variants.length === 0) {
    throw new AppError(400, "At least one variant is required");
  }

  /* ------------------------------- references ------------------------------ */


  if (productFields.category || productFields.collections) {
    await validateReferences(
      payload.category ?? product.category,
      (payload.collections ?? product.collections)?.map((collection) =>
        typeof collection === "object" && "_id" in collection
          ? collection._id
          : collection
      )
    );
  }

  /* --------------------------------- pricing -------------------------------- */

  const nextBasePrice = productFields.basePrice ?? product.basePrice;

  const nextDiscountPrice =
    productFields.discountPrice === undefined
      ? product.discountPrice // not sent: keep current
      : productFields.discountPrice === null
        ? undefined // null: discount is being removed
        : productFields.discountPrice;

  if (nextDiscountPrice !== undefined && nextDiscountPrice >= nextBasePrice) {
    throw new AppError(400, "Discount price must be less than base price");
  }

  /* ---------------------------------- slug ---------------------------------- */

  // The form always sends name (and the current slug), so only regenerate the
  // slug when it really changed. Otherwise every edit would change the URL.
  const slugProvided = !!productFields.slug;
  const slugChanged = slugProvided && productFields.slug !== product.slug;
  const nameChanged =
    productFields.name !== undefined && productFields.name !== product.name;

  if (slugChanged || (!slugProvided && nameChanged)) {
    const baseSlug = generateSlug(
      productFields.slug || productFields.name || product.name
    );
    productFields.slug = await ensureUniqueSlug(baseSlug, targetId);
  } else {
    delete productFields.slug; // keep the existing slug
  }

  /* ------------------------------ build update ------------------------------ */

  const { discountPrice, ...rest } = productFields;

  const update: Record<string, unknown> = {
    $set: {
      ...rest,
      ...(typeof discountPrice === "number" ? { discountPrice } : {}),
    },
  };

  if (discountPrice === null) {
    update.$unset = { discountPrice: 1 };
  }

  /* ------------------------ write everything atomically ---------------------- */

  const session = await mongoose.startSession();

  try {
    let updated = null as typeof product | null;

    await session.withTransaction(async () => {
      updated = await productModel.findByIdAndUpdate(targetId, update, {
        new: true,
        runValidators: true,
        session,
      });

      if (images) await syncProductImages(targetId, images, session);
      if (variants) await syncProductVariants(product, variants, session);
    });

    return updated;
  } finally {
    await session.endSession();
  }
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
      isDeleted: true
    },
    {
      new: true,
    }
  );

  await productVariantModel.updateMany(
    { product: targetId },
    { isActive: false, isDeleted: true }
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

