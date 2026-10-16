// customerDashboard.route.ts  (controller + route)
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { customerDashboardService } from "./CustomerDashboard.service.ts";
import { DashboardQueryError, type TDashboardQuery } from "../Dashboard/Dashboard.utils.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";

const handle = async (userId: string | undefined, req: Request, res: Response, next: NextFunction) => {
    try {
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const data = await customerDashboardService.getCustomerDashboard(userId, req.query as TDashboardQuery);
        res.status(200).json({ success: true, message: "Customer dashboard retrieved successfully", data });
    } catch (error: any) {
        if (error instanceof DashboardQueryError) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

// The logged-in customer's own dashboard.
// ADJUST: read the user id the way your auth middleware sets it (req.user._id, req.user.userId, ...)
const getMyDashboard = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    return handle(String(user?._id ?? user?.userId ?? user?.id ?? ""), req, res, next);
};

// Admin view of any customer's dashboard
const getCustomerDashboardByAdmin = (req: Request, res: Response, next: NextFunction) =>
    handle(String(req.params.userId), req, res, next);

const router = Router();

// router.get("/me", auth("customer", "admin", "stuff"), getMyDashboard);
// router.get("/:userId", auth("admin", "stuff"), getCustomerDashboardByAdmin);
router.get("/me", checkAuth("customer"), getMyDashboard);
router.get("/:userId",checkAuth("admin", "stuff"), getCustomerDashboardByAdmin);

export const customerDashboardRoutes = router;

// app.ts -> app.use("/api/v1/dashboard/customer", customerDashboardRoutes);
//
// GET /api/v1/dashboard/customer/me?range=30d
// GET /api/v1/dashboard/customer/me?range=custom&startDate=2026-09-01&endDate=2026-09-20
// GET /api/v1/dashboard/customer/me?range=year&year=2025
// GET /api/v1/dashboard/customer/<userId>?range=7d      (admin only)