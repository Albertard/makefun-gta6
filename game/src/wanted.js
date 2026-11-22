// The wanted system: heat builds with every crime and cools off when the player lies
// low. Stars are the floor of heat, capped at five. The police table in config.js says
// how many units each level fields.

export function createWanted() {
  return { stars: 0, heat: 0, sinceCrime: 99, sinceSeen: 99 };
}

export function addCrime(world, amount, reason) {
  const wanted = world.wanted;
  const before = wanted.stars;
  wanted.heat = Math.min(5.99, wanted.heat + amount);
  wanted.sinceCrime = 0;
  wanted.stars = Math.min(5, Math.floor(wanted.heat));
  if (wanted.stars > before) {
    world.addMessage(`Wanted level ${wanted.stars} — ${reason}`);
    if (wanted.stars >= 1) world.audio.siren(true);
  }
}

export function clearWanted(world) {
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.audio.siren(false);
}

/** Heat cools one star per ~28 s, but only while no crime was committed recently and
 *  no police unit is close enough to see the player. */
export function stepWanted(world, dt) {
  const wanted = world.wanted;
  wanted.sinceCrime += dt;
  let nearestPolice = Infinity;
  for (const car of world.police.cars) {
    nearestPolice = Math.min(nearestPolice, Math.hypot(car.x - world.player.x, car.y - world.player.y));
  }
  for (const cop of world.police.cops) {
    nearestPolice = Math.min(nearestPolice, Math.hypot(cop.x - world.player.x, cop.y - world.player.y));
  }
  if (wanted.heat > 0 && wanted.sinceCrime > 8 && nearestPolice > 450) {
    wanted.heat = Math.max(0, wanted.heat - dt / 28);
    const stars = Math.min(5, Math.floor(wanted.heat));
    if (stars < wanted.stars) {
      wanted.stars = stars;
      if (stars === 0) {
        world.addMessage('You lost the cops.');
        world.audio.siren(false);
      } else {
        world.addMessage(`Wanted level down to ${stars}`);
      }
    }
  }
}
