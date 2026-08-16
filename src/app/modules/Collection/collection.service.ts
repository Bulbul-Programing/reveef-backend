import { Types } from "mongoose";
import { collectionModel } from "./collection.model.ts";
import type { TCollection } from "./collection.interface.ts";
import type { TUserRole } from "../User/user.interface.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";
import AppError from "../../error/AppError.ts";

const collectionSearchableFields = ["name", "description"];

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
    const existing = await collectionModel.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
};

const createCollectionIntoDB = async (payload: TCollection) => {
  const baseSlug = generateSlug(payload.slug || payload.name);
  const slug = await ensureUniqueSlug(baseSlug);

  const result = await collectionModel.create({ ...payload, slug });
  return result;
};

/**
 * requesterRole is only populated when checkAuth has run (admin/stuff
 * management routes). Public storefront routes call this without a role,
 * so inactive collections (e.g. an unpublished seasonal drop) stay hidden.
 */
const getAllCollectionsFromDB = async (
  query: Record<string, unknown>,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const baseFilter = canSeeInactive ? {} : { isActive: true };

  const collectionQuery = new QueryBuilder(
    collectionModel.find(baseFilter),
    query
  )
    .search(collectionSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await collectionQuery.modelQuery;
  const meta = await collectionQuery.countTotal();

  return { meta, result };
};

const getSingleCollectionFromDB = async (
  idOrSlug: string,
  requesterRole?: TUserRole
) => {
  const canSeeInactive = requesterRole === "admin" || requesterRole === "stuff";
  const isObjectId = Types.ObjectId.isValid(idOrSlug);

  const collection = await collectionModel.findOne(
    isObjectId ? { _id: idOrSlug } : { slug: idOrSlug }
  );

  if (!collection || (!canSeeInactive && !collection.isActive)) {
    throw new AppError(404, "Collection not found");
  }

  return collection;
};

const updateCollectionIntoDB = async (
  targetId: string,
  payload: Partial<TCollection>
) => {
  const collection = await collectionModel.findById(targetId);
  if (!collection) {
    throw new AppError(404, "Collection not found");
  }

  if (payload.name || payload.slug) {
    const baseSlug = generateSlug(
      payload.slug || payload.name || collection.name
    );
    payload.slug = await ensureUniqueSlug(baseSlug, targetId);
  }

  const result = await collectionModel.findByIdAndUpdate(targetId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteCollectionFromDB = async (targetId: string) => {
  const collection = await collectionModel.findById(targetId);
  if (!collection) {
    throw new AppError(404, "Collection not found");
  }

  // TODO: once Product references a collection, guard against deleting
  // one that's still in use, e.g.:
  // const isUsedByProducts = await productModel.exists({ collection: targetId });
  // if (isUsedByProducts) throw new AppError(400, "Collection is in use by products");

  const result = await collectionModel.findByIdAndDelete(targetId);
  return result;
};

export const CollectionServices = {
  createCollectionIntoDB,
  getAllCollectionsFromDB,
  getSingleCollectionFromDB,
  updateCollectionIntoDB,
  deleteCollectionFromDB,
};