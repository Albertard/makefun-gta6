// The HUD, drawn in screen space after the world: health and money, wanted stars,
// the mission objective, the message feed, weapon and speed, and the minimap — the
// little city in the corner that shows the player, the police and the job marker.

import { HEALTH_MAX, WORLD_H, WORLD_W } from './config.js';

const MAP_W = 200;
const MAP_H = 153;

function star(c, x, y, r, filled) {
  c.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = filled ? '#ffd34d' : 'rgba(255,255,255,0.25)';
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.lineWidth = 1;
  c.stroke();
}

function drawMinimap(c, world) {
  const x0 = world.viewW - MAP_W - 16;
  const y0 = world.viewH - MAP_H - 16;
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  c.fillStyle = 'rgba(8,12,18,0.78)';
  c.fillRect(x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8);
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 1;
  c.strokeRect(x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8);
  // Water and beach edges.
  c.fillStyle = '#2e7fa8';
  c.fillRect(x0, y0, 150 * sx, MAP_H);
  c.fillStyle = '#e8d29a';
  c.fillRect(x0, y0 + 2400 * sy, MAP_W, MAP_H - 2400 * sy);
  // Roads.
  c.strokeStyle = '#8d8578';
  c.lineWidth = 2;
  for (const rx of world.city.roadsX) {
    c.beginPath();
    c.moveTo(x0 + rx * sx, y0);
    c.lineTo(x0 + rx * sx, y0 + MAP_H);
    c.stroke();
  }
  for (const ry of world.city.roadsY) {
    c.beginPath();
    c.moveTo(x0, y0 + ry * sy);
    c.lineTo(x0 + MAP_W, y0 + ry * sy);
    c.stroke();
  }
  // Mission marker.
  const marker = world.missionMarker();
  if (marker) {
    const pulse = 3 + Math.sin(world.time * 5) * 1.5;
    c.fillStyle = '#ffd34d';
    c.beginPath();
    c.arc(x0 + marker.x * sx, y0 + marker.y * sy, pulse + 2, 0, Math.PI * 2);
    c.fill();
  }
  // Police, then the player on top.
  for (const car of world.police.cars) {
    c.fillStyle = '#2e6bff';
    c.beginPath();
    c.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
    c.fill();
  }
  for (const cop of world.police.cops) {
    c.fillStyle = '#2e6bff';
    c.fillRect(x0 + cop.x * sx - 2, y0 + cop.y * sy - 2, 4, 4);
  }
  const p = world.player;
  const px = x0 + p.x * sx;
  const py = y0 + p.y * sy;
  c.save();
  c.translate(px, py);
  c.rotate(p.angle);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(6, 0);
  c.lineTo(-4, -4);
  c.lineTo(-4, 4);
  c.closePath();
  c.fill();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.font = '11px system-ui, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(world.city.districtAt(p.x, p.y).toUpperCase(), x0, y0 - 8);
}

export function drawHud(c, world, font) {
  const player = world.player;
  const viewW = world.viewW;
  const viewH = world.viewH;

  // Low health: a red vignette that breathes.
  if (player.health < 35 && !player.inCar) {
    const pulse = 0.12 + 0.08 * Math.sin(world.time * 5);
    const grad = c.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.35, viewW / 2, viewH / 2, viewH * 0.75);
    grad.addColorStop(0, 'rgba(200,30,30,0)');
    grad.addColorStop(1, `rgba(200,30,30,${pulse + 0.15})`);
    c.fillStyle = grad;
    c.fillRect(0, 0, viewW, viewH);
  }

  // Top-left: health bar, money, district.
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(8,12,18,0.6)';
  c.fillRect(14, 14, 216, 54);
  c.fillStyle = '#3a3a3a';
  c.fillRect(22, 22, 200, 14);
  c.fillStyle = player.health > 50 ? '#58c96b' : player.health > 25 ? '#e8b923' : '#e04848';
  c.fillRect(22, 22, 200 * Math.max(0, player.health / HEALTH_MAX), 14);
  c.fillStyle = '#f2ead8';
  c.font = font(13, '700 ');
  c.fillText('HEALTH', 26, 33);
  c.fillStyle = '#7ee787';
  c.font = font(20, '700 ');
  c.fillText(`$${player.money}`, 22, 62);
  if (world.missions.passenger) {
    c.fillStyle = '#ffd34d';
    c.font = font(13, '700 ');
    c.fillText('PASSENGER ON BOARD', 110, 62);
  }

  // Top-right: wanted stars.
  const stars = world.wanted.stars;
  const flash = stars >= 3 && Math.floor(world.time * 3) % 2 === 0;
  for (let i = 0; i < 5; i += 1) {
    star(c, viewW - 30 - i * 30, 32, 12, i < stars && !flash);
  }
  if (stars > 0) {
    c.fillStyle = '#ffd34d';
    c.font = font(12, '700 ');
    c.textAlign = 'right';
    c.fillText(stars === 1 ? 'HEAT' : `HEAT LEVEL ${stars}`, viewW - 22, 56);
    c.textAlign = 'left';
  }

  // Top-centre: the current objective.
  const objective = world.missionText();
  c.font = font(16, '700 ');
  const ow = c.measureText(objective).width + 28;
  c.fillStyle = 'rgba(8,12,18,0.72)';
  c.beginPath();
  c.roundRect((viewW - ow) / 2, 12, ow, 30, 8);
  c.fill();
  c.fillStyle = '#ffd34d';
  c.textAlign = 'center';
  c.fillText(objective, viewW / 2, 33);
  c.textAlign = 'left';

  // Message feed under the objective.
  c.font = font(15);
  c.textAlign = 'center';
  world.messages.forEach((msg, i) => {
    c.globalAlpha = Math.min(1, msg.t);
    c.fillStyle = '#f2ead8';
    c.fillText(msg.text, viewW / 2, 64 + i * 22);
  });
  c.globalAlpha = 1;
  c.textAlign = 'left';

  // Bottom-left: weapon, ammo, speed.
  c.fillStyle = 'rgba(8,12,18,0.6)';
  c.fillRect(14, viewH - 58, 210, 44);
  c.fillStyle = '#f2ead8';
  c.font = font(16, '700 ');
  const weaponName = player.weapon === 'pistol' ? 'P9 PISTOL' : 'FISTS';
  c.fillText(weaponName, 24, viewH - 36);
  if (player.weapon === 'pistol') {
    c.fillStyle = '#ffd34d';
    c.fillText(`AMMO ${player.ammo}`, 24, viewH - 18);
  }
  if (player.inCar) {
    const mph = Math.round(Math.abs(player.inCar.speed) * 0.14);
    c.fillStyle = '#7ee787';
    c.font = font(24, '800 ');
    c.fillText(`${mph} MPH`, 150, viewH - 26);
    c.fillStyle = '#c9c2b2';
    c.font = font(12, '700 ');
    c.fillText(player.inCar.name.toUpperCase(), 150, viewH - 44);
  }

  // Crosshair while aiming the pistol on foot.
  if (!player.inCar && player.weapon === 'pistol') {
    const mx = world.mouseWorldX - world.camera.x;
    const my = world.mouseWorldY - world.camera.y;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(mx, my, 9, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(mx - 13, my);
    c.lineTo(mx - 5, my);
    c.moveTo(mx + 5, my);
    c.lineTo(mx + 13, my);
    c.moveTo(mx, my - 13);
    c.lineTo(mx, my - 5);
    c.moveTo(mx, my + 5);
    c.lineTo(mx, my + 13);
    c.stroke();
  }

  drawMinimap(c, world);
}
