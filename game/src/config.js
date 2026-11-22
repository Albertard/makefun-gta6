// SOLMARA — Sun City Crime. Shared tuning, world size, car models, districts and weapons.
// One place for every number the rest of the game reads, so a balance change is one edit.

export const STEP = 1 / 60;
export const WORLD_W = 3400;
export const WORLD_H = 2600;
export const ROAD_W = 76;
export const SAVE_KEY = 'solmara-save-v1';

/** Sun-soaked palette: warm asphalt, cream sidewalks, terracotta and teal buildings. */
export const PALETTE = {
  grass: '#7fae5a',
  park: '#69a34e',
  sand: '#e8d29a',
  water: '#2e7fa8',
  deepWater: '#1f5f84',
  asphalt: '#3d3a38',
  asphaltDark: '#353231',
  sidewalk: '#c9bda6',
  line: '#e8d44d',
  curb: '#8d8271',
};

export const DISTRICTS = [
  { name: 'Old Harbor', x0: 0, y0: 0, x1: 700, y1: 900, tint: '#b98a5e' },
  { name: 'North Hills', x0: 700, y0: 0, x1: 2150, y1: 500, tint: '#7fae5a' },
  { name: 'Downtown', x0: 700, y0: 500, x1: 2150, y1: 1750, tint: '#8d99ae' },
  { name: 'The Strip', x0: 2150, y0: 0, x1: 3400, y1: 1400, tint: '#c96f9e' },
  { name: 'Marina Bay', x0: 0, y0: 1750, x1: 3400, y1: 2400, tint: '#5ea8a0' },
  { name: 'South Beach', x0: 0, y0: 2400, x1: 3400, y1: 2600, tint: '#e8d29a' },
];

/** Car models: name, body colour, roof colour, top speed, acceleration, grip. */
export const CAR_MODELS = [
  { name: 'Comet', color: '#e8b923', roof: '#2b2b2b', top: 560, accel: 520, grip: 2.6 },
  { name: 'Vagabond', color: '#4d7ea8', roof: '#d8d3c8', top: 470, accel: 420, grip: 2.3 },
  { name: 'Tulip', color: '#c95f6e', roof: '#f2e6d8', top: 430, accel: 400, grip: 2.4 },
  { name: 'Bison', color: '#6b7a5e', roof: '#3a3a3a', top: 400, accel: 360, grip: 1.9 },
  { name: 'Sunrunner', color: '#e06a2e', roof: '#1f1f1f', top: 590, accel: 560, grip: 2.7 },
  { name: 'Cab', color: '#f2c230', roof: '#f2c230', top: 450, accel: 410, grip: 2.3 },
  { name: 'Hauler', color: '#8a8f98', roof: '#4a4a4a', top: 380, accel: 330, grip: 1.7 },
  { name: 'Interceptor', color: '#1d2f4d', roof: '#f2f2f2', top: 620, accel: 600, grip: 2.8 },
];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 25, range: 34, rate: 0.35, auto: false },
  pistol: { name: 'P9 Pistol', damage: 34, range: 420, rate: 0.22, auto: false, bulletSpeed: 900, ammoMax: 60 },
};

/** Wanted stars 0-5: how many police cars and foot cops each level fields. */
export const WANTED_TABLE = [
  { cars: 0, cops: 0 },
  { cars: 0, cops: 2 },
  { cars: 1, cops: 2 },
  { cars: 2, cops: 3 },
  { cars: 3, cops: 4 },
  { cars: 4, cops: 5 },
];

export const MONEY_START = 50;
export const HEALTH_MAX = 100;
