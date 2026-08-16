import { Query, type QueryFilter } from "mongoose";

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  search(searchableFields: string[]) {
    const searchTerm = this.query.searchTerm as string;

    if (searchTerm) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      } as QueryFilter<T>);
    }

    return this;
  }

  /**
   * Handles every remaining query param generically.
   * Any comma-separated value is treated as a multi-select and turned
   * into a MongoDB $in — e.g. ?size=S,M,L or ?category=<id1>,<id2>
   * or ?color=red,blue — no per-field method needed.
   */
  filter() {
    const queryObj: Record<string, unknown> = { ...this.query };

    const excludeFields: string[] = [
      "searchTerm",
      "sort",
      "limit",
      "page",
      "fields",
      "minPrice",
      "maxPrice",
    ];
    excludeFields.forEach((field) => delete queryObj[field]);

    const finalFilter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(queryObj)) {
      if (typeof value === "string" && value.includes(",")) {
        finalFilter[key] = { $in: value.split(",") };
      } else {
        finalFilter[key] = value;
      }
    }

    this.modelQuery = this.modelQuery.find(finalFilter as QueryFilter<T>);
    return this;
  }

  /**
   * Generic price-range filter. Pass the field name since price may live
   * on different models (Product.basePrice, ProductVariant.price, etc.)
   * Usage: ?minPrice=500&maxPrice=2000
   */
  priceRange(field: string = "price") {
    const min = this.query.minPrice ? Number(this.query.minPrice) : undefined;
    const max = this.query.maxPrice ? Number(this.query.maxPrice) : undefined;

    if (min !== undefined || max !== undefined) {
      const priceFilter: Record<string, Record<string, number>> = {
        [field]: {},
      };
      if (min !== undefined) priceFilter[field].$gte = min;
      if (max !== undefined) priceFilter[field].$lte = max;

      this.modelQuery = this.modelQuery.find(priceFilter as QueryFilter<T>);
    }

    return this;
  }

  sort() {
    const sortBy =
      (this.query.sort as string)?.split(",").join(" ") || "-createdAt";
    this.modelQuery = this.modelQuery.sort(sortBy);
    return this;
  }

  paginate() {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }

  /**
   * Alternative to paginate() for "load more" style storefront grids —
   * returns everything from page 1 through the current page in one go.
   */
  infinityScroll() {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;
    this.modelQuery = this.modelQuery.limit(limit * page);
    return this;
  }

  fields() {
    const fields =
      (this.query.fields as string)?.split(",").join(" ") || "-__v";
    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }

  async countTotal() {
    const filter = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(filter);

    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;
    const totalPage = Math.ceil(total / limit) || 1;

    return { page, limit, total, totalPage };
  }
}

export default QueryBuilder;