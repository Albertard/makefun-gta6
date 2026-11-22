// Bullets and explosions. A bullet flies straight until it hits a building, a car, a
// pedestrian or the player; an explosion hurts everything in its radius and shakes
// the camera.

import { killPed } from './peds.js';
import { damageCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function fireBullet(world, x, y, angle, speed, damage, from) {
  world.bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.6,
    damage,
    from, // 'player' | 'gang' | 'cop'
  });
  world.addMuzzle(x, y, angle);
}

export function stepBullets(world, dt) {
  const bullets = world.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && world.city.pointInBuilding(b.x, b.y)) {
      world.addSparks(b.x, b.y, 3);
      dead = true;
    }
    if (!dead && b.from !== 'player') {
      // Enemy bullets can hit the player (on foot) or the player's car.
      const p = world.player;
      if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 13) {
        hurtPlayer(world, b.damage);
        dead = true;
      } else if (p.inCar && Math.hypot(p.inCar.x - b.x, p.inCar.y - b.y) < 18) {
        damageCar(world, p.inCar, b.damage * 0.5);
        dead = true;
      }
    }
    if (!dead) {
      for (const ped of world.peds) {
        if (ped.dead) continue;
        if (b.from === 'gang' && ped.gang) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 11) {
          if (ped.gang) {
            ped.hp -= b.damage;
            if (ped.hp <= 0) killPed(world, ped, b.from === 'player');
          } else {
            killPed(world, ped, b.from === 'player');
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const cop of world.police.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 12 && b.from === 'player') {
          cop.hp -= b.damage;
          if (cop.hp <= 0) {
            cop.dead = true;
            world.addCrime(1.5, 'Cop down');
            world.addMessage('Officer down! The heat is on.');
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of world.cars) {
        if (car.wrecked) continue;
        if (b.from === 'player' && car === world.player.inCar) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 18) {
          damageCar(world, car, b.damage * 0.4);
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

export function explode(world, x, y, radius) {
  world.addExplosion(x, y, radius);
  world.audio.crash(1);
  world.shake = Math.min(14, world.shake + 10);
  world.dangerPoint = { x, y, t: 2 };
  const p = world.player;
  const pd = Math.hypot(p.x - x, p.y - y);
  if (pd < radius && !p.inCar) hurtPlayer(world, 55);
  if (p.inCar && Math.hypot(p.inCar.x - x, p.inCar.y - y) < radius + 10) {
    damageCar(world, p.inCar, 45);
  }
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) killPed(world, ped, false);
  }
  for (const car of world.cars) {
    if (car.wrecked) continue;
    if (Math.hypot(car.x - x, car.y - y) < radius + 8) damageCar(world, car, 60);
  }
}
