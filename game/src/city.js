// Solmara's map: a road grid, the blocks between the roads, the buildings, parks and
// parking lots that fill them, the beach and harbour at the edges, and the road graph the
// traffic, the police and the mission routing all drive on. All of it is seeded, so the
// same seed builds the same city.

import { DISTRICTS, PALETTE, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { randomInt, randomPick, randomRange } from './random.js';

const ROADS_X = [220, 540, 860, 1180, 1500, 1820, 2140, 2460, 2780, 3100];
const ROADS_Y = [200, 500, 800, 1100, 1400, 1700, 2000, 2300];
const BEACH_Y0 = 2400;
const WATER_Y0 = 2520;
const HARBOR_X1 = 150;
const BUILDING_COLORS = ['#d9a05b', '#c96f4a', '#8fa8bf', '#a8b89a', '#d8c49a', '#b56b7d', '#7d9b8a', '#c9a86a', '#9a8fb5', '#e0b56a'];

export const SPOTS = {
  garage: { name: "Rico's Garage", x: 900, y: 1160 },
  docks: { name: 'Old Docks', x: 170, y: 1100 },
  hotel: { name: 'Marina Hotel', x: 2140, y: 2060 },
  strip: { name: 'The Strip', x: 2780, y: 860 },
  chopshop: { name: 'Chop Shop', x: 3100, y: 1760 },
  safehouse: { name: 'Safehouse', x: 540, y: 2060 },
  casino: { name: 'Grand Solmara', x: 2460, y: 860 },
  airfield: { name: 'Solmara Airfield', x: 3160, y: 2360 },
  jewelry: { name: 'Sol Jewelers', x: 1500, y: 560 },
  hospital: { name: 'St. Mara Hospital', x: 1180, y: 1760 },
  plaza: { name: 'Downtown Plaza', x: 1500, y: 1160 },
};

function nodeKey(ix, iy) {
  return `${ix},${iy}`;
}

function keyToNode(key) {
  const [ix, iy] = key.split(',').map(Number);
  return { x: ROADS_X[ix], y: ROADS_Y[iy], ix, iy };
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const piers = [
    { x: 0, y: 485, w: 170, h: 30 },
    { x: 0, y: 1085, w: 170, h: 30 },
    { x: 0, y: 1685, w: 170, h: 30 },
  ];

  // Fill every block between four roads with buildings, a park, or a parking lot.
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      if (x1 <= x0 || y1 <= y0) continue;
      if (x1 < HARBOR_X1 + 20 || y0 > BEACH_Y0) continue;
      const downtown = x0 > 700 && x1 < 2150 && y0 > 500 && y1 < 1750;
      const roll = random();
      if (roll < 0.16) {
        const trees = [];
        const count = randomInt(random, 4, 9);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: randomRange(random, x0 + 14, x1 - 14), y: randomRange(random, y0 + 14, y1 - 14), r: randomRange(random, 9, 15) });
        }
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees });
        continue;
      }
      if (roll < 0.34) {
        const spots = [];
        const count = randomInt(random, 3, 6);
        for (let s = 0; s < count; s += 1) {
          spots.push({ x: randomRange(random, x0 + 20, x1 - 20), y: randomRange(random, y0 + 20, y1 - 20), angle: random() < 0.5 ? 0 : Math.PI / 2 });
        }
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, spots });
        continue;
      }
      const count = downtown ? randomInt(random, 2, 4) : randomInt(random, 1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = randomRange(random, 60, Math.min(170, (x1 - x0) / count - 8));
        const h = randomRange(random, 60, Math.min(170, (y1 - y0) - 8));
        const x = randomRange(random, x0, Math.max(x0, x1 - w));
        const y = randomRange(random, y0, Math.max(y0, y1 - h));
        buildings.push({
          x, y, w, h,
          color: randomPick(random, BUILDING_COLORS),
          roof: random() < 0.5 ? '#5a5148' : '#6e6258',
          tall: downtown && random() < 0.55,
          windows: randomInt(random, 2, 5),
        });
      }
    }
  }

  const nodes = new Map();
  for (let ix = 0; ix < ROADS_X.length; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length; iy += 1) {
      nodes.set(nodeKey(ix, iy), { x: ROADS_X[ix], y: ROADS_Y[iy], ix, iy });
    }
  }

  function neighbors(key) {
    const { ix, iy } = keyToNode(key);
    const out = [];
    if (ix > 0) out.push(nodeKey(ix - 1, iy));
    if (ix < ROADS_X.length - 1) out.push(nodeKey(ix + 1, iy));
    if (iy > 0) out.push(nodeKey(ix, iy - 1));
    if (iy < ROADS_Y.length - 1) out.push(nodeKey(ix, iy + 1));
    return out;
  }

  function nearestNode(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const node of nodes.values()) {
      const d = (node.x - x) ** 2 + (node.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return nodeKey(best.ix, best.iy);
  }

  /** Next intersection for a car driving the graph: mostly straight on, never a U-turn. */
  function nextNode(key, prevKey, random) {
    const options = neighbors(key).filter((n) => n !== prevKey);
    if (options.length === 0) return prevKey;
    if (prevKey) {
      const cur = keyToNode(key);
      const prev = keyToNode(prevKey);
      const dx = Math.sign(cur.ix - prev.ix);
      const dy = Math.sign(cur.iy - prev.iy);
      const straight = nodeKey(cur.ix + dx, cur.iy + dy);
      if (options.includes(straight) && random() < 0.62) return straight;
    }
    return randomPick(random, options);
  }

  /** Shortest path on the grid between two intersections, as a list of node keys. */
  function route(fromKey, toKey) {
    if (fromKey === toKey) return [fromKey];
    const came = new Map([[fromKey, null]]);
    const queue = [fromKey];
    while (queue.length > 0) {
      const key = queue.shift();
      for (const next of neighbors(key)) {
        if (came.has(next)) continue;
        came.set(next, key);
        if (next === toKey) {
          const path = [next];
          let cur = key;
          while (cur !== null) {
            path.unshift(cur);
            cur = came.get(cur);
          }
          return path;
        }
        queue.push(next);
      }
    }
    return [fromKey, toKey];
  }

  function isRoad(x, y) {
    for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
    for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
    return false;
  }

  function onPier(x, y) {
    return piers.some((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
  }

  function inWater(x, y) {
    if (y >= WATER_Y0) return true;
    if (x < HARBOR_X1 && !onPier(x, y)) return true;
    return false;
  }

  function pointInBuilding(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  /** Push a circle out of buildings, water and the world edge. Returns true on a hit. */
  function collideCircle(body, radius) {
    let hit = false;
    body.x = Math.max(radius, Math.min(WORLD_W - radius, body.x));
    body.y = Math.max(radius, Math.min(WORLD_H - radius, body.y));
    if (inWater(body.x, body.y)) {
      // Shove back toward the nearest dry land: south water pushes north, harbour pushes east.
      if (body.y >= WATER_Y0) body.y = WATER_Y0 - radius;
      else body.x = HARBOR_X1 + radius;
      hit = true;
    }
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * radius;
        body.y = cy + (dy / d) * radius;
      } else if (body.x < b.x + b.w / 2) body.x = b.x - radius;
      else body.x = b.x + b.w + radius;
    }
    return hit;
  }

  function districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
    }
    return 'Solmara';
  }

  function randomRoadPoint(random) {
    if (random() < 0.5) {
      return { x: randomPick(random, ROADS_X), y: randomRange(random, 100, WORLD_H - 200) };
    }
    return { x: randomRange(random, 200, WORLD_W - 200), y: randomPick(random, ROADS_Y) };
  }

  function randomSidewalkPoint(random) {
    const p = randomRoadPoint(random);
    const vertical = ROADS_X.includes(p.x);
    if (vertical) p.x += (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
    else p.y += (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
    return p;
  }

  function randomParkedSpot(random) {
    if (lots.length === 0) return null;
    const lot = randomPick(random, lots);
    return randomPick(random, lot.spots);
  }

  return {
    roadsX: ROADS_X, roadsY: ROADS_Y, buildings, parks, lots, piers, spots: SPOTS,
    beachY0: BEACH_Y0, waterY0: WATER_Y0, harborX1: HARBOR_X1,
    nodes, neighbors, nearestNode, nextNode, route, keyToNode,
    isRoad, onPier, inWater, pointInBuilding, collideCircle, districtAt,
    randomRoadPoint, randomSidewalkPoint, randomParkedSpot,
  };
}
