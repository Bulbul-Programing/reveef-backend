import { Router } from "express";
import { UserValidation } from "./user.validation.ts";
import { UserControllers } from "./user.controller.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";

const router = Router();

router.post(
  "/register",
  validateRequest(UserValidation.createUserValidationSchema),
  UserControllers.createUser
);

router.get("/", checkAuth("admin", "stuff"), UserControllers.getAllUsers);

router.get(
  "/me",
  checkAuth("customer", "admin", "stuff"),
  UserControllers.getMyProfile
);

router.patch(
  "/change-password",
  checkAuth("customer", "admin", "stuff"),
  validateRequest(UserValidation.changePasswordValidationSchema),
  UserControllers.changePassword
);

router.get(
  "/:id",
  checkAuth("customer", "admin", "stuff"),
  UserControllers.getSingleUser
);

router.patch(
  "/:id",
  checkAuth("customer", "admin", "stuff"),
  validateRequest(UserValidation.updateUserValidationSchema),
  UserControllers.updateUser
);

router.patch(
  "/:id/role",
  checkAuth("admin"),
  validateRequest(UserValidation.updateUserRoleValidationSchema),
  UserControllers.updateUserRole
);

router.patch(
  "/:id/status",
  checkAuth("admin"),
  validateRequest(UserValidation.updateUserStatusValidationSchema),
  UserControllers.updateUserStatus
);

export const UserRoutes = router;