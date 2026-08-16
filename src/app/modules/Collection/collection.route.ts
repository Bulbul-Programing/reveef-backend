import { Router } from "express";
import { CollectionControllers } from "./collection.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { CollectionValidation } from "./collection.validation.ts";
const router = Router();

// Public storefront routes — active collections only, no auth required
router.get("/", CollectionControllers.getAllCollections);
router.get("/:id", CollectionControllers.getSingleCollection);

// Admin / stuff management routes
router.post(
  "/",
  checkAuth("admin", "stuff"),
  validateRequest(CollectionValidation.createCollectionValidationSchema),
  CollectionControllers.createCollection
);

router.patch(
  "/:id",
  checkAuth("admin", "stuff"),
  validateRequest(CollectionValidation.updateCollectionValidationSchema),
  CollectionControllers.updateCollection
);

router.delete(
  "/:id",
  checkAuth("admin"),
  CollectionControllers.deleteCollection
);

export const collectionRouter = router;