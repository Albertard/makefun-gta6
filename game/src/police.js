// The Solmara Police Department: interceptors that spawn on the roads around the
// player and ram, and foot cops who run the player down, shoot at three stars and
// up, and arrest the player on foot when they get close enough for long enough.

import { WANTED_TABLE } from './config.js';
import { randomRange } from './random.js';
import { createCar, stepPoliceCar } from './vehicles.js';

const POLICE_MODEL = 7; // Interceptor

export function createPolice() {
  return { cars: [], cops: [] };
}

function spawnSpotNear(world, distance) {
  const p = world.player;
  const angle = randomRange(world.random, 0, Math.PI * 2);
  const x = p.x + Math.cos(angle) * distance;
  const y = p.y + Math.sin(angle) * distance;
  return { x: Math.max(80, Math.min(3320, x)), y: Math.max(80, Math.min(2520, y)) };
}

function spawnPoliceCar(world) {
  const spot = spawnSpotNear(world, randomRange(world.random, 520, 720));
  const road = world.city.randomRoadPoint(world.random);
  const car = createCar(POLICE_MODEL, road.x, road.y, 0, 'police');
  car.x = spot.x;
  car.y = spot.y;
  car.sirenPhase = randomRange(world.random, 0, 2);
  world.police.cars.push(car);
  world.cars.push(car);
}

function spawnCop(world) {
  const spot = spawnSpotNear(world, randomRange(world.random, 380, 560));
  world.police.cops.push({
    x: spot.x, y: spot.y, angle: 0, speed: 0, hp: 50,
    state: 'chase', arrestTimer: 0, shootTimer: randomRange(world.random, 0.5, 1.5),
    dead: false,
  });
}

function stepCop(cop, dt, world) {
  const player = world.player;
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  const speed = 205;
  cop.x += (dx / (dist || 1)) * speed * dt;
  cop.y += (dy / (dist || 1)) * speed * dt;
  world.city.collideCircle(cop, 10);

  // Arrest: a cop standing next to the player on foot for 1.2 s makes the bust.
  if (!player.inCar && dist < 30) {
    cop.arrestTimer += dt;
    if (cop.arrestTimer > 1.2) world.busted();
  } else {
    cop.arrestTimer = 0;
  }

  // At three stars and up the cops shoot, on foot or at the player's car.
  if (world.wanted.stars >= 3 && dist < 380) {
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0) {
      cop.shootTimer = randomRange(world.random, 1.1, 1.8);
      world.fireBullet(cop.x, cop.y, cop.angle + randomRange(world.random, -0.15, 0.15), 650, 9, 'cop');
      world.audio.shot();
    }
  }
}

export function stepPolice(world, dt) {
  const wanted = world.wanted;
  const table = WANTED_TABLE[wanted.stars];
  const police = world.police;

  // Keep the field at the level's strength: spawn what is missing, drop the far away.
  while (police.cars.length < table.cars) spawnPoliceCar(world);
  while (police.cops.length < table.cops) spawnCop(world);
  const px = world.player.x;
  const py = world.player.y;
  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    const car = police.cars[i];
    if (Math.hypot(car.x - px, car.y - py) > 1400) {
      police.cars.splice(i, 1);
      const ci = world.cars.indexOf(car);
      if (ci >= 0) world.cars.splice(ci, 1);
    }
  }
  for (let i = police.cops.length - 1; i >= 0; i -= 1) {
    const cop = police.cops[i];
    if (cop.dead) {
      police.cops.splice(i, 1);
      continue;
    }
    if (Math.hypot(cop.x - px, cop.y - py) > 1200) police.cops.splice(i, 1);
  }

  for (const car of police.cars) {
    if (car.wrecked) continue;
    stepPoliceCar(car, dt, world.player.inCar || world.player, world.city, world);
  }
  for (const cop of police.cops) stepCop(cop, dt, world);

  // Boxed in: the player's car stopped with an interceptor on its bumper is a bust.
  const playerCar = world.player.inCar;
  if (playerCar && Math.abs(playerCar.speed) < 15) {
    for (const car of police.cars) {
      if (Math.hypot(car.x - playerCar.x, car.y - playerCar.y) < 70) {
        world.boxedTimer += dt;
        if (world.boxedTimer > 2) world.busted();
        break;
      }
    }
  } else {
    world.boxedTimer = 0;
  }
}
