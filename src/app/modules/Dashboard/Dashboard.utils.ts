
export const DASHBOARD_TZ = "Asia/Dhaka";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TZ_OFFSET = 6 * HOUR;

export type TGranularity = "hour" | "day" | "month";

export type TDashboardQuery = {
    range?: string; // 1d | 7d | 15d | 30d | custom | year
    startDate?: string; // YYYY-MM-DD (custom)
    endDate?: string; // YYYY-MM-DD (custom)
    year?: string; // YYYY (year)
};

export type TResolvedRange = {
    key: string;
    start: Date;
    end: Date;
    prevStart: Date;
    prevEnd: Date;
    granularity: TGranularity;
};

export class DashboardQueryError extends Error {
    statusCode = 400;
}

// Mongo $dateToString formats matching `formatKey` below
export const MONGO_FORMAT: Record<TGranularity, string> = {
    hour: "%Y-%m-%d %H:00",
    day: "%Y-%m-%d",
    month: "%Y-%m",
};

const DAY_RANGES: Record<string, number> = { "1d": 1, "7d": 7, "15d": 15, "30d": 30 };

const startOfDayDhaka = (d: Date) =>
    new Date(Math.floor((d.getTime() + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET);

const startOfHour = (d: Date) => new Date(Math.floor(d.getTime() / HOUR) * HOUR);

const parseDhakaDate = (value: string | undefined, label: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new DashboardQueryError(`${label} is required in YYYY-MM-DD format`);
    }
    const d = new Date(`${value}T00:00:00+06:00`);
    if (Number.isNaN(d.getTime())) throw new DashboardQueryError(`${label} is not a valid date`);
    return d;
};

export const resolveRange = (query: TDashboardQuery): TResolvedRange => {
    const now = new Date();
    let key = String(query.range ?? "7d").toLowerCase();
    if (/^\d+$/.test(key)) key = `${key}d`; // "7" -> "7d"

    // ---- Preset day ranges ---------------------------------------------
    if (DAY_RANGES[key]) {
        const days = DAY_RANGES[key];

        if (days === 1) {
            // rolling last 24 hours, hourly buckets
            const start = new Date(startOfHour(now).getTime() - 23 * HOUR);
            return {
                key,
                start,
                end: now,
                prevStart: new Date(start.getTime() - 24 * HOUR),
                prevEnd: new Date(start.getTime() - 1),
                granularity: "hour",
            };
        }

        // calendar days, including today
        const start = new Date(startOfDayDhaka(now).getTime() - (days - 1) * DAY);
        return {
            key,
            start,
            end: now,
            prevStart: new Date(start.getTime() - days * DAY),
            prevEnd: new Date(start.getTime() - 1),
            granularity: "day",
        };
    }

    // ---- Full year -----------------------------------------------------
    if (key === "year") {
        const currentYear = new Date(now.getTime() + TZ_OFFSET).getUTCFullYear();
        const year = query.year ? Number(query.year) : currentYear;
        if (!Number.isInteger(year) || year < 2000 || year > currentYear) {
            throw new DashboardQueryError(`year must be between 2000 and ${currentYear}`);
        }
        const start = new Date(`${year}-01-01T00:00:00+06:00`);
        const yearEnd = new Date(new Date(`${year + 1}-01-01T00:00:00+06:00`).getTime() - 1);
        const end = yearEnd < now ? yearEnd : now;

        const prevStart = new Date(`${year - 1}-01-01T00:00:00+06:00`);
        const prevYearEnd = new Date(start.getTime() - 1);
        const prevCandidate = new Date(prevStart.getTime() + (end.getTime() - start.getTime()));
        return {
            key,
            start,
            end,
            prevStart,
            prevEnd: prevCandidate < prevYearEnd ? prevCandidate : prevYearEnd,
            granularity: "month",
        };
    }

    // ---- Custom range --------------------------------------------------
    if (key === "custom") {
        const start = parseDhakaDate(query.startDate, "startDate");
        const endDay = parseDhakaDate(query.endDate, "endDate");
        const end = new Date(endDay.getTime() + DAY - 1);

        if (end < start) throw new DashboardQueryError("endDate must be on or after startDate");

        const spanDays = Math.ceil((end.getTime() - start.getTime()) / DAY);
        if (spanDays > 366) throw new DashboardQueryError("Custom range cannot exceed 366 days");

        const length = end.getTime() - start.getTime() + 1;
        return {
            key,
            start,
            end,
            prevStart: new Date(start.getTime() - length),
            prevEnd: new Date(start.getTime() - 1),
            granularity: spanDays <= 2 ? "hour" : spanDays <= 92 ? "day" : "month",
        };
    }

    throw new DashboardQueryError("range must be one of: 1d, 7d, 15d, 30d, custom, year");
};

// ---- Buckets (fills empty periods with zeros so charts have no gaps) ------

const formatKey = (shifted: Date, g: TGranularity) => {
    const iso = shifted.toISOString();
    if (g === "hour") return `${iso.slice(0, 13).replace("T", " ")}:00`;
    if (g === "day") return iso.slice(0, 10);
    return iso.slice(0, 7);
};

export const buildBuckets = (start: Date, end: Date, g: TGranularity): string[] => {
    const keys: string[] = [];
    const endShifted = end.getTime() + TZ_OFFSET;
    let cursor = new Date(start.getTime() + TZ_OFFSET);

    while (cursor.getTime() <= endShifted && keys.length < 1000) {
        keys.push(formatKey(cursor, g));
        if (g === "hour") cursor = new Date(cursor.getTime() + HOUR);
        else if (g === "day") cursor = new Date(cursor.getTime() + DAY);
        else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    return keys;
};

// ---- Number helpers ---------------------------------------------------------

export const round = (n: number, digits = 2) => {
    const f = 10 ** digits;
    return Math.round((Number(n) || 0) * f) / f;
};

export const percentChange = (current: number, previous: number): number | null => {
    if (!previous) return current ? null : 0; // null = "new" (no previous data)
    return round(((current - previous) / previous) * 100);
};

export const metric = (current: number, previous: number) => {
    const changePercent = percentChange(current, previous);
    return {
        current: round(current),
        previous: round(previous),
        changePercent,
        trend: current > previous ? "up" : current < previous ? "down" : "flat",
    };
};

export const share = (value: number, total: number) => (total ? round((value / total) * 100) : 0);