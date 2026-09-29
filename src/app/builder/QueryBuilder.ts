import { Query, type QueryFilter } from "mongoose";

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(
    modelQuery: Query<T[], T>,
    query: Record<string, unknown>
  ) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  search(searchableFields: string[]) {
    const searchTerm = this.query.searchTerm as string;

    if (searchTerm) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      } as QueryFilter<T>);
    }

    return this;
  }

  /**
   * Handles every remaining query param generically.
   *
   * Example:
   * ?size=S,M,L
   * ?category=id1,id2
   * ?color=red,blue
   */
  filter() {
    const queryObj: Record<string, unknown> = {
      ...this.query,
    };

    const excludeFields: string[] = [
      "searchTerm",
      "sortBy",
      "limit",
      "page",
      "fields",
      "minPrice",
      "maxPrice",
      "dateFrom",
      "dateTo",
      "dateRange",
      "year",
    ];

    excludeFields.forEach((field) => delete queryObj[field]);

    const finalFilter: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(queryObj)) {
      if (
        typeof value === "string" &&
        value.includes(",")
      ) {
        finalFilter[key] = {
          $in: value.split(","),
        };
      } else {
        finalFilter[key] = value;
      }
    }

    this.modelQuery = this.modelQuery.find(
      finalFilter as QueryFilter<T>
    );

    return this;
  }

  /**
   * Generic price-range filter.
   *
   * Example:
   * ?minPrice=500&maxPrice=2000
   */
  priceRange(field: string = "price") {
    const min = this.query.minPrice
      ? Number(this.query.minPrice)
      : undefined;

    const max = this.query.maxPrice
      ? Number(this.query.maxPrice)
      : undefined;

    if (min !== undefined || max !== undefined) {
      const priceFilter: Record<
        string,
        Record<string, number>
      > = {
        [field]: {},
      };

      if (min !== undefined) {
        priceFilter[field].$gte = min;
      }

      if (max !== undefined) {
        priceFilter[field].$lte = max;
      }

      this.modelQuery = this.modelQuery.find(
        priceFilter as QueryFilter<T>
      );
    }

    return this;
  }

  /**
   * Generic date-range filter.
   *
   * Supported:
   *
   * ?dateFrom=2026-09-01&dateTo=2026-09-26
   *
   * ?dateRange=24h
   * ?dateRange=7d
   * ?dateRange=30d
   * ?dateRange=year
   *
   * ?year=2025
   *
   * field can be:
   * createdAt
   * updatedAt
   * deliveredAt
   * etc.
   */
  dateRange(field: string = "createdAt") {
    const dateFrom = this.query.dateFrom as string | undefined;
    const dateTo = this.query.dateTo as string | undefined;
    const dateRange = this.query.dateRange as string | undefined;
    const selectedYear = this.query.year
      ? Number(this.query.year)
      : undefined;

    const now = new Date();

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    /*
     * --------------------------------
     * Custom date range
     * --------------------------------
     */

    if (dateFrom) {
      startDate = new Date(dateFrom);

      if (Number.isNaN(startDate.getTime())) {
        startDate = undefined;
      }
    }

    if (dateTo) {
      endDate = new Date(dateTo);

      if (!Number.isNaN(endDate.getTime())) {
        // Include the complete selected date
        endDate.setHours(23, 59, 59, 999);
      } else {
        endDate = undefined;
      }
    }

    /*
     * --------------------------------
     * Preset date range
     * --------------------------------
     */

    if (dateRange) {
      switch (dateRange) {
        case "24h":
          startDate = new Date(
            now.getTime() -
            24 * 60 * 60 * 1000
          );

          endDate = now;
          break;

        case "7d":
          startDate = new Date(
            now.getTime() -
            7 * 24 * 60 * 60 * 1000
          );

          endDate = now;
          break;

        case "30d":
          startDate = new Date(
            now.getTime() -
            30 * 24 * 60 * 60 * 1000
          );

          endDate = now;
          break;

        case "year":
          startDate = new Date(
            now.getFullYear(),
            0,
            1
          );

          endDate = now;
          break;

        default:
          break;
      }
    }

    /*
     * --------------------------------
     * Selected year
     * --------------------------------
     */

    if (
      selectedYear !== undefined &&
      !Number.isNaN(selectedYear)
    ) {
      startDate = new Date(
        selectedYear,
        0,
        1
      );

      endDate = new Date(
        selectedYear + 1,
        0,
        1
      );

      // Make end date exclusive
      endDate.setMilliseconds(
        endDate.getMilliseconds() - 1
      );
    }

    /*
     * --------------------------------
     * Build MongoDB filter
     * --------------------------------
     */

    if (startDate || endDate) {
      const dateFilter: Record<
        string,
        Record<string, Date>
      > = {
        [field]: {},
      };

      if (startDate) {
        dateFilter[field].$gte = startDate;
      }

      if (endDate) {
        dateFilter[field].$lte = endDate;
      }

      this.modelQuery = this.modelQuery.find(
        dateFilter as QueryFilter<T>
      );
    }

    return this;
  }

  sort() {
    const sortBy =
      (this.query.sortBy as string)
        ?.split(",")
        .join(" ") || "-createdAt";

    this.modelQuery = this.modelQuery.sort(sortBy);

    return this;
  }

  paginate() {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery
      .skip(skip)
      .limit(limit);

    return this;
  }

  /**
   * Alternative to paginate() for "load more" style
   * storefront grids.
   */
  infinityScroll() {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;

    this.modelQuery = this.modelQuery.limit(
      limit * page
    );

    return this;
  }

  fields() {
    const fields =
      (this.query.fields as string)
        ?.split(",")
        .join(" ") || "-__v";

    this.modelQuery = this.modelQuery.select(fields);

    return this;
  }

  async countTotal() {
    const filter = this.modelQuery.getFilter();

    const total =
      await this.modelQuery.model.countDocuments(
        filter
      );

    const page =
      Number(this.query.page) || 1;

    const limit =
      Number(this.query.limit) || 10;

    const totalPage =
      Math.ceil(total / limit) || 1;

    return {
      page,
      limit,
      total,
      totalPage,
    };
  }
}

export default QueryBuilder;