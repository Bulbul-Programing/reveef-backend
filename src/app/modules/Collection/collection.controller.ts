import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { CollectionServices } from "./collection.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createCollection = catchAsync(async (req: Request, res: Response) => {
  const result = await CollectionServices.createCollectionIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Collection created successfully",
    data: result,
  });
});

const getAllCollections = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await CollectionServices.getAllCollectionsFromDB(
    req.query,
    req.user?.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Collections retrieved successfully",
    meta,
    data: result,
  });
});

const getSingleCollection = catchAsync(async (req: Request, res: Response) => {
  const result = await CollectionServices.getSingleCollectionFromDB(
    req.params.id as string,
    req.user?.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Collection retrieved successfully",
    data: result,
  });
});

const updateCollection = catchAsync(async (req: Request, res: Response) => {
  const result = await CollectionServices.updateCollectionIntoDB(
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Collection updated successfully",
    data: result,
  });
});

const deleteCollection = catchAsync(async (req: Request, res: Response) => {
  await CollectionServices.deleteCollectionFromDB(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Collection deleted successfully",
    data: null,
  });
});

export const CollectionControllers = {
  createCollection,
  getAllCollections,
  getSingleCollection,
  updateCollection,
  deleteCollection,
};