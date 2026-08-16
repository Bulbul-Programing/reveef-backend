import { Types } from "mongoose";
import { categoryModel } from "./category.model.ts";
import type { TCategory } from "./category.interface.ts";
import AppError from "../../error/AppError.ts";
import type { TUserRole } from "../User/user.interface.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";

const categorySearchableFields = ["name", "description"];

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
    const existing = await categoryModel.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
};

const createCategoryIntoDB = async (payload: TCategory) => {
  if (payload.parent) {
    const parentExists = await categoryModel.findById(payload.parent);
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
 */
const getAllCategoriesFromDB = async (
  query: Record<string, unknown>,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const baseFilter = canSeeInactive ? {} : { isActive: true };

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
    .findOne(isObjectId ? { _id: idOrSlug } : { slug: idOrSlug })
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
  const category = await categoryModel.findById(targetId);
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  if (payload.parent) {
    if (String(payload.parent) === targetId) {
      throw new AppError(400, "A category cannot be its own parent");
    }
    const parentExists = await categoryModel.findById(payload.parent);
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

const deleteCategoryFromDB = async (targetId: string) => {
  const category = await categoryModel.findById(targetId);
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  const hasChildren = await categoryModel.exists({ parent: targetId });
  if (hasChildren) {
    throw new AppError(
      400,
      "This category has subcategories. Reassign or remove them first"
    );
  }

  // TODO: once Product references a category, block/soft-delete here too:
  // const isUsedByProducts = await productModel.exists({ category: targetId });
  // if (isUsedByProducts) throw new AppError(400, "Category is in use by products");

  const result = await categoryModel.findByIdAndDelete(targetId);
  return result;
};

export const CategoryServices = {
  createCategoryIntoDB,
  getAllCategoriesFromDB,
  getSingleCategoryFromDB,
  updateCategoryIntoDB,
  deleteCategoryFromDB,
};