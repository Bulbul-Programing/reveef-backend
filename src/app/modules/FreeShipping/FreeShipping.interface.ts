export interface TFreeShipping {
    minimumPurchase: number;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TUpdateFreeShipping {
    minimumPurchase?: number;
    isActive?: boolean;
}