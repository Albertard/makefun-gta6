// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between six screens:
// title, play, paused, busted, wasted and complete. Progress saves to localStorage.
//
// ?seed=N fixes the city and the traffic. ?shot=cover|street|mission|menu (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { SAVE_KEY, STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_GAME_DONE, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(seed, audio);
const renderer = createRenderer(canvas, world);

const QUIET = {
  moveVector: () => ({ x: 0, y: 0 }),
  run: false,
  handbrake: false,
  firing: false,
  mouseX: 0,
  mouseY: 0,
  takeClick: () => false,
};

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    const save = {
      money: world.player.money,
      missionIndex: world.missions.index,
      x: world.player.x,
      y: world.player.y,
      health: world.player.health,
      kills: world.stats.kills,
      carsStolen: world.stats.carsStolen,
      moneyEarned: world.stats.moneyEarned,
      missionsDone: world.stats.missionsDone,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(save) {
  world.player.money = save.money;
  world.player.x = save.x;
  world.player.y = save.y;
  world.player.health = save.health;
  world.missions.index = save.missionIndex;
  world.stats.kills = save.kills;
  world.stats.carsStolen = save.carsStolen;
  world.stats.moneyEarned = save.moneyEarned;
  world.stats.missionsDone = save.missionsDone;
  world.camera.x = save.x - world.viewW / 2;
  world.camera.y = save.y - world.viewH / 2;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let newGameKey = false;
  let accumulator = 0;
  let last = performance.now();

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN') newGameKey = true;
  });
  window.addEventListener('beforeunload', () => {
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) writeSave();
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world.reset();
    audio.unlock();
    audio.music(true);
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car and drive to Rico\'s Garage.');
  }

  function continueGame() {
    world.reset();
    if (save) applySave(save);
    audio.unlock();
    audio.music(true);
    screen = SCREEN_PLAY;
    announce('Playing. Welcome back to Solmara.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Sound off.' : 'Sound on.');
      return actions;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      if (save && !newGameKey) continueGame();
      else startNewGame();
      newGameKey = false;
    } else if (actions & ACTION_CONFIRM && (screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      world.respawnAfterTrouble();
      writeSave();
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_COMPLETE) {
      screen = SCREEN_PLAY;
      announce('Free roam. Solmara is yours.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, QUIET, 0);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input, actions);
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      writeSave();
      announce('Busted! The police have you.');
    } else if (events & EVENT_WASTED) {
      screen = SCREEN_WASTED;
      writeSave();
      announce('Wasted! You wake up in hospital.');
    } else if (events & EVENT_GAME_DONE) {
      screen = SCREEN_COMPLETE;
      writeSave();
      announce('The debt is paid. Solmara is yours.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    while (accumulator >= STEP) {
      step(actions);
      accumulator -= STEP;
    }
    renderer.draw(world, screen, save);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
    }
  });

  announce('Solmara. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
