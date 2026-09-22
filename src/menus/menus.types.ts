export type DishOptionValue = string | number | boolean;

export type Dish = {
  id: string;
  name: string;
  priceCents: number;
  vegetarian: boolean;
  spicy: boolean;
  available: boolean;
  options: Record<string, DishOptionValue>;
};

export type DishHash = Omit<Dish, 'id'>;

export type Menu = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  dishes: Dish[];
};
