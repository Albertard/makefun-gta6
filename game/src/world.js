// The world: everything the game is, in one state object, and the one step that moves
// it. Input comes in, events (busted, wasted, game done) come out as bit flags, and
// the renderer and the HUD only ever read this state. No drawing and no DOM here.

import { HEALTH_MAX, MONEY_START, STEP, WORLD_H, WORLD_W } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import { createPlayer, exitCar, stepPlayer } from './player.js';
import { collideCars, damageCar, spawnParked, spawnTraffic, stepPlayerCar, stepTrafficCar } from './vehicles.js';
import { createPolice, stepPolice } from './police.js';
import { killPed, knockDown, spawnPeds, stepPeds } from './peds.js';
import { addCrime, clearWanted, createWanted, stepWanted } from './wanted.js';
import { explode, fireBullet, stepBullets } from './combat.js';
import { createMissionState, failMission, missionMarker, missionText, startMission, stepMissions } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_GAME_DONE = 4;

const PICKUP_SPOTS = [
  { kind: 'health', x: 1180, y: 1820 },
  { kind: 'ammo', x: 2780, y: 920 },
  { kind: 'health', x: 900, y: 1220 },
  { kind: 'ammo', x: 540, y: 2120 },
];

export function createWorld(seed, audio) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const world = {
    seed,
    random: rng,
    city,
    audio: audio || createAudio(),
    player: createPlayer(900, 1240),
    cars: [],
    peds: [],
    police: createPolice(),
    bullets: [],
    particles: [],
    skids: [],
    flashes: [],
    explosions: [],
    pickups: [],
    wanted: createWanted(),
    missions: createMissionState(),
    messages: [],
    stats: { kills: 0, carsStolen: 0, missionsDone: 0, moneyEarned: 0 },
    camera: { x: 0, y: 0 },
    mouseWorldX: 0,
    mouseWorldY: 0,
    dangerPoint: null,
    boxedTimer: 0,
    shake: 0,
    time: 0,
    gameComplete: false,
    bustedFlag: false,
    wastedFlag: false,
  };

  function reset() {
    world.random = createRandom(seed);
    world.city = createCity(world.random);
    world.player = createPlayer(900, 1240);
    world.cars = [...spawnTraffic(world.city, world.random, 22), ...spawnParked(world.city, world.random, 14)];
    world.peds = spawnPeds(world.city, world.random, 36);
    world.police = createPolice();
    world.bullets = [];
    world.particles = [];
    world.skids = [];
    world.flashes = [];
    world.explosions = [];
    world.pickups = PICKUP_SPOTS.map((p) => ({ ...p, taken: false, respawn: 0 }));
    world.wanted = createWanted();
    world.missions = createMissionState();
    world.messages = [];
    world.stats = { kills: 0, carsStolen: 0, missionsDone: 0, moneyEarned: 0 };
    world.camera = { x: world.player.x - 640, y: world.player.y - 400 };
    world.dangerPoint = null;
    world.boxedTimer = 0;
    world.shake = 0;
    world.time = 0;
    world.gameComplete = false;
    world.bustedFlag = false;
    world.wastedFlag = false;
  }

  // ---- effects and messages (the renderer reads these) ----
  function addMessage(text) {
    world.messages.push({ text, t: 5 });
    if (world.messages.length > 4) world.messages.shift();
  }
  function addParticles(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      const a = world.random() * Math.PI * 2;
      const s = speed * (0.4 + world.random() * 0.8);
      world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + world.random()), maxLife: life, color, size: 2 + world.random() * 3 });
    }
    if (world.particles.length > 400) world.particles.splice(0, world.particles.length - 400);
  }
  world.addMessage = addMessage;
  world.addSkid = (x, y, angle) => {
    world.skids.push({ x, y, angle, life: 6 });
    if (world.skids.length > 300) world.skids.shift();
  };
  world.addSparks = (x, y, n) => addParticles(x, y, n, '#ffd34d', 260, 0.4);
  world.addSmoke = (x, y, n) => addParticles(x, y, n, '#8a8f98', 40, 1.4);
  world.addBlood = (x, y) => addParticles(x, y, 10, '#a02020', 120, 0.6);
  world.addStars = (x, y) => addParticles(x, y, 6, '#ffe14d', 160, 0.5);
  world.addMuzzle = (x, y, angle) => {
    world.flashes.push({ x: x + Math.cos(angle) * 22, y: y + Math.sin(angle) * 22, life: 0.06 });
  };
  world.addExplosion = (x, y, radius) => {
    world.explosions.push({ x, y, radius, life: 0.5 });
    addParticles(x, y, 26, '#ff7a2e', 380, 0.8);
    addParticles(x, y, 14, '#3a3a3a', 90, 1.6);
  };
  world.explode = (x, y, radius) => explode(world, x, y, radius);
  world.fireBullet = (x, y, angle, speed, damage, from) => fireBullet(world, x, y, angle, speed, damage, from);
  world.addCrime = (amount, reason) => addCrime(world, amount, reason);

  function busted() {
    if (world.bustedFlag) return;
    world.bustedFlag = true;
    const fine = Math.min(100, world.player.money);
    world.player.money -= fine;
    clearWanted(world);
    failMission(world, 'Busted');
    world.audio.busted();
    addMessage(`BUSTED! Fine $${fine}.`);
  }

  function wasted() {
    if (world.wastedFlag) return;
    world.wastedFlag = true;
    const bill = Math.min(150, world.player.money);
    world.player.money -= bill;
    clearWanted(world);
    failMission(world, 'Wasted');
    addMessage(`WASTED! Hospital bill $${bill}.`);
  }

  function respawnAfterTrouble() {
    const spot = world.bustedFlag ? world.city.spots.garage : world.city.spots.hospital;
    world.player.x = spot.x;
    world.player.y = spot.y;
    world.player.health = HEALTH_MAX;
    if (world.player.inCar) {
      world.player.inCar.kind = 'parked';
      world.player.inCar.driver = null;
      world.player.inCar = null;
    }
    world.bustedFlag = false;
    world.wastedFlag = false;
    world.camera.x = world.player.x - 640;
    world.camera.y = world.player.y - 400;
  }

  /** One fixed step. `actions` are the one-shot ACTION_* flags main.js took this frame. */
  function step(dt, input, actions) {
    let events = 0;
    world.time += dt;
    if (world.dangerPoint) {
      world.dangerPoint.t -= dt;
      if (world.dangerPoint.t <= 0) world.dangerPoint = null;
    }
    world.mouseWorldX = world.camera.x + input.mouseX;
    world.mouseWorldY = world.camera.y + input.mouseY;

    // Starting the next job: E at the garage marker while no mission is running.
    let acts = actions;
    if (!world.missions.active && world.missions.index < 7 && (acts & 4)) {
      const garage = world.city.spots.garage;
      if (Math.hypot(world.player.x - garage.x, world.player.y - garage.y) < 90) {
        startMission(world, world.missions.index);
        acts &= ~4;
      }
    }
    // E while driving gets the player out of the car.
    if (world.player.inCar && (acts & 4)) {
      exitCar(world.player, world);
      acts &= ~4;
    }

    if (world.player.inCar) {
      const car = world.player.inCar;
      stepPlayerCar(car, dt, input, world.city, world);
      if (car.wrecked) {
        world.player.health -= 20;
        exitCar(world.player, world);
        if (world.player.health <= 0) {
          world.player.health = 0;
          wasted();
        }
      }
      // The car reference is captured above: exitCar() clears player.inCar, so the
      // engine sound must read the captured car, never player.inCar again.
      world.audio.engine(car.wrecked ? 0 : Math.abs(car.speed) / 560);
    } else {
      stepPlayer(world.player, dt, input, world, acts);
      world.audio.engine(0);
    }

    for (const car of world.cars) {
      if (car.wrecked) continue;
      if (car.kind === 'traffic') stepTrafficCar(car, dt, world.city, world, world.random);
    }
    stepPolice(world, dt);
    stepPeds(world.peds, dt, world);
    stepBullets(world, dt);
    stepWanted(world, dt);
    stepMissions(world, dt);
    collideCars(world.cars, world);

    // Cars running over pedestrians: the player's car is a crime, traffic is not.
    for (const car of world.cars) {
      if (car.wrecked || Math.abs(car.speed) < 60) continue;
      for (const ped of world.peds) {
        if (ped.dead || ped.state === 'down') continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 22) {
          knockDown(world, ped, car.kind === 'player');
        }
      }
    }
    // A downed pedestrian under a fast car does not get up.
    for (const ped of world.peds) {
      if (ped.dead || ped.state !== 'down') continue;
      for (const car of world.cars) {
        if (car.wrecked || Math.abs(car.speed) < 60) continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 20) killPed(world, ped, car.kind === 'player');
      }
    }

    // Pickups: walk or drive over one to collect it; it comes back after a minute.
    for (const pickup of world.pickups) {
      if (pickup.taken) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) pickup.taken = false;
        continue;
      }
      const ref = world.player.inCar || world.player;
      if (Math.hypot(ref.x - pickup.x, ref.y - pickup.y) < 34) {
        pickup.taken = true;
        pickup.respawn = 60;
        if (pickup.kind === 'health') {
          world.player.health = Math.min(HEALTH_MAX, world.player.health + 50);
          addMessage('Health +50');
        } else {
          world.player.weapon = 'pistol';
          world.player.ammo = Math.min(60, world.player.ammo + 30);
          addMessage('Pistol ammo +30');
        }
        world.audio.pickup();
      }
    }

    // Effects age out.
    for (let i = world.particles.length - 1; i >= 0; i -= 1) {
      const p = world.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) world.particles.splice(i, 1);
    }
    for (let i = world.skids.length - 1; i >= 0; i -= 1) {
      world.skids[i].life -= dt;
      if (world.skids[i].life <= 0) world.skids.splice(i, 1);
    }
    for (let i = world.flashes.length - 1; i >= 0; i -= 1) {
      world.flashes[i].life -= dt;
      if (world.flashes[i].life <= 0) world.flashes.splice(i, 1);
    }
    for (let i = world.explosions.length - 1; i >= 0; i -= 1) {
      world.explosions[i].life -= dt;
      if (world.explosions[i].life <= 0) world.explosions.splice(i, 1);
    }
    for (let i = world.messages.length - 1; i >= 0; i -= 1) {
      world.messages[i].t -= dt;
      if (world.messages[i].t <= 0) world.messages.splice(i, 1);
    }

    // Camera follows the player or the car, clamped to the city, with trauma shake.
    const focus = world.player.inCar || world.player;
    const viewW = world.viewW || 1280;
    const viewH = world.viewH || 800;
    const tx = Math.max(0, Math.min(WORLD_W - viewW, focus.x - viewW / 2));
    const ty = Math.max(0, Math.min(WORLD_H - viewH, focus.y - viewH / 2));
    world.camera.x += (tx - world.camera.x) * Math.min(1, dt * 5);
    world.camera.y += (ty - world.camera.y) * Math.min(1, dt * 5);
    world.shake = Math.max(0, world.shake - dt * 22);
    world.audio.siren(world.wanted.stars > 0);

    if (world.bustedFlag) events |= EVENT_BUSTED;
    if (world.wastedFlag) events |= EVENT_WASTED;
    if (world.gameComplete) events |= EVENT_GAME_DONE;
    return events;
  }

  world.reset = reset;
  world.step = step;
  world.busted = busted;
  world.wasted = wasted;
  world.respawnAfterTrouble = respawnAfterTrouble;
  world.missionMarker = () => missionMarker(world);
  world.missionText = () => missionText(world);
  world.moneyStart = MONEY_START;
  reset();
  return world;
}
