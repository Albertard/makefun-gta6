// The screenshot scenes behind ?shot=cover|street|mission|menu. Each one sets the real
// game up in a real state and plays it forward with a scripted autopilot — driving the
// roads, shooting at the gang — so the frame is what a short game really looks like,
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function scriptedInput(move, opts = {}) {
  return {
    moveVector: () => move,
    run: false,
    handbrake: false,
    firing: false,
    mouseX: opts.mouseX ?? 640,
    mouseY: opts.mouseY ?? 400,
    takeClick: () => !!opts.click,
  };
}

const IDLE = scriptedInput({ x: 0, y: 0 });

function driveAutopilot(world, targetX, targetY) {
  const car = world.player.inCar;
  if (!car) return IDLE;
  const route = world.city.route(world.city.nearestNode(car.x, car.y), world.city.nearestNode(targetX, targetY));
  const next = route.length > 1 ? world.city.keyToNode(route[1]) : { x: targetX, y: targetY };
  const want = Math.atan2(next.y - car.y, next.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Brake for a hard turn instead of cutting the corner through a building.
  const throttle = Math.abs(diff) > 0.7 && Math.abs(car.speed) > 150 ? 0.7 : -1;
  return scriptedInput({ x: steer, y: throttle });
}

function shootAutopilot(world) {
  // Aim at the nearest living gang member and fire; stand still and let them come.
  let best = null;
  let bestDist = Infinity;
  for (const ped of world.peds) {
    if (!ped.gang || ped.dead) continue;
    const d = Math.hypot(ped.x - world.player.x, ped.y - world.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = ped;
    }
  }
  if (!best) return IDLE;
  return scriptedInput({ x: 0, y: 0 }, {
    mouseX: best.x - world.camera.x,
    mouseY: best.y - world.camera.y,
    click: true,
  });
}

function runSteps(world, seconds, pilot) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = typeof pilot === 'function' ? pilot(world) : pilot;
    world.step(STEP, input, 0);
  }
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  world.reset();
  if (name === 'menu') {
    runSteps(world, 6, IDLE);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'street') {
    world.player.x = 1500;
    world.player.y = 1160;
    startMission(world, 0);
    runSteps(world, 3, IDLE);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    world.player.x = 900;
    world.player.y = 1160;
    startMission(world, 4);
    for (let i = 0; i < Math.floor(5 / STEP); i += 1) {
      world.step(STEP, shootAutopilot(world), 0);
      world.player.health = 100; // staging only: keep the hero standing for the frame
    }
    return { screen: SCREEN_PLAY };
  }
  // Cover: the getaway. A Sunrunner heading west on the Downtown avenue, three
  // stars, interceptors closing in.
  world.player.x = 1820;
  world.player.y = 1400;
  const car = createCar(4, 1820, 1400, Math.PI, 'player');
  car.driver = 'player';
  world.cars.push(car);
  world.player.inCar = car;
  startMission(world, 5);
  // Drive to the crew at Sol Jewelers so the mission advances to the escape step.
  world.player.inCar.x = 1500;
  world.player.inCar.y = 560;
  runSteps(world, 1, IDLE);
  runSteps(world, 5, (w) => driveAutopilot(w, 540, 2060));
  return { screen: SCREEN_PLAY };
}
