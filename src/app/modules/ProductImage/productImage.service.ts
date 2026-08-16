import QueryBuilder from "../../builder/QueryBuilder.ts";
import AppError from "../../error/AppError.ts";
import { productModel } from "../Product/product.model.ts";
import type { TProductImage } from "./productImage.interface.ts";
import { productImageModel } from "./productImage.model.ts";


const productImageSearchableFields = ["alt"];

const createProductImageIntoDB = async (payload: TProductImage) => {
  const product = await productModel.findById(payload.product);
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  let sortOrder = payload.sortOrder;
  if (sortOrder === undefined) {
    const lastImage = await productImageModel
      .findOne({ product: payload.product })
      .sort("-sortOrder");

    const lastSortOrder = lastImage?.sortOrder ?? -1;
    sortOrder = lastSortOrder + 1;
  }

  const result = await productImageModel.create({ ...payload, sortOrder });
  return result;
};

const getAllProductImagesFromDB = async (query: Record<string, unknown>) => {
  // Default to gallery order (sortOrder ascending) instead of QueryBuilder's
  // usual "-createdAt" default. An explicit ?sort= from the caller still wins
  // since it's spread after the default here.
  const queryWithDefaultSort = { sort: "sortOrder", ...query };

  const imageQuery = new QueryBuilder(
    productImageModel.find(),
    queryWithDefaultSort
  )
    .search(productImageSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await imageQuery.modelQuery;
  const meta = await imageQuery.countTotal();

  return { meta, result };
};

const getSingleProductImageFromDB = async (imageId: string) => {
  const image = await productImageModel.findById(imageId);
  if (!image) {
    throw new AppError(404, "Product image not found");
  }
  return image;
};

const updateProductImageIntoDB = async (
  imageId: string,
  payload: Partial<TProductImage>
) => {
  const image = await productImageModel.findById(imageId);
  if (!image) {
    throw new AppError(404, "Product image not found");
  }

  const result = await productImageModel.findByIdAndUpdate(imageId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

/**
 * Bulk reorder for drag-and-drop gallery UIs — one bulkWrite instead of
 * N sequential PATCH calls.
 */
const reorderProductImagesIntoDB = async (
  items: { id: string; sortOrder: number }[]
) => {
  const ids = items.map((item) => item.id);
  const existingCount = await productImageModel.countDocuments({
    _id: { $in: ids },
  });

  if (existingCount !== ids.length) {
    throw new AppError(404, "One or more product images not found");
  }

  await productImageModel.bulkWrite(
    items.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { sortOrder: item.sortOrder } },
      },
    }))
  );

  return null;
};

const deleteProductImageFromDB = async (imageId: string) => {
  const image = await productImageModel.findById(imageId);
  if (!image) {
    throw new AppError(404, "Product image not found");
  }

  const result = await productImageModel.findByIdAndDelete(imageId);
  return result;
};

export const ProductImageServices = {
  createProductImageIntoDB,
  getAllProductImagesFromDB,
  getSingleProductImageFromDB,
  updateProductImageIntoDB,
  reorderProductImagesIntoDB,
  deleteProductImageFromDB,
};