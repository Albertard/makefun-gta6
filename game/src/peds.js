// Pedestrians: they stroll the sidewalks, scatter when a car or a gunshot comes near,
// and get knocked down (then get up and run). Gang members are peds with a gun and a
// grudge: they close in and shoot.

import { randomPick, randomRange } from './random.js';

const SHIRT_COLORS = ['#e8e4d8', '#c95f6e', '#4d7ea8', '#e8b923', '#7d9b8a', '#b56b7d', '#8a8f98', '#e06a2e'];
const SKIN_COLORS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];

export function createPed(city, random, opts = {}) {
  const p = city.randomSidewalkPoint(random);
  return {
    x: opts.x ?? p.x,
    y: opts.y ?? p.y,
    angle: randomRange(random, 0, Math.PI * 2),
    speed: 0,
    state: opts.gang ? 'gang' : 'walk', // walk | flee | down | gang | dead
    color: randomPick(random, SHIRT_COLORS),
    skin: randomPick(random, SKIN_COLORS),
    target: null,
    wait: randomRange(random, 0, 2),
    downTimer: 0,
    shootTimer: randomRange(random, 0.5, 1.5),
    hp: opts.gang ? 60 : 30,
    gang: !!opts.gang,
    dead: false,
  };
}

export function spawnPeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(createPed(city, random));
  return peds;
}

export function spawnGang(world, x, y, count) {
  const gang = [];
  for (let i = 0; i < count; i += 1) {
    const ped = createPed(world.city, world.random, { gang: true, x: x + randomRange(world.random, -60, 60), y: y + randomRange(world.random, -60, 60) });
    gang.push(ped);
    world.peds.push(ped);
  }
  return gang;
}

function pickWalkTarget(ped, city, random) {
  const p = city.randomSidewalkPoint(random);
  ped.target = p;
}

/** One step for every pedestrian: stroll, flee, lie down, or (gang) hunt the player. */
export function stepPeds(peds, dt, world) {
  const player = world.player;
  const danger = world.dangerPoint; // {x, y} of the latest gunshot or crash, or null
  for (const ped of peds) {
    if (ped.dead) continue;
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.target = null;
      }
      continue;
    }
    if (ped.gang) {
      const dx = player.x - ped.x;
      const dy = player.y - ped.y;
      const dist = Math.hypot(dx, dy);
      ped.angle = Math.atan2(dy, dx);
      if (dist > 240) {
        ped.speed = 150;
        ped.x += (dx / dist) * ped.speed * dt;
        ped.y += (dy / dist) * ped.speed * dt;
      } else if (dist < 90) {
        ped.speed = 60;
        ped.x -= (dx / dist) * ped.speed * dt;
        ped.y -= (dy / dist) * ped.speed * dt;
      } else {
        ped.speed = 0;
      }
      ped.shootTimer -= dt;
      if (ped.shootTimer <= 0 && dist < 420 && !player.inCar) {
        ped.shootTimer = randomRange(world.random, 0.9, 1.6);
        world.fireBullet(ped.x, ped.y, ped.angle + randomRange(world.random, -0.12, 0.12), 700, 8, 'gang');
        world.audio.shot();
      }
      world.city.collideCircle(ped, 10);
      continue;
    }
    // Civilians: flee from danger, otherwise stroll between sidewalk points.
    const dx = danger ? ped.x - danger.x : 0;
    const dy = danger ? ped.y - danger.y : 0;
    const dangerDist = danger ? Math.hypot(dx, dy) : Infinity;
    if (dangerDist < 260) {
      ped.state = 'flee';
      ped.speed = 230;
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (dangerDist > 420) ped.state = 'walk';
    } else {
      ped.state = 'walk';
      if (!ped.target) {
        if (ped.wait > 0) {
          ped.wait -= dt;
          ped.speed = 0;
          continue;
        }
        pickWalkTarget(ped, world.city, world.random);
      }
      const tx = ped.target.x - ped.x;
      const ty = ped.target.y - ped.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 12) {
        ped.target = null;
        ped.wait = randomRange(world.random, 0, 3);
        ped.speed = 0;
        continue;
      }
      ped.angle = Math.atan2(ty, tx);
      ped.speed = 62;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    world.city.collideCircle(ped, 10);
  }
}

/** Knock a pedestrian down: a crime if the player did it, and the ped runs when it recovers. */
export function knockDown(world, ped, byPlayer) {
  if (ped.dead || ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 2.5;
  ped.speed = 0;
  world.addStars(ped.x, ped.y);
  if (byPlayer) {
    world.addCrime(1.0, 'Hit a pedestrian');
    world.dangerPoint = { x: ped.x, y: ped.y, t: 2 };
  }
}

export function killPed(world, ped, byPlayer) {
  if (ped.dead) return;
  ped.dead = true;
  ped.state = 'dead';
  world.addBlood(ped.x, ped.y);
  if (ped.gang) {
    world.stats.kills += 1;
    if (byPlayer) {
      world.player.money += 25;
      world.addMessage('Gang member down. +$25');
    }
  } else if (byPlayer) {
    world.addCrime(1.0, 'Pedestrian killed');
    world.dangerPoint = { x: ped.x, y: ped.y, t: 2 };
  }
}
