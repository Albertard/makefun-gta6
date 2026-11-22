// The story: Mara Voss, wheelwoman of Solmara, owes a debt to fixer Rico Bellamy and
// works it off one job at a time, from a first stolen car to the Grand Solmara score.
// Each mission is a list of steps; a step completes when the player reaches its spot,
// steals the right car, loses the heat, or takes down its gang members.

import { createCar } from './vehicles.js';
import { spawnGang } from './peds.js';

export const MISSIONS = [
  {
    id: 'first-gear', title: 'First Gear', reward: 150,
    brief: 'Rico needs a driver. Steal any car and bring it to his garage.',
    steps: [
      { kind: 'enterCar', text: 'Steal a car — press E near one' },
      { kind: 'deliver', spot: 'garage', text: "Drive to Rico's Garage" },
    ],
  },
  {
    id: 'the-pickup', title: 'The Pickup', reward: 250,
    brief: 'Eddie is waiting at the Old Docks with a suitcase. Get him to the Marina Hotel.',
    steps: [
      { kind: 'goto', spot: 'docks', text: 'Meet Eddie at the Old Docks' },
      { kind: 'timed', spot: 'hotel', time: 90, text: 'Drive Eddie to the Marina Hotel' },
    ],
  },
  {
    id: 'borrowed-wheels', title: 'Borrowed Wheels', reward: 350,
    brief: 'A gold Comet sits on The Strip. Borrow it. Permanently. Deliver it to the Chop Shop.',
    steps: [
      { kind: 'goto', spot: 'strip', text: 'Find the gold Comet on The Strip' },
      { kind: 'stealModel', model: 0, spot: 'strip', text: 'Steal the gold Comet (E)' },
      { kind: 'deliver', spot: 'chopshop', text: 'Deliver the Comet to the Chop Shop' },
    ],
  },
  {
    id: 'heat', title: 'Heat', reward: 300,
    brief: 'A job went sideways and the whole department is on you. Lose them, then lay low.',
    steps: [
      { kind: 'escape', time: 120, text: 'Lose the heat — break line of sight until the stars fade' },
      { kind: 'goto', spot: 'safehouse', text: 'Lay low at the Safehouse' },
    ],
  },
  {
    id: 'street-war', title: 'Street War', reward: 450,
    brief: 'The Cobras are hitting Rico\'s garage. Hold the block. No mercy.',
    steps: [
      { kind: 'defend', count: 5, spot: 'garage', text: 'Defend the garage — take down 5 Cobras' },
    ],
  },
  {
    id: 'the-getaway', title: 'The Getaway', reward: 600,
    brief: 'The crew just hit Sol Jewelers. Pick them up and shake the cops.',
    steps: [
      { kind: 'goto', spot: 'jewelry', text: 'Pick up the crew at Sol Jewelers' },
      { kind: 'escapeDrive', spot: 'safehouse', time: 120, text: 'Reach the Safehouse — lose the cops on the way' },
    ],
  },
  {
    id: 'grand-score', title: 'The Grand Score', reward: 1200,
    brief: 'The Grand Solmara vault. One briefcase, four stars, one runway. This clears the debt.',
    steps: [
      { kind: 'goto', spot: 'casino', text: 'Reach the Grand Solmara' },
      { kind: 'escapeDrive', spot: 'airfield', time: 150, text: 'Grab the briefcase — escape to the Airfield' },
    ],
  },
];

export function createMissionState() {
  return { index: 0, step: 0, timer: 0, active: false, done: false, killsAtStart: 0, passenger: false };
}

export function currentMission(state) {
  return MISSIONS[state.index] || null;
}

export function currentStep(state) {
  const mission = currentMission(state);
  return mission ? mission.steps[state.step] : null;
}

function spotOf(world, step) {
  return step.spot ? world.city.spots[step.spot] : null;
}

function beginStep(world, mission, stepIndex) {
  const step = mission.steps[stepIndex];
  const state = world.missions;
  state.timer = step.time || 0;
  state.killsAtStart = world.stats.kills;
  if (mission.id === 'borrowed-wheels' && step.kind === 'stealModel') {
    const spot = world.city.spots.strip;
    const comet = createCar(0, spot.x + 40, spot.y + 30, Math.PI / 2, 'parked');
    world.cars.push(comet);
    world.addMessage('There it is — the gold Comet.');
  }
  if (mission.id === 'heat' && step.kind === 'escape') {
    world.wanted.heat = 3.0;
    world.wanted.stars = 3;
    world.audio.siren(true);
    world.addMessage('Three stars! Lose them!');
  }
  if (mission.id === 'street-war' && step.kind === 'defend') {
    const spot = world.city.spots.garage;
    spawnGang(world, spot.x, spot.y + 120, 5);
    world.player.weapon = 'pistol';
    world.player.ammo = 60;
    world.addMessage('Cobras incoming! You have a pistol — use it.');
  }
  if (mission.id === 'the-getaway' && step.kind === 'escapeDrive') {
    world.wanted.heat = 3.0;
    world.wanted.stars = 3;
    world.audio.siren(true);
  }
  if (mission.id === 'grand-score' && step.kind === 'escapeDrive') {
    world.wanted.heat = 4.0;
    world.wanted.stars = 4;
    world.audio.siren(true);
    world.addMessage('Briefcase secured! Four stars — run!');
  }
}

export function startMission(world, index) {
  const state = world.missions;
  const mission = MISSIONS[index];
  if (!mission) return false;
  state.index = index;
  state.step = 0;
  state.active = true;
  state.done = false;
  state.passenger = false;
  beginStep(world, mission, 0);
  world.addMessage(`${mission.title}: ${mission.brief}`);
  world.audio.jingle();
  return true;
}

export function failMission(world, reason) {
  const state = world.missions;
  if (!state.active) return;
  state.active = false;
  world.addMessage(`Job failed: ${reason}. Back to Rico's garage to retry.`);
}

export function completeMission(world) {
  const state = world.missions;
  const mission = MISSIONS[state.index];
  state.active = false;
  state.done = true;
  world.player.money += mission.reward;
  world.stats.missionsDone += 1;
  world.stats.moneyEarned += mission.reward;
  world.addMessage(`${mission.title} complete! +$${mission.reward}`);
  world.audio.cash();
  world.audio.jingle();
  if (state.index >= MISSIONS.length - 1) {
    world.gameComplete = true;
  } else {
    state.index += 1;
    state.done = false;
  }
}

function nearSpot(world, spot, radius) {
  const p = world.player;
  const ref = p.inCar || p;
  return Math.hypot(ref.x - spot.x, ref.y - spot.y) < radius;
}

/** Advance the active mission one step; returns 'complete' when the mission is done. */
export function stepMissions(world, dt) {
  const state = world.missions;
  if (!state.active) return;
  const mission = MISSIONS[state.index];
  const step = mission.steps[state.step];
  if (step.time) {
    state.timer -= dt;
    if (state.timer <= 0) {
      failMission(world, 'Out of time');
      return;
    }
  }
  let done = false;
  switch (step.kind) {
    case 'goto':
      done = nearSpot(world, spotOf(world, step), 60);
      break;
    case 'enterCar':
      done = !!world.player.inCar;
      break;
    case 'stealModel':
      done = !!world.player.inCar && world.player.inCar.model === step.model;
      break;
    case 'deliver':
    case 'timed':
      done = !!world.player.inCar && nearSpot(world, spotOf(world, step), 70);
      break;
    case 'escape':
      done = world.wanted.stars === 0;
      break;
    case 'defend':
      done = world.stats.kills - state.killsAtStart >= step.count;
      break;
    case 'escapeDrive':
      done = nearSpot(world, spotOf(world, step), 70) && world.wanted.stars <= 1;
      break;
    default:
      done = false;
  }
  if (!done) return;
  state.step += 1;
  if (step.kind === 'goto' && mission.id === 'the-pickup') {
    state.passenger = true;
    world.addMessage('Eddie is in. Drive!');
  }
  if (step.kind === 'goto' && mission.id === 'the-getaway') {
    state.passenger = true;
    world.addMessage('Crew is in. Go go go!');
  }
  if (step.kind === 'goto' && mission.id === 'grand-score') {
    world.addMessage('Inside. The briefcase is yours — now run.');
  }
  if (state.step >= mission.steps.length) {
    completeMission(world);
  } else {
    beginStep(world, mission, state.step);
    world.addMessage(mission.steps[state.step].text);
  }
}

/** Where the objective marker points right now, or the garage when between jobs. */
export function missionMarker(world) {
  const state = world.missions;
  if (state.active) {
    const step = currentStep(state);
    if (step && step.spot) return world.city.spots[step.spot];
    if (step && step.kind === 'defend') return world.city.spots.garage;
    return null;
  }
  if (state.index < MISSIONS.length) return world.city.spots.garage;
  return null;
}

export function missionText(world) {
  const state = world.missions;
  if (state.active) {
    const mission = MISSIONS[state.index];
    const step = mission.steps[state.step];
    let text = `${mission.title}: ${step.text}`;
    if (step.kind === 'defend') {
      const left = step.count - (world.stats.kills - state.killsAtStart);
      text += ` (${Math.max(0, left)} left)`;
    }
    if (step.time) text += ` — ${Math.ceil(state.timer)}s`;
    return text;
  }
  if (state.index < MISSIONS.length) {
    return `Next job: ${MISSIONS[state.index].title} — press E at Rico's Garage`;
  }
  return 'All jobs done. Solmara is yours — free roam.';
}
