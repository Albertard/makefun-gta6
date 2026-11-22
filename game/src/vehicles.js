// Cars: arcade driving physics for the player, road-graph traffic that follows the
// streets, and police interceptors that chase the player down. A car is a circle for
// collisions (radius 15) and a 44x22 body for drawing.

import { CAR_MODELS } from './config.js';
import { randomInt, randomPick, randomRange } from './random.js';

const RADIUS = 15;
const LANE = 18;

let nextId = 1;

export function createCar(modelIndex, x, y, angle, kind) {
  const model = CAR_MODELS[modelIndex];
  return {
    id: nextId,
    model: modelIndex,
    name: model.name,
    color: model.color,
    roof: model.roof,
    x, y, angle,
    speed: 0,
    health: 100,
    kind, // 'traffic' | 'parked' | 'player' | 'police'
    wrecked: false,
    driver: kind === 'traffic' ? 'traffic' : null,
    routeKey: null,
    prevKey: null,
    stuck: 0,
    sirenPhase: 0,
    brake: false,
    onRoad: true,
  };
}

function forward(car) {
  return { x: Math.cos(car.angle), y: Math.sin(car.angle) };
}

function turnToward(car, targetAngle, rate, dt) {
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  car.angle += step;
  return Math.abs(diff);
}

/** The player's car: throttle, steering that bites harder the faster you go, handbrake. */
export function stepPlayerCar(car, dt, input, city, world) {
  const model = CAR_MODELS[car.model];
  const move = input.moveVector();
  const throttle = -move.y;
  const steer = move.x;
  const wasSpeed = car.speed;

  if (throttle > 0) car.speed += model.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= model.accel * 1.6 * dt; // brake
    else car.speed -= model.accel * 0.55 * dt; // reverse
  } else {
    car.speed -= car.speed * 0.7 * dt; // coast
  }
  if (input.handbrake) {
    car.speed -= car.speed * 1.8 * dt;
    car.angle += steer * 2.4 * Math.sign(car.speed || 1) * dt;
    if (Math.abs(car.speed) > 120) world.addSkid(car.x, car.y, car.angle);
  } else {
    car.angle += steer * model.grip * (car.speed / model.top) * dt * (car.speed >= 0 ? 1 : -1);
  }
  car.speed = Math.max(-model.top * 0.45, Math.min(model.top, car.speed));

  const f = forward(car);
  car.x += f.x * car.speed * dt;
  car.y += f.y * car.speed * dt;
  car.onRoad = city.isRoad(car.x, car.y);
  if (!car.onRoad) car.speed -= car.speed * 1.1 * dt; // grass and sand drag

  car.brake = throttle < 0 && wasSpeed > 20;
  if (city.collideCircle(car, RADIUS)) {
    if (Math.abs(car.speed) > 160) {
      damageCar(world, car, Math.abs(car.speed) / 14);
      world.audio.crash(Math.abs(car.speed) / 500);
      world.addSparks(car.x, car.y, 8);
    }
    car.speed *= 0.45;
  }
  return car;
}

/** A traffic car: drive to its next intersection, in the right-hand lane, and slow down
 *  for the car ahead. It never leaves the roads. */
export function stepTrafficCar(car, dt, city, world, random) {
  const model = CAR_MODELS[car.model];
  if (!car.routeKey) {
    car.routeKey = city.nearestNode(car.x, car.y);
    car.prevKey = null;
  }
  const node = city.keyToNode(car.routeKey);
  const dx = node.x - car.x;
  const dy = node.y - car.y;
  const dist = Math.hypot(dx, dy);
  // Lane offset: keep right of the direction of travel.
  const laneX = node.x + (-dy / (dist || 1)) * LANE * -1;
  const laneY = node.y + (dx / (dist || 1)) * LANE * -1;
  const targetAngle = Math.atan2(laneY - car.y, laneX - car.x);
  turnToward(car, targetAngle, 2.2, dt);

  // Slow for the car ahead, and for the turn at the intersection.
  let targetSpeed = randomRange(random, 150, 220);
  if (dist < 90) targetSpeed = 90;
  for (const other of world.cars) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 78 && side < 26) targetSpeed = Math.min(targetSpeed, 40);
  }
  if (car.speed < targetSpeed) car.speed += 300 * dt;
  else car.speed -= 500 * dt;
  const f = forward(car);
  car.x += f.x * car.speed * dt;
  car.y += f.y * car.speed * dt;

  if (dist < 34) {
    car.prevKey = car.routeKey;
    car.routeKey = city.nextNode(car.routeKey, car.prevKey, random);
  }
  if (Math.abs(car.speed) < 6) {
    car.stuck += dt;
    if (car.stuck > 4) {
      // Jammed behind a wreck or a crowd: respawn the car elsewhere on the roads.
      const p = city.randomRoadPoint(random);
      car.x = p.x;
      car.y = p.y;
      car.speed = 0;
      car.stuck = 0;
      car.routeKey = city.nearestNode(p.x, p.y);
      car.prevKey = null;
    }
  } else {
    car.stuck = 0;
  }
}

/** A police interceptor: steer straight at the player and ram. It cuts corners. */
export function stepPoliceCar(car, dt, target, city, world) {
  const model = CAR_MODELS[car.model];
  const targetAngle = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = turnToward(car, targetAngle, 3.1, dt);
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  const want = dist < 120 ? model.top * 0.55 : model.top * 0.92;
  if (car.speed < want) car.speed += model.accel * 1.15 * dt;
  else car.speed -= 400 * dt;
  if (diff > 1.2) car.speed -= 200 * dt; // slow down for a hard turn
  const f = forward(car);
  car.x += f.x * car.speed * dt;
  car.y += f.y * car.speed * dt;
  car.sirenPhase += dt;
  if (city.collideCircle(car, RADIUS)) car.speed *= 0.5;
}

/** Push overlapping cars apart and trade a little speed; hard hits damage both. */
export function collideCars(cars, world) {
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.wrecked) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = RADIUS * 2;
      if (dist >= min || dist < 0.01) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const push = (min - dist) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = Math.abs(a.speed - b.speed);
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg;
      b.speed = avg;
      if (rel > 220) {
        damageCar(world, a, rel / 40);
        damageCar(world, b, rel / 40);
        world.addSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
        world.audio.crash(rel / 700);
      }
    }
  }
}

export function damageCar(world, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    world.explode(car.x, car.y, 90);
  } else if (car.health < 35 && Math.random() < 0.3) {
    world.addSmoke(car.x, car.y, 1);
  }
}

export function nearestCar(cars, x, y, maxDist, kinds) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    if (kinds && !kinds.includes(car.kind)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

export function spawnTraffic(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = city.randomRoadPoint(random);
    const vertical = city.roadsX.includes(p.x);
    const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    const car = createCar(randomInt(random, 0, 6), p.x, p.y, angle, 'traffic');
    car.routeKey = city.nearestNode(p.x, p.y);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = city.randomParkedSpot(random);
    if (spot) {
      const car = createCar(randomInt(random, 0, 6), spot.x, spot.y, spot.angle, 'parked');
      cars.push(car);
      continue;
    }
    const p = city.randomRoadPoint(random);
    const vertical = city.roadsX.includes(p.x);
    const off = (random() < 0.5 ? -1 : 1) * 30;
    const car = createCar(randomInt(random, 0, 6), vertical ? p.x + off : p.x, vertical ? p.y : p.y + off, vertical ? Math.PI / 2 : 0, 'parked');
    cars.push(car);
  }
  return cars;
}

export function randomCarColor(random) {
  return randomPick(random, CAR_MODELS.map((m) => m.color));
}
