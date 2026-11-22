// Drawing only: the world's state and the current screen in, pixels out. The static
// city (ground, roads, buildings, parks, beach) is painted once to an offscreen canvas
// and blitted each frame; cars, people, bullets and effects are drawn on top. Flat
// colours and canvas text, no images, no network.

import { PALETTE, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  let staticLayer = null;
  let staticForCity = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    world.viewW = window.innerWidth;
    world.viewH = window.innerHeight;
  }

  const fonts = new Map();
  // The font string is size + family only: a weight prefix ('700'/'bold') is valid
  // in browsers but the screenshot renderer parses size as the first token, so
  // weight is dropped here and emphasis comes from size and colour instead.
  function font(size) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    return fonts.get(size);
  }

  // A rounded rectangle path, built from quadratic curves (arcTo is not supported
  // by every canvas implementation, and this one is exact enough for the panels).
  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  /** Fill an ellipse via a scaled circle: no ellipse() call, so every canvas works. */
  function fillEllipse(x, y, rx, ry, rotation) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation || 0);
    context.scale(rx, ry);
    context.beginPath();
    context.arc(0, 0, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  /** Paint the unchanging city once: ground, water, roads, buildings, parks, labels. */
  function buildStatic(city) {
    const layer = document.createElement('canvas');
    layer.width = WORLD_W;
    layer.height = WORLD_H;
    const c = layer.getContext('2d');
    c.fillStyle = PALETTE.grass;
    c.fillRect(0, 0, WORLD_W, WORLD_H);
    // Harbour water on the west edge, beach and sea on the south edge.
    c.fillStyle = PALETTE.deepWater;
    c.fillRect(0, 0, city.harborX1, WORLD_H);
    c.fillStyle = PALETTE.water;
    c.fillRect(0, 0, city.harborX1 - 14, WORLD_H);
    c.fillStyle = PALETTE.sand;
    c.fillRect(0, city.beachY0, WORLD_W, WORLD_H - city.beachY0);
    c.fillStyle = PALETTE.water;
    c.fillRect(0, city.waterY0, WORLD_W, WORLD_H - city.waterY0);
    // Piers out into the harbour.
    for (const pier of city.piers) {
      c.fillStyle = '#8a6a48';
      c.fillRect(pier.x, pier.y, pier.w, pier.h);
      c.fillStyle = '#6e5236';
      for (let x = 8; x < pier.w; x += 18) c.fillRect(pier.x + x, pier.y + 3, 2, pier.h - 6);
    }
    // Parks.
    for (const park of city.parks) {
      c.fillStyle = PALETTE.park;
      c.fillRect(park.x, park.y, park.w, park.h);
      for (const tree of park.trees) {
        c.fillStyle = '#3f7a34';
        c.beginPath();
        c.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#5a9a48';
        c.beginPath();
        c.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Parking lots.
    for (const lot of city.lots) {
      c.fillStyle = PALETTE.asphaltDark;
      c.fillRect(lot.x, lot.y, lot.w, lot.h);
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 2;
      for (const spot of lot.spots) {
        c.beginPath();
        c.moveTo(spot.x - 14, spot.y - 10);
        c.lineTo(spot.x + 14, spot.y - 10);
        c.stroke();
      }
    }
    // Sidewalks, then roads, then the dashed centre line of each road.
    for (const rx of city.roadsX) {
      c.fillStyle = PALETTE.sidewalk;
      c.fillRect(rx - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD_H);
    }
    for (const ry of city.roadsY) {
      c.fillStyle = PALETTE.sidewalk;
      c.fillRect(0, ry - ROAD_W / 2 - 14, WORLD_W, ROAD_W + 28);
    }
    for (const rx of city.roadsX) {
      c.fillStyle = PALETTE.asphalt;
      c.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    }
    for (const ry of city.roadsY) {
      c.fillStyle = PALETTE.asphalt;
      c.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
    }
    c.fillStyle = PALETTE.line;
    for (const rx of city.roadsX) {
      for (let y = 20; y < WORLD_H; y += 56) c.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of city.roadsY) {
      for (let x = 20; x < WORLD_W; x += 56) c.fillRect(x, ry - 2, 30, 4);
    }
    // Buildings: shadow, body, roof, windows.
    for (const b of city.buildings) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      c.fillStyle = b.color;
      c.fillRect(b.x, b.y, b.w, b.h);
      c.fillStyle = b.roof;
      c.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      const cols = Math.max(1, Math.floor(b.w / 22));
      const rows = Math.max(1, Math.floor(b.h / 22));
      c.fillStyle = b.tall ? '#ffd34d' : '#2b2b2b';
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx * 7 + cy * 3) % 4 === 0) continue;
          c.fillRect(b.x + 10 + cx * 22, b.y + 10 + cy * 22, 10, 12);
        }
      }
      if (b.tall) {
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 12, 24, 24);
      }
    }
    // District names painted on the ground, for the screenshots and the minimap's sake.
    c.font = `64px ${FONT}`;
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,0.16)';
    const labels = [
      ['OLD HARBOR', 380, 300],
      ['NORTH HILLS', 1400, 330],
      ['DOWNTOWN', 1420, 1250],
      ['THE STRIP', 2750, 1150],
      ['MARINA BAY', 1700, 2150],
      ['SOUTH BEACH', 1700, 2480],
    ];
    for (const [text, x, y] of labels) c.fillText(text, x, y);
    staticLayer = layer;
    staticForCity = city;
  }

  function drawCar(car) {
    const c = context;
    c.save();
    c.translate(car.x, car.y);
    c.rotate(car.angle);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    fillEllipse(2, 3, 23, 12, 0);
    if (car.wrecked) {
      c.fillStyle = '#2e2e2e';
      roundRect(-22, -11, 44, 22, 6);
      c.fill();
      c.fillStyle = '#4a4a4a';
      roundRect(-12, -8, 24, 16, 4);
      c.fill();
    } else {
      c.fillStyle = car.color;
      roundRect(-22, -11, 44, 22, 7);
      c.fill();
      c.fillStyle = car.roof;
      roundRect(-10, -8, 20, 16, 4);
      c.fill();
      c.fillStyle = '#1d2733';
      c.fillRect(8, -8, 5, 16);
      c.fillStyle = '#fff8c9';
      c.fillRect(20, -8, 2, 4);
      c.fillRect(20, 4, 2, 4);
      if (car.brake) {
        c.fillStyle = '#ff2e2e';
        c.fillRect(-22, -8, 2, 4);
        c.fillRect(-22, 4, 2, 4);
      }
      if (car.kind === 'police') {
        c.fillStyle = '#f2f2f2';
        c.fillRect(-2, -11, 8, 22);
        const phase = Math.floor(car.sirenPhase * 3) % 2 === 0;
        c.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
        c.fillRect(-4, -6, 6, 5);
        c.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
        c.fillRect(-4, 1, 6, 5);
      }
    }
    c.restore();
  }

  function drawPed(ped) {
    const c = context;
    c.save();
    c.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      c.fillStyle = ped.color;
      fillEllipse(0, 0, 11, 6, ped.angle);
      c.restore();
      return;
    }
    c.fillStyle = 'rgba(0,0,0,0.25)';
    fillEllipse(1, 2, 9, 7, 0);
    c.fillStyle = ped.color;
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = ped.skin;
    c.beginPath();
    c.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2);
    c.fill();
    if (ped.gang) {
      c.strokeStyle = '#c02020';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 8, ped.angle - 1.2, ped.angle + 1.2);
      c.stroke();
      c.strokeStyle = '#1d1d1d';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(Math.cos(ped.angle) * 8, Math.sin(ped.angle) * 8);
      c.lineTo(Math.cos(ped.angle) * 16, Math.sin(ped.angle) * 16);
      c.stroke();
    }
    c.restore();
  }

  function drawCop(cop) {
    const c = context;
    c.save();
    c.translate(cop.x, cop.y);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    fillEllipse(1, 2, 9, 7, 0);
    c.fillStyle = '#1d2f4d';
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8b98a';
    c.beginPath();
    c.arc(Math.cos(cop.angle) * 3, Math.sin(cop.angle) * 3, 4.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffd34d';
    c.beginPath();
    c.arc(-2, -3, 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawPlayer(player) {
    const c = context;
    if (player.inCar) return;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
    c.save();
    c.translate(player.x, player.y);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    fillEllipse(1, 2, 10, 8, 0);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 11, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#19b5a6';
    c.beginPath();
    c.arc(0, 0, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8b98a';
    c.beginPath();
    c.arc(Math.cos(player.angle) * 3, Math.sin(player.angle) * 3, 5, 0, Math.PI * 2);
    c.fill();
    if (player.weapon === 'pistol') {
      c.strokeStyle = '#1d1d1d';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(Math.cos(player.angle) * 8, Math.sin(player.angle) * 8);
      c.lineTo(Math.cos(player.angle) * 17, Math.sin(player.angle) * 17);
      c.stroke();
    }
    c.restore();
  }

  function drawMarker(world) {
    const marker = world.missionMarker();
    if (!marker) return;
    const c = context;
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 4);
    const cam = world.camera;
    const inView = marker.x > cam.x - 40 && marker.x < cam.x + world.viewW + 40 && marker.y > cam.y - 40 && marker.y < cam.y + world.viewH + 40;
    if (inView) {
      c.save();
      c.globalAlpha = 0.25 * pulse;
      c.fillStyle = '#ffd34d';
      c.fillRect(marker.x - 4, marker.y - 90, 8, 90);
      c.restore();
      c.save();
      c.translate(marker.x, marker.y - 14 - pulse * 6);
      c.rotate(Math.PI / 4);
      c.fillStyle = '#ffd34d';
      c.fillRect(-9, -9, 18, 18);
      c.restore();
    } else {
      // Arrow at the screen edge, pointing toward the objective.
      const cx = Math.max(cam.x + 40, Math.min(cam.x + world.viewW - 40, marker.x));
      const cy = Math.max(cam.y + 40, Math.min(cam.y + world.viewH - 40, marker.y));
      const ang = Math.atan2(marker.y - cy, marker.x - cx);
      c.save();
      c.translate(cx, cy);
      c.rotate(ang);
      c.fillStyle = '#ffd34d';
      c.beginPath();
      c.moveTo(16, 0);
      c.lineTo(-10, -10);
      c.lineTo(-10, 10);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  function drawPanel(title, lines, prompt, accent, yOffset) {
    const c = context;
    const w = Math.min(720, world.viewW - 48);
    const h = 150 + lines.length * 30;
    const x = (world.viewW - w) / 2;
    const y = (world.viewH - h) / 2 + (yOffset || 0);
    c.fillStyle = 'rgba(10,12,20,0.82)';
    roundRect(x, y, w, h, 12);
    c.fill();
    c.strokeStyle = accent || '#ffd34d';
    c.lineWidth = 2;
    roundRect(x, y, w, h, 12);
    c.stroke();
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#f2ead8';
    c.font = font(44, '700 ');
    c.fillText(title, world.viewW / 2, y + 62);
    c.font = font(17);
    c.fillStyle = '#c9c2b2';
    lines.forEach((line, i) => c.fillText(line, world.viewW / 2, y + 104 + i * 30));
    c.font = font(19, '700 ');
    c.fillStyle = accent || '#ffd34d';
    c.fillText(prompt, world.viewW / 2, y + h - 24);
  }

  function drawTitle(world, save) {
    const c = context;
    c.fillStyle = 'rgba(8,10,18,0.55)';
    c.fillRect(0, 0, world.viewW, world.viewH);
    // The panel (controls + prompt) is drawn first and pushed down, so the
    // title text above it is never dimmed by the panel's fill.
    const lines = [
      'WASD / arrows — move & drive · Shift — run · E — steal / enter car, start job',
      'Mouse — aim · Click — shoot / punch · F — punch',
      'Space — handbrake · P — pause · M — mute',
      save ? `Save found: ${save.missionsDone} jobs done, $${save.money} — press Enter to continue` : 'No save yet — press Enter for a new game',
    ];
    drawPanel(' ', lines, save ? 'Enter — Continue · N — New game' : 'Enter — New game', '#ffd34d', 110);
    c.textAlign = 'center';
    c.fillStyle = '#ffd34d';
    c.font = font(84, '800 ');
    c.fillText('SOLMARA', world.viewW / 2, world.viewH / 2 - 150);
    c.fillStyle = '#f2ead8';
    c.font = font(26);
    c.fillText('S U N   C I T Y   C R I M E', world.viewW / 2, world.viewH / 2 - 108);
    c.font = font(17);
    c.fillStyle = '#c9c2b2';
    c.fillText('Mara Voss owes Rico Bellamy a debt. Seven jobs. One city. No rules.', world.viewW / 2, world.viewH / 2 - 70);
  }

  /** Paint one frame: the city, the living things, the HUD, then the screen's panel. */
  function draw(world, screen, save) {
    if (staticForCity !== world.city) buildStatic(world.city);
    const c = context;
    const ratio = window.devicePixelRatio || 1;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.fillStyle = '#11141b';
    c.fillRect(0, 0, world.viewW, world.viewH);
    const shakeX = world.shake > 0 ? (world.random() - 0.5) * world.shake : 0;
    const shakeY = world.shake > 0 ? (world.random() - 0.5) * world.shake : 0;
    const camX = Math.round(world.camera.x + shakeX);
    const camY = Math.round(world.camera.y + shakeY);
    c.drawImage(staticLayer, camX, camY, world.viewW, world.viewH, 0, 0, world.viewW, world.viewH);
    c.save();
    c.translate(-camX, -camY);
    // Skid marks under everything that moves.
    c.strokeStyle = 'rgba(20,20,20,0.45)';
    c.lineWidth = 3;
    for (const skid of world.skids) {
      c.beginPath();
      c.moveTo(skid.x - Math.cos(skid.angle) * 10, skid.y - Math.sin(skid.angle) * 10);
      c.lineTo(skid.x + Math.cos(skid.angle) * 10, skid.y + Math.sin(skid.angle) * 10);
      c.stroke();
    }
    // Pickups.
    for (const pickup of world.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(world.time * 3 + pickup.x) * 2;
      c.fillStyle = pickup.kind === 'health' ? '#e04848' : '#ffd34d';
      c.beginPath();
      c.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = font(13, '700 ');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(pickup.kind === 'health' ? '+' : 'A', pickup.x, pickup.y + bob);
    }
    drawMarker(world);
    for (const car of world.cars) drawCar(car);
    for (const ped of world.peds) {
      if (!ped.dead) drawPed(ped);
    }
    for (const cop of world.police.cops) drawCop(cop);
    drawPlayer(world.player);
    // Bullets.
    c.strokeStyle = '#fff3a0';
    c.lineWidth = 2;
    for (const b of world.bullets) {
      c.beginPath();
      c.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    // Particles, muzzle flashes, explosions.
    for (const p of world.particles) {
      c.globalAlpha = Math.max(0, p.life / p.maxLife);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    for (const flash of world.flashes) {
      c.fillStyle = '#fff3a0';
      c.beginPath();
      c.arc(flash.x, flash.y, 7, 0, Math.PI * 2);
      c.fill();
    }
    for (const ex of world.explosions) {
      c.globalAlpha = Math.max(0, ex.life / 0.5) * 0.55;
      c.fillStyle = '#ff7a2e';
      c.beginPath();
      c.arc(ex.x, ex.y, ex.radius * (1.2 - ex.life), 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    c.restore();

    if (screen === SCREEN_TITLE) {
      drawTitle(world, save);
      return;
    }
    drawHud(c, world, font);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'P — resume', '#f2ead8');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED!', ['The Solmara PD has you. Fine paid, job failed.'], 'Enter — back on the streets', '#2e6bff');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED!', ['St. Mara Hospital patched you up. The bill was not cheap.'], 'Enter — back on the streets', '#e04848');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('THE DEBT IS PAID', [`${world.stats.missionsDone} jobs done · $${world.stats.moneyEarned} earned · ${world.stats.kills} Cobras down`, 'Solmara is yours now, Mara.'], 'Enter — free roam', '#ffd34d');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, buildStatic: () => buildStatic(world.city) };
}
