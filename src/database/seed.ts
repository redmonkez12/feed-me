import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { OrderStatus } from '../orders/orders.types';
import { customers, drivers, menuItems, orderItems, orders, restaurants } from './schema';

type DishFixture = {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
};

type RestaurantFixture = {
  id: string;
  name: string;
  dishes: DishFixture[];
};

type DriverFixture = {
  id: string;
  name: string;
  online: boolean;
  busy: boolean;
};

type OrderFixture = {
  id: string;
  restaurantId: string;
  customerId: string;
  status: OrderStatus;
  items: Array<{
    dishId: string;
    quantity: number;
  }>;
};

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return databaseUrl;
}

const DATABASE_URL = getDatabaseUrl();

async function readFixture<T>(fileName: string): Promise<T> {
  const path = resolve(process.cwd(), 'data', fileName);
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function fixtureUuid(scope: string, id: string): string {
  const hex = createHash('sha256').update(`food-delivery:${scope}:${id}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function seed(): Promise<void> {
  const [restaurantFixtures, driverFixtures, orderFixtures] = await Promise.all([
    readFixture<RestaurantFixture[]>('menus.json'),
    readFixture<DriverFixture[]>('drivers.json'),
    readFixture<OrderFixture[]>('orders.json'),
  ]);

  const dishById = new Map(
    restaurantFixtures.flatMap((restaurant) =>
      restaurant.dishes.map((dish) => [dish.id, { ...dish, restaurantId: restaurant.id }] as const),
    ),
  );
  const customerIds = [...new Set(orderFixtures.map((order) => order.customerId))];

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(customers)
        .values(
          customerIds.map((id) => ({
            id: fixtureUuid('customer', id),
            email: `${id}@food-delivery.test`,
            name: `Seed customer ${id}`,
          })),
        )
        .onConflictDoUpdate({
          target: customers.id,
          set: {
            email: sql`excluded.email`,
            name: sql`excluded.name`,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(restaurants)
        .values(
          restaurantFixtures.map((restaurant) => ({
            id: fixtureUuid('restaurant', restaurant.id),
            name: restaurant.name,
            isOpen: true,
          })),
        )
        .onConflictDoUpdate({
          target: restaurants.id,
          set: {
            name: sql`excluded.name`,
            isOpen: sql`excluded.is_open`,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(menuItems)
        .values(
          [...dishById.values()].map((dish) => ({
            id: fixtureUuid('dish', dish.id),
            restaurantId: fixtureUuid('restaurant', dish.restaurantId),
            name: dish.name,
            priceCents: dish.priceCents,
            isAvailable: dish.available,
          })),
        )
        .onConflictDoUpdate({
          target: menuItems.id,
          set: {
            restaurantId: sql`excluded.restaurant_id`,
            name: sql`excluded.name`,
            priceCents: sql`excluded.price_cents`,
            isAvailable: sql`excluded.is_available`,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(drivers)
        .values(
          driverFixtures.map((driver) => ({
            id: fixtureUuid('driver', driver.id),
            name: driver.name,
            status: !driver.online
              ? ('offline' as const)
              : driver.busy
                ? ('busy' as const)
                : ('available' as const),
            completedDeliveries: 0,
          })),
        )
        .onConflictDoUpdate({
          target: drivers.id,
          set: {
            name: sql`excluded.name`,
            status: sql`excluded.status`,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(orders)
        .values(
          orderFixtures.map((order) => {
            const totalCents = order.items.reduce((total, item) => {
              const dish = dishById.get(item.dishId);

              if (!dish) {
                throw new Error(`Unknown dish ${item.dishId} in order ${order.id}`);
              }

              return total + dish.priceCents * item.quantity;
            }, 0);

            return {
              id: fixtureUuid('order', order.id),
              customerId: fixtureUuid('customer', order.customerId),
              restaurantId: fixtureUuid('restaurant', order.restaurantId),
              status: order.status,
              deliveryAddress: `Seed address for ${order.customerId}`,
              totalCents,
            };
          }),
        )
        .onConflictDoUpdate({
          target: orders.id,
          set: {
            customerId: sql`excluded.customer_id`,
            restaurantId: sql`excluded.restaurant_id`,
            status: sql`excluded.status`,
            deliveryAddress: sql`excluded.delivery_address`,
            totalCents: sql`excluded.total_cents`,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(orderItems)
        .values(
          orderFixtures.flatMap((order) =>
            order.items.map((item) => {
              const dish = dishById.get(item.dishId);

              if (!dish) {
                throw new Error(`Unknown dish ${item.dishId} in order ${order.id}`);
              }

              return {
                id: fixtureUuid('order-item', `${order.id}:${item.dishId}`),
                orderId: fixtureUuid('order', order.id),
                menuItemId: fixtureUuid('dish', item.dishId),
                quantity: item.quantity,
                unitPriceCents: dish.priceCents,
              };
            }),
          ),
        )
        .onConflictDoUpdate({
          target: orderItems.id,
          set: {
            orderId: sql`excluded.order_id`,
            menuItemId: sql`excluded.menu_item_id`,
            quantity: sql`excluded.quantity`,
            unitPriceCents: sql`excluded.unit_price_cents`,
          },
        });
    });

    console.log(
      `Seeded ${customerIds.length} customers, ${restaurantFixtures.length} restaurants, ${dishById.size} menu items, ${driverFixtures.length} drivers, ${orderFixtures.length} orders, and ${orderFixtures.flatMap((order) => order.items).length} order items.`,
    );
  } finally {
    await client.end();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
