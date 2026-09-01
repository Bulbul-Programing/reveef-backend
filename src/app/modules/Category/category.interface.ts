export type TCategory = {
    name: string;
    slug: string;
    description?: string;
    parent?: string;
    imageUrl?: string;
    isActive?: boolean;
    isDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
};