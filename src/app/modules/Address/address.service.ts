import QueryBuilder from "../../builder/QueryBuilder.ts";
import AppError from "../../error/AppError.ts";
import type { TRequester } from "../User/user.interface.ts";
import type { TAddress } from "./address.interface.ts";
import { addressModel } from "./address.model.ts";


const addressSearchableFields = [
  "fullName",
  "phoneNumber",
  "address",
  "district",
  "upazila",
  "postalCode",
];

const createAddressIntoDB = async (
  userId: string,
  payload: Omit<TAddress, "user" | "isDefault"> & { isDefault?: boolean }
) => {
  const existingCount = await addressModel.countDocuments({ user: userId });
  const isFirstAddress = existingCount === 0;

  // First address is always the default, regardless of what was sent.
  const shouldBeDefault = isFirstAddress || payload.isDefault === true;

  if (shouldBeDefault) {
    await addressModel.updateMany(
      { user: userId, isDefault: true },
      { isDefault: false }
    );
  }

  const result = await addressModel.create({
    ...payload,
    user: userId,
    isDefault: shouldBeDefault,
  });

  return result;
};

/**
 * Guest-checkout address resolution: if this user already has an address
 * with the same phoneNumber + district + upazila, reuse it as-is (no
 * updates to fullName/address/postalCode even if slightly different —
 * treat the (phone, district, upazila) triple as the identity of "this
 * delivery location"). Any of those three differing creates a new address
 * record instead of overwriting, so past orders keep pointing at the
 * address they actually shipped to.
 */
const findOrCreateAddressIntoDB = async (
  userId: string,
  payload: Omit<TAddress, "user" | "isDefault"> & { isDefault?: boolean }
) => {
  const existing = await addressModel.findOne({
    user: userId,
    phoneNumber: payload.phoneNumber,
    district: payload.district,
    upazila: payload.upazila,
    address : payload.address
  });

  if (existing) {
    return existing;
  }

  return createAddressIntoDB(userId, payload);
};

/**
 * Used both for "my addresses" (userId = req.user.id) and the admin/stuff
 * lookup of a specific customer's addresses (userId = req.params.userId).
 * Authorization for which caller is allowed to do which is enforced at
 * the route/controller level, not here.
 */
const getAddressesByUserFromDB = async (
  userId: string,
  query: Record<string, unknown>
) => {
  // Default address surfaces first, then most recently added.
  const queryWithDefaultSort = { sort: "-isDefault,-createdAt", ...query };

  const addressQuery = new QueryBuilder(
    addressModel.find({ user: userId }),
    queryWithDefaultSort
  )
    .search(addressSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await addressQuery.modelQuery;
  const meta = await addressQuery.countTotal();

  return { meta, result };
};

const getSingleAddressFromDB = async (
  addressId: string,
  requester: TRequester
) => {
  const address = await addressModel.findById(addressId);
  if (!address) {
    throw new AppError(404, "Address not found");
  }

  const isOwner = String(address.user) === requester.id;
  const isStaff = requester.role === "admin" || requester.role === "stuff";

  if (!isOwner && !isStaff) {
    throw new AppError(403, "You are not allowed to view this address");
  }

  return address;
};

const updateAddressIntoDB = async (
  addressId: string,
  payload: Partial<TAddress>,
  userId: string
) => {
  const address = await addressModel.findById(addressId);
  if (!address) {
    throw new AppError(404, "Address not found");
  }

  // Owner-only, even for admin/stuff — editing someone else's saved
  // address isn't a permission worth granting even to staff.
  if (String(address.user) !== userId) {
    throw new AppError(403, "You are not allowed to update this address");
  }

  if (payload.isDefault === true) {
    await addressModel.updateMany(
      { user: userId, _id: { $ne: addressId }, isDefault: true },
      { isDefault: false }
    );
  }

  // Don't allow unsetting the only default with no replacement — pick a
  // new default first. (Deleting the address, below, handles this
  // automatically instead, since there the address is leaving entirely.)
  if (payload.isDefault === false && address.isDefault) {
    throw new AppError(
      400,
      "Set a different address as default before unsetting this one"
    );
  }

  const result = await addressModel.findByIdAndUpdate(addressId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteAddressFromDB = async (addressId: string, userId: string) => {
  const address = await addressModel.findById(addressId);
  if (!address) {
    throw new AppError(404, "Address not found");
  }

  if (String(address.user) !== userId) {
    throw new AppError(403, "You are not allowed to delete this address");
  }

  await addressModel.findByIdAndDelete(addressId);

  // If the deleted address was the default, promote the most recently
  // added remaining one so the user isn't left without a default.
  if (address.isDefault) {
    const nextAddress = await addressModel
      .findOne({ user: userId })
      .sort("-createdAt");

    if (nextAddress) {
      nextAddress.isDefault = true;
      await nextAddress.save();
    }
  }

  return null;
};

export const AddressServices = {
  createAddressIntoDB,
  findOrCreateAddressIntoDB,
  getAddressesByUserFromDB,
  getSingleAddressFromDB,
  updateAddressIntoDB,
  deleteAddressFromDB,
};