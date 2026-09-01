import { Types } from "mongoose";
import { categoryModel } from "./category.model.ts";
import type { TCategory } from "./category.interface.ts";
import AppError from "../../error/AppError.ts";
import type { TUserRole } from "../User/user.interface.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";
import { productModel } from "../Product/product.model.ts";

const categorySearchableFields = ["name", "description"];

const generateSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

// Only checks against non-deleted categories, so a slug freed up by a
// soft-deleted category can be reused by a new one.
const ensureUniqueSlug = async (baseSlug: string, excludeId?: string) => {
  let slug = baseSlug;
  let suffix = 1;

  for (; ;) {
    const existing = await categoryModel.findOne({
      slug,
      isDeleted: false,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
};

const createCategoryIntoDB = async (payload: TCategory) => {
  if (payload.parent) {
    const parentExists = await categoryModel.findOne({
      _id: payload.parent,
      isDeleted: false,
    });
    if (!parentExists) {
      throw new AppError(404, "Parent category not found");
    }
  }

  const baseSlug = generateSlug(payload.slug || payload.name);
  const slug = await ensureUniqueSlug(baseSlug);

  const result = await categoryModel.create({ ...payload, slug });
  return result;
};

/**
 * requesterRole is only ever populated when checkAuth has run on the route
 * (i.e. the admin/stuff management routes). Public storefront routes call
 * this without a role, so inactive categories stay hidden by default.
 * isDeleted: false is always enforced regardless of role — soft-deleted
 * categories never appear in normal listings for anyone.
 */
const getAllCategoriesFromDB = async (
  query: Record<string, unknown>,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const baseFilter = {
    isDeleted: false,
    ...(canSeeInactive ? {} : { isActive: true }),
  };

  const categoryQuery = new QueryBuilder(
    categoryModel.find(baseFilter).populate("parent", "name slug"),
    query
  )
    .search(categorySearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await categoryQuery.modelQuery;
  const meta = await categoryQuery.countTotal();

  return { meta, result };
};

const getSingleCategoryFromDB = async (
  idOrSlug: string,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const isObjectId = Types.ObjectId.isValid(idOrSlug);

  const category = await categoryModel
    .findOne({
      ...(isObjectId ? { _id: idOrSlug } : { slug: idOrSlug }),
      isDeleted: false,
    })
    .populate("parent", "name slug");

  if (!category || (!canSeeInactive && !category.isActive)) {
    throw new AppError(404, "Category not found");
  }

  return category;
};

const updateCategoryIntoDB = async (
  targetId: string,
  payload: Partial<TCategory>
) => {
  const category = await categoryModel.findOne({
    _id: targetId,
    isDeleted: false,
  });
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  if (payload.parent) {
    if (String(payload.parent) === targetId) {
      throw new AppError(400, "A category cannot be its own parent");
    }
    const parentExists = await categoryModel.findOne({
      _id: payload.parent,
      isDeleted: false,
    });
    if (!parentExists) {
      throw new AppError(404, "Parent category not found");
    }
  }

  if (payload.name || payload.slug) {
    const baseSlug = generateSlug(payload.slug || payload.name || category.name);
    payload.slug = await ensureUniqueSlug(baseSlug, targetId);
  }

  const result = await categoryModel.findByIdAndUpdate(targetId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

// Soft delete: flips isDeleted (and isActive, so it also drops out of any
// storefront listing immediately) instead of removing the document.
const deleteCategoryFromDB = async (targetId: string) => {
  const category = await categoryModel.findOne({
    _id: targetId,
    isDeleted: false,
  });
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  const hasChildren = await categoryModel.exists({
    parent: targetId,
    isDeleted: false,
  });
  if (hasChildren) {
    throw new AppError(
      400,
      "This category has subcategories. Reassign or remove them first"
    );
  }

  const isUsedByProducts = await productModel.exists({
    category: targetId,
    isDeleted: false,
  });
  if (isUsedByProducts) {
    throw new AppError(
      400,
      "This category is assigned to one or more products. Reassign or remove them first"
    );
  }

  const result = await categoryModel.findByIdAndUpdate(
    targetId,
    { isDeleted: true, isActive: false },
    { new: true }
  );

  return result;
};

export const CategoryServices = {
  createCategoryIntoDB,
  getAllCategoriesFromDB,
  getSingleCategoryFromDB,
  updateCategoryIntoDB,
  deleteCategoryFromDB,
};