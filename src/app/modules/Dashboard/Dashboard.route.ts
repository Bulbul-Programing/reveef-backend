// dashboard.route.ts  (controller + route in one file; split if you prefer)
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { DashboardQueryError, type TDashboardQuery } from "./Dashboard.utils.ts";
import { dashboardService } from "./Dashboard.service.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";

const getDashboardOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await dashboardService.getDashboardOverview(req.query as TDashboardQuery);
        res.status(200).json({
            success: true,
            message: "Dashboard data retrieved successfully",
            data,
        });
    } catch (error) {
        if (error instanceof DashboardQueryError) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const router = Router();

// Add your auth middleware here, e.g. router.get("/overview", auth("admin", "stuff"), ...)
router.get("/overview", checkAuth("admin", "stuff"), getDashboardOverview);

export const dashboardRoutes = router;

// app.ts -> app.use("/api/v1/dashboard", dashboardRoutes);
//
// GET /api/v1/dashboard/overview?range=1d
// GET /api/v1/dashboard/overview?range=7d
// GET /api/v1/dashboard/overview?range=15d
// GET /api/v1/dashboard/overview?range=30d
// GET /api/v1/dashboard/overview?range=custom&startDate=2026-09-01&endDate=2026-09-20
// GET /api/v1/dashboard/overview?range=year            (current year)
// GET /api/v1/dashboard/overview?range=year&year=2025  (any past year)