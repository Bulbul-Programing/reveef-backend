import express from 'express';
import { addressRouter } from '../modules/Address/address.route.ts';
import { categoryRouter } from '../modules/Category/category.route.ts';
import { collectionRouter } from '../modules/Collection/collection.route.ts';
import { couponRouter } from '../modules/Coupon/coupon.route.ts';
import { heroRouter } from '../modules/Hero/hero.route.ts';
import { orderRouter } from '../modules/Order/order.route.ts';
import { orderItemRouter } from '../modules/OrderItem/orderItem.route.ts';
import { productImageRouter } from '../modules/ProductImage/productImage.route.ts';
import { productVariantRouter } from '../modules/ProductVariant/productVariant.route.ts';
import { reviewRouter } from '../modules/Review/review.route.ts';
import { UserRoutes } from '../modules/User/user.route.ts';
import { loginRoute } from '../modules/auth/auth.routes.ts';
import { productRouter } from '../modules/Product/product.route.ts';

type TModuleRoute = {
    path: string,
    route: express.Router
}

const router = express.Router()

const moduleRoutes: TModuleRoute[] = [
    {
        path: '/user',
        route: UserRoutes
    },
    {
        path: '/auth',
        route: loginRoute
    },
    {
        path: '/address',
        route: addressRouter
    },
    {
        path: '/category',
        route: categoryRouter
    },
    {
        path: '/collection',
        route: collectionRouter
    },
    {
        path: '/product',
        route: productRouter
    },
    {
        path: '/productImage',
        route: productImageRouter
    },
    {
        path: '/productVariant',
        route: productVariantRouter
    },
    {
        path: '/coupon',
        route: couponRouter
    },
    {
        path: '/order',
        route: orderRouter
    },
    {
        path: '/orderItem',
        route: orderItemRouter
    },
    {
        path: '/hero',
        route: heroRouter
    },
    {
        path: '/review',
        route: reviewRouter
    },
]

moduleRoutes.forEach((route) => router.use(route.path, route.route))

export default router