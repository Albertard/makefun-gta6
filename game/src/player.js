// The player on foot: WASD movement with a run, facing the mouse when armed, punches
// and pistol shots, and getting in and out of cars. Stealing a car with a driver in it
// pulls the driver out and earns a wanted star.

import { HEALTH_MAX, MONEY_START, WEAPONS } from './config.js';
import { createPed, killPed, knockDown } from './peds.js';
import { nearestCar } from './vehicles.js';

const WALK_SPEED = 175;
const RUN_SPEED = 265;

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    health: HEALTH_MAX,
    money: MONEY_START,
    weapon: 'fists',
    ammo: 0,
    inCar: null,
    punchTimer: 0,
    shootTimer: 0,
    invulnerable: 0,
    speed: 0,
  };
}

/** Step the player on foot. `actions` are the one-shot ACTION_* flags main.js took
 *  this frame; the world already used the ENTER bit for jobs and for getting out. */
export function stepPlayer(player, dt, input, world, actions) {
  if (player.inCar) return;
  const move = input.moveVector();
  const speed = input.run ? RUN_SPEED : WALK_SPEED;
  player.speed = Math.hypot(move.x, move.y) * speed;
  player.x += move.x * speed * dt;
  player.y += move.y * speed * dt;
  world.city.collideCircle(player, 12);

  // Face the mouse when armed, otherwise face the direction of travel.
  if (player.weapon === 'pistol') {
    player.angle = Math.atan2(world.mouseWorldY - player.y, world.mouseWorldX - player.x);
  } else if (player.speed > 10) {
    player.angle = Math.atan2(move.y, move.x);
  }

  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;

  if (actions & 4) enterNearestCar(player, world); // ACTION_ENTER
  if (actions & 8) punch(player, world); // ACTION_PUNCH
  if (input.takeClick()) {
    if (player.weapon === 'pistol') shoot(player, world);
    else punch(player, world);
  }
}

export function enterNearestCar(player, world) {
  const car = nearestCar(world.cars, player.x, player.y, 46, ['parked', 'traffic', 'police']);
  if (!car) return false;
  if (car.kind === 'traffic' && car.driver) {
    // Yank the driver out: they run, and the law notices.
    const driver = createPed(world.city, world.random, { x: car.x + 24, y: car.y + 24 });
    driver.state = 'flee';
    world.peds.push(driver);
    car.driver = null;
    world.addCrime(1.0, 'Car stolen');
    world.stats.carsStolen += 1;
    world.addMessage(`Stole a ${car.name}!`);
    world.audio.honk();
  } else if (car.kind === 'police') {
    world.addMessage('That one has a cop in it. Find another.');
    return false;
  }
  car.kind = 'player';
  car.driver = 'player';
  player.inCar = car;
  world.audio.engine(0.2);
  return true;
}

export function exitCar(player, world) {
  const car = player.inCar;
  if (!car) return false;
  player.inCar = null;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
  // Step out beside the car, on the driver's side.
  player.x = car.x - Math.sin(car.angle) * 26;
  player.y = car.y + Math.cos(car.angle) * 26;
  world.city.collideCircle(player, 12);
  world.audio.engine(0);
  return true;
}

export function punch(player, world) {
  if (player.punchTimer > 0 || player.inCar) return;
  player.punchTimer = WEAPONS.fists.rate;
  world.audio.punch();
  const range = WEAPONS.fists.range + 14;
  const arc = 1.1;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) continue;
    const ang = Math.atan2(dy, dx);
    let diff = ang - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > arc) continue;
    if (ped.gang) {
      ped.hp -= WEAPONS.fists.damage;
      if (ped.hp <= 0) killPed(world, ped, true);
    } else {
      knockDown(world, ped, true);
    }
    world.addStars(player.x + dx * 0.7, player.y + dy * 0.7);
    break;
  }
  // Punching a cop is a crime even if it misses everyone.
  world.addCrime(0.2, 'Assault');
}

export function shoot(player, world) {
  if (player.shootTimer > 0 || player.inCar) return;
  if (player.ammo <= 0) {
    world.addMessage('Out of ammo — find a gun store pickup');
    player.shootTimer = 0.3;
    return;
  }
  player.shootTimer = WEAPONS.pistol.rate;
  player.ammo -= 1;
  world.fireBullet(player.x, player.y, player.angle, WEAPONS.pistol.bulletSpeed, WEAPONS.pistol.damage, 'player');
  world.audio.shot();
  world.dangerPoint = { x: player.x, y: player.y, t: 1.5 };
  world.addCrime(0.15, 'Shots fired');
}

export function giveWeapon(player, weapon, ammo) {
  player.weapon = weapon;
  player.ammo = Math.min(WEAPONS.pistol.ammoMax, player.ammo + ammo);
}

export function hurtPlayer(world, amount) {
  const player = world.player;
  if (player.invulnerable > 0 || player.health <= 0) return;
  player.health -= amount;
  player.invulnerable = 0.4;
  world.addBlood(player.x, player.y);
  if (player.health <= 0) {
    player.health = 0;
    world.wasted();
  }
}
