const socket = new WebSocket("wss://multiplayer-server-production-40dc.up.railway.app");

let roomCode = null;
let connected = false;
let myId = null;
let worldSize = 1500;

// UI
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomInput");
const roomDisplay = document.getElementById("roomDisplay");
const menu = document.getElementById("menu");
const menuToggle = document.getElementById("menuToggle");
const roomHUD = document.getElementById("roomHUD");
const hpHUD = document.getElementById("hpHUD");
const coinsHUD = document.getElementById("coinsHUD");
const nameIntro = document.getElementById("nameIntro");
const nameInput = document.getElementById("nameInput");
const nameConfirm = document.getElementById("nameConfirm");
const portraitOverlay = document.getElementById("portraitOverlay");
const stayPortrait = document.getElementById("stayPortrait");
const ammoHUD = document.getElementById("ammoHUD");
const scoreBtn = document.getElementById("scoreBtn");
const scoreboard = document.getElementById("scoreboard");
const scoreTable = document.getElementById("scoreTable");
const killfeedDiv = document.getElementById("killfeed");

// Shop
const shop = document.getElementById("shop");
const skinPreview = document.getElementById("skinPreview");
const skinName = document.getElementById("skinName");
const skinPrice = document.getElementById("skinPrice");
const prevSkinBtn = document.getElementById("prevSkin");
const nextSkinBtn = document.getElementById("nextSkin");
const buySkinBtn = document.getElementById("buySkin");

// Canvas
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
window.addEventListener("resize", resize);

// Name
let playerName = localStorage.getItem("playerName") || "";
if (!playerName) {
  nameIntro.style.display = "flex";
} else {
  nameIntro.style.display = "none";
}
nameConfirm.onclick = () => {
  const val = nameInput.value.trim();
  if (!val) return;
  playerName = val;
  localStorage.setItem("playerName", playerName);
  nameIntro.style.display = "none";
};

// Portrait overlay
function checkOrientation() {
  if (window.innerHeight > window.innerWidth) {
    portraitOverlay.style.display = "flex";
  } else {
    portraitOverlay.style.display = "none";
  }
}
checkOrientation();
window.addEventListener("resize", checkOrientation);
stayPortrait.onclick = () => {
  portraitOverlay.style.display = "none";
};

// Player + world
let player = {
  x: 0,
  y: 0,
  dir: 0,
  speed: 4,
  hp: 100,
  ammo: 30,
  abilityCooldown: 0,
  speedBoostUntil: 0,
  speedBoostMultiplier: 1.6,
  damageBoostUntil: 0,
  shield: 0,
  frozenUntil: 0,
  poisonUntil: 0,
  poisonDamage: 0
};

let coins = Number(localStorage.getItem("coins")) || 0;
let players = {};
let pickups = {};
let stats = {};
let killfeed = [];
let lastDeathTime = 0;

// Skins + abilities
let skins = [
  {
    name: "Default",
    price: 0,
    abilityType: "dash",
    abilityPower: 80,
    cooldown: 5000,
    draw: (ctx, x, y) => {
      ctx.fillStyle = "cyan";
      ctx.fillRect(x, y, 40, 40);
    }
  },
  {
    name: "Neon",
    price: 150,
    abilityType: "speed",
    abilityPower: 1.8,
    cooldown: 6000,
    draw: (ctx, x, y) => {
      ctx.save();
      ctx.shadowColor = "#0ff";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#0ff";
      ctx.fillRect(x, y, 40, 40);
      ctx.restore();
    }
  },
  {
    name: "Lava",
    price: 300,
    abilityType: "burst",
    abilityPower: 5,
    cooldown: 7000,
    draw: (ctx, x, y) => {
      let g = ctx.createLinearGradient(x, y, x+40, y+40);
      g.addColorStop(0, "#f00");
      g.addColorStop(1, "#ffa500");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 40, 40);
    }
  },
  {
    name: "Toxic",
    price: 400,
    abilityType: "poison",
    abilityPower: 5,
    cooldown: 8000,
    draw: (ctx, x, y) => {
      ctx.fillStyle = "#0f0";
      ctx.fillRect(x, y, 40, 40);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x+10, y+10);
      ctx.lineTo(x+30, y+30);
      ctx.moveTo(x+30, y+10);
      ctx.lineTo(x+10, y+30);
      ctx.stroke();
    }
  },
  {
    name: "Ice",
    price: 500,
    abilityType: "freeze",
    abilityPower: 2000,
    cooldown: 9000,
    draw: (ctx, x, y) => {
      let g = ctx.createLinearGradient(x, y, x+40, y+40);
      g.addColorStop(0, "#aaf");
      g.addColorStop(1, "#fff");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 40, 40);
    }
  },
  {
    name: "Shadow",
    price: 700,
    abilityType: "blink",
    abilityPower: 200,
    cooldown: 6000,
    draw: (ctx, x, y) => {
      ctx.save();
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 25;
      ctx.fillStyle = "#111";
      ctx.fillRect(x, y, 40, 40);
      ctx.restore();
    }
  }
];

let ownedSkins = { "Default": true };
let savedOwned = localStorage.getItem("ownedSkins");
let savedSkin = localStorage.getItem("currentSkin");
if (savedOwned) ownedSkins = JSON.parse(savedOwned);
let currentSkinIndex = 0;
let currentSkin = skins[0];
if (savedSkin) {
  const found = skins.find(s => s.name === savedSkin);
  if (found) currentSkin = found;
}
function saveSkins() {
  localStorage.setItem("ownedSkins", JSON.stringify(ownedSkins));
  localStorage.setItem("currentSkin", currentSkin.name);
}
function saveCoins() {
  localStorage.setItem("coins", coins);
}
function updateShopUI() {
  const skin = skins[currentSkinIndex];
  const temp = document.createElement("canvas");
  temp.width = 40;
  temp.height = 40;
  const tctx = temp.getContext("2d");
  skin.draw(tctx, 0, 0);
  skinPreview.style.backgroundImage = `url(${temp.toDataURL()})`;
  skinPreview.style.backgroundSize = "cover";
  skinName.textContent = skin.name;
  skinPrice.textContent = "Price: " + skin.price + " coins";
  coinsHUD.textContent = "Coins: " + Math.floor(coins);
  if (ownedSkins[skin.name]) buySkinBtn.textContent = "Equip";
  else buySkinBtn.textContent = "Buy";
}
prevSkinBtn.onclick = () => {
  currentSkinIndex = (currentSkinIndex - 1 + skins.length) % skins.length;
  updateShopUI();
};
nextSkinBtn.onclick = () => {
  currentSkinIndex = (currentSkinIndex + 1) % skins.length;
  updateShopUI();
};
buySkinBtn.onclick = () => {
  const skin = skins[currentSkinIndex];
  if (!ownedSkins[skin.name]) {
    if (coins >= skin.price && connected) {
      coins -= skin.price;
      ownedSkins[skin.name] = true;
      saveSkins();
      saveCoins();
    } else return;
  }
  currentSkin = skin;
  saveSkins();
  updateShopUI();
};
updateShopUI();

// Joystick
const joyArea = document.getElementById("joystick-area");
const joy = document.getElementById("joystick");
let joyX = 0, joyY = 0;
joyArea.addEventListener("touchmove", e => {
  const rect = joyArea.getBoundingClientRect();
  const t = e.touches[0];
  let dx = t.clientX - (rect.left + rect.width / 2);
  let dy = t.clientY - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  const max = 50;
  if (dist > max) {
    dx = dx / dist * max;
    dy = dy / dist * max;
  }
  joy.style.left = (40 + dx) + "px";
  joy.style.top = (40 + dy) + "px";
  joyX = dx / max;
  joyY = dy / max;
  if (dx !== 0 || dy !== 0) {
    player.dir = Math.atan2(dy, dx);
  }
});
joyArea.addEventListener("touchend", () => {
  joy.style.left = "40px";
  joy.style.top = "40px";
  joyX = 0;
  joyY = 0;
});

// Shoot
let bullets = [];
const shootBtn = document.getElementById("shoot-btn");
shootBtn.addEventListener("touchstart", () => {
  fireBullet();
});

function fireBullet(multiplier = 1) {
  if (!connected) return;
  if (player.ammo <= 0) return;

  const shots = Math.min(multiplier, player.ammo);

  for (let i = 0; i < shots; i++) {
    player.ammo--;

    const spread = (shots > 1) ? (i - (shots - 1) / 2) * 0.15 : 0;
    const dir = player.dir + spread;

    bullets.push({
      x: player.x,
      y: player.y,
      dx: Math.cos(dir) * 12,
      dy: Math.sin(dir) * 12,
      owner: myId
    });
  }
}

// Ability button
const abilityBtn = document.createElement("button");
abilityBtn.textContent = "ABILITY";
abilityBtn.style.position = "fixed";
abilityBtn.style.bottom = "150px";
abilityBtn.style.right = "40px";
abilityBtn.style.zIndex = "12";
abilityBtn.style.padding = "6px 10px";
abilityBtn.style.borderRadius = "999px";
abilityBtn.style.border = "2px solid #0af";
abilityBtn.style.background = "rgba(0,0,0,0.7)";
abilityBtn.style.color = "white";
abilityBtn.style.fontSize = "12px";
abilityBtn.style.boxShadow = "0 0 10px #0af";
document.body.appendChild(abilityBtn);

abilityBtn.addEventListener("touchstart", () => {
  useAbility();
});

function useAbility() {
  const now = Date.now();
  if (player.abilityCooldown > now) return;

  const type = currentSkin.abilityType;
  const power = currentSkin.abilityPower;
  const half = worldSize / 2;

  if (type === "dash") {
    const dashDist = power;
    let newX = player.x + Math.cos(player.dir) * dashDist;
    let newY = player.y + Math.sin(player.dir) * dashDist;

    newX = Math.max(-half + 20, Math.min(half - 20, newX));
    newY = Math.max(-half + 20, Math.min(half - 20, newY));

    let hitWall = walls.some(w =>
      rectCollides(newX - 20, newY - 20, 40, 40, w.x, w.y, w.w, w.h)
    );

    if (!hitWall) {
      player.x = newX;
      player.y = newY;
    }
  }

  if (type === "speed") {
    const now = Date.now();
    player.speedBoostUntil = now + 3000;
    player.speedBoostMultiplier = power;
  }

  if (type === "burst") {
    fireBullet(power);
  }

  if (type === "blink") {
    const blinkDist = power;
    let newX = player.x + Math.cos(player.dir) * blinkDist;
    let newY = player.y + Math.sin(player.dir) * blinkDist;

    newX = Math.max(-half + 20, Math.min(half - 20, newX));
    newY = Math.max(-half + 20, Math.min(half - 20, newY));

    let hitWall = walls.some(w =>
      rectCollides(newX - 20, newY - 20, 40, 40, w.x, w.y, w.w, w.h)
    );

    if (!hitWall) {
      player.x = newX;
      player.y = newY;
    }
  }

  if (type === "freeze") {
    let closest = null;
    let dist = 99999;
    for (let id in players) {
      if (id === myId) continue;
      const pl = players[id];
      const d = Math.hypot(pl.x - player.x, pl.y - player.y);
      if (d < dist) {
        dist = d;
        closest = id;
      }
    }
    if (closest) {
      socket.send(JSON.stringify({
        type: "freeze",
        targetId: closest,
        duration: power
      }));
    }
  }

  if (type === "poison") {
    let closest = null;
    let dist = 99999;
    for (let id in players) {
      if (id === myId) continue;
      const pl = players[id];
      const d = Math.hypot(pl.x - player.x, pl.y - player.y);
      if (d < dist) {
        dist = d;
        closest = id;
      }
    }
    if (closest) {
      socket.send(JSON.stringify({
        type: "poison",
        targetId: closest,
        damage: power
      }));
    }
  }

  player.abilityCooldown = now + currentSkin.cooldown;
}

// World walls + border
let walls = [
  { x: -300, y: -200, w: 300, h: 80 },
  { x: 200, y: 150, w: 250, h: 120 },
  { x: -150, y: 300, w: 200, h: 150 }
];

function rectCollides(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw &&
         ax + aw > bx &&
         ay < by + bh &&
         ay + ah > by;
}

// Menu toggle
menuToggle.onclick = () => {
  const show = menu.style.display === "none";
  menu.style.display = show ? "block" : "none";
  shop.style.display = show ? "block" : "none";
};

// Draggable UI
[menu, shop, scoreboard].forEach(makeDraggable);

function makeDraggable(el) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function start(e) {
    dragging = true;
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    el.style.transform = "none";
    el.style.left = rect.left + "px";
    el.style.top = rect.top + "px";
    el.style.position = "fixed";
  }

  function move(e) {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    el.style.left = (clientX - offsetX) + "px";
    el.style.top = (clientY - offsetY) + "px";
  }

  function end() {
    dragging = false;
  }

  el.addEventListener("mousedown", start);
  el.addEventListener("touchstart", start);
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move);
  window.addEventListener("mouseup", end);
  window.addEventListener("touchend", end);
}

// Room buttons
createBtn.onclick = () => {
  if (!playerName) return;
  socket.send(JSON.stringify({ type: "create_room", name: playerName }));
};
joinBtn.onclick = () => {
  if (!playerName) return;
  const code = roomInput.value.toUpperCase();
  if (!code) return;
  socket.send(JSON.stringify({ type: "join_room", code, name: playerName }));
};

// Scoreboard
scoreBtn.onclick = () => {
  if (!connected) return;
  const visible = scoreboard.style.display === "block";
  if (visible) {
    scoreboard.style.display = "none";
  } else {
    socket.send(JSON.stringify({ type: "scoreboard" }));
    scoreboard.style.display = "block";
  }
};

// Socket
socket.onmessage = msg => {
  const data = JSON.parse(msg.data);

  if (data.type === "room_created") {
    roomCode = data.code;
    myId = data.id;
    worldSize = data.worldSize || worldSize;
    roomDisplay.textContent = "Room: " + roomCode;
    roomHUD.textContent = "Room: " + roomCode;
    menu.style.display = "none";
    shop.style.display = "none";
    connected = true;
  }

  if (data.type === "room_joined") {
    roomCode = data.code;
    myId = data.id;
    worldSize = data.worldSize || worldSize;
    roomDisplay.textContent = "Joined: " + roomCode;
    roomHUD.textContent = "Room: " + roomCode;
    menu.style.display = "none";
    shop.style.display = "none";
    connected = true;
  }

  if (data.type === "players") {
    players = data.players || {};
    pickups = data.pickups || {};
    stats = data.stats || {};
    if (players[myId]) {
      player.hp = players[myId].hp;
      player.ammo = players[myId].ammo;
    }
    if (data.worldSize) worldSize = data.worldSize;
  }

  if (data.type === "killfeed") {
    killfeed.push(`${data.killer} eliminated ${data.victim}`);
    if (data.victim === playerName) {
      lastDeathTime = Date.now();
    }
    setTimeout(() => {
      killfeed.shift();
    }, 5000);
  }

  if (data.type === "scoreboard") {
    const s = data.stats || {};
    const pl = data.players || {};
    scoreTable.innerHTML = `
      <tr><th>Name</th><th>K</th><th>D</th><th>DMG</th></tr>
    `;
    Object.keys(pl).forEach(id => {
      const st = s[id] || { kills: 0, deaths: 0, damage: 0 };
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${pl[id].name}</td>
        <td>${st.kills || 0}</td>
        <td>${st.deaths || 0}</td>
        <td>${st.damage || 0}</td>
      `;
      scoreTable.appendChild(row);
    });
  }

  if (data.type === "freeze_effect") {
    if (data.targetId === myId) {
      player.frozenUntil = Date.now() + data.duration;
    }
  }

  if (data.type === "poison_effect") {
    if (data.targetId === myId) {
      player.poisonUntil = Date.now() + 3000;
      player.poisonDamage = data.damage;
    }
  }
};

// Killfeed render
function renderKillfeed() {
  killfeedDiv.innerHTML = "";
  killfeed.forEach(line => {
    const p = document.createElement("div");
    p.textContent = line;
    killfeedDiv.appendChild(p);
  });
}

// Lerp
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Game loop
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const now = Date.now();
  const half = worldSize / 2;

  // Kamera
  ctx.save();
  ctx.translate(canvas.width/2 - player.x, canvas.height/2 - player.y);

  // Bakgrunn
  ctx.fillStyle = "#222";
  ctx.fillRect(-half, -half, worldSize, worldSize);

  // Pulsende neon‑border
  const pulse = (Math.sin(Date.now() / 400) + 1) / 2; // 0–1
  ctx.strokeStyle = `rgba(0,200,255,${0.6 + pulse * 0.4})`;
  ctx.lineWidth = 6;
  ctx.shadowColor = "#00c8ff";
  ctx.shadowBlur = 25 + pulse * 15;
  ctx.strokeRect(-half, -half, worldSize, worldSize);
  ctx.shadowBlur = 0;

  // Vegger
  ctx.fillStyle = "#555";
  walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

  // Ultra smooth movement
  let speed = player.speed;
  if (player.speedBoostUntil > now) {
    speed *= player.speedBoostMultiplier || 1.6;
  }

  let desiredX = player.x + joyX * speed;
  let desiredY = player.y + joyY * speed;

  desiredX = Math.max(-half + 20, Math.min(half - 20, desiredX));
  desiredY = Math.max(-half + 20, Math.min(half - 20, desiredY));

  let blocked = walls.some(w =>
    rectCollides(desiredX - 20, desiredY - 20, 40, 40, w.x, w.y, w.w, w.h)
  );

  if (player.frozenUntil > now) {
    desiredX = player.x;
    desiredY = player.y;
    joyX = 0;
    joyY = 0;
  }

  if (!blocked) {
    player.x = lerp(player.x, desiredX, 0.15);
    player.y = lerp(player.y, desiredY, 0.15);
  }

  // Poison
  if (player.poisonUntil > now) {
    if (Math.random() < 0.05) {
      player.hp -= player.poisonDamage;
    }
  }

  // HUD
  hpHUD.textContent = "";
  ammoHUD.textContent = "AMMO: " + player.ammo;
  coinsHUD.textContent = "Coins: " + Math.floor(coins);

  // Pickups
  Object.values(pickups).forEach(pk => {
    if (pk.type === "ammo") ctx.fillStyle = "yellow";
    else if (pk.type === "speed") ctx.fillStyle = "blue";
    else if (pk.type === "shield") ctx.fillStyle = "cyan";
    else if (pk.type === "damage") ctx.fillStyle = "red";
    ctx.fillRect(pk.x - 10, pk.y - 10, 20, 20);

    if (rectCollides(player.x - 20, player.y - 20, 40, 40, pk.x - 10, pk.y - 10, 20, 20)) {
      if (connected) {
        socket.send(JSON.stringify({ type: "pickup", id: pk.id }));
      }
    }
  });

  // Players
  for (let id in players) {
    const pl = players[id];
    const skin = skins.find(s => s.name === pl.skin) || skins[0];
    skin.draw(ctx, pl.x - 20, pl.y - 20);

    const hpRatio = Math.max(0, Math.min(1, pl.hp / 100));
    ctx.fillStyle = "black";
    ctx.fillRect(pl.x - 22, pl.y - 32, 44, 6);
    ctx.fillStyle = "#00aaff";
    ctx.fillRect(pl.x - 22, pl.y - 32, 44 * hpRatio, 6);

    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(pl.name || "Player", pl.x, pl.y - 40);
  }

  if (!players[myId]) {
    currentSkin.draw(ctx, player.x - 20, player.y - 20);
    const hpRatio = Math.max(0, Math.min(1, player.hp / 100));
    ctx.fillStyle = "black";
    ctx.fillRect(player.x - 22, player.y - 32, 44, 6);
    ctx.fillStyle = "#00aaff";
    ctx.fillRect(player.x - 22, player.y - 32, 44 * hpRatio, 6);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(playerName || "Player", player.x, player.y - 40);
  }

  // Bullets
  ctx.fillStyle = "yellow";
  bullets.forEach((b, i) => {
    b.x += b.dx;
    b.y += b.dy;
    ctx.fillRect(b.x - 5, b.y - 5, 10, 10);

    let hitWall = walls.some(w =>
      rectCollides(b.x - 5, b.y - 5, 10, 10, w.x, w.y, w.w, w.h)
    );
    if (hitWall) {
      bullets.splice(i, 1);
      return;
    }

    for (let id in players) {
      if (id === myId) continue;
      const pl = players[id];
      if (rectCollides(b.x - 5, b.y - 5, 10, 10, pl.x - 20, pl.y - 20, 40, 40)) {
        bullets.splice(i, 1);
        if (connected) {
          let dmg = 20;
          if (player.damageBoostUntil > now) dmg = 40;
          coins += 10;
          saveCoins();
          socket.send(JSON.stringify({
            type: "hit",
            targetId: id,
            damage: dmg
          }));
        }
        break;
      }
    }
  });

  ctx.restore();

  // Death screen
  if (Date.now() - lastDeathTime < 5000) {
    ctx.fillStyle = `rgba(0,0,0,0.7)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Respawning...", canvas.width / 2, canvas.height / 2);
  }

  // Freeze/poison tint
  if (player.frozenUntil > now) {
    ctx.fillStyle = "rgba(0,150,255,0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (player.poisonUntil > now) {
    ctx.fillStyle = "rgba(0,255,0,0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Ability cooldown HUD
  const nowCD = Date.now();
  const remaining = Math.max(0, player.abilityCooldown - nowCD);
  const ratio = currentSkin.cooldown ? 1 - remaining / currentSkin.cooldown : 1;
  abilityBtn.style.opacity = remaining > 0 ? "0.4" : "1";
  abilityBtn.style.boxShadow = remaining > 0
    ? "0 0 4px #555"
    : "0 0 10px #0af";

  // Send update
  if (connected && myId && playerName) {
    socket.send(JSON.stringify({
      type: "update",
      x: player.x,
      y: player.y,
      dir: player.dir,
      skin: currentSkin.name,
      name: playerName,
      hp: player.hp,
      ammo: player.ammo,
      abilityCooldown: player.abilityCooldown
    }));
  }

  renderKillfeed();
  requestAnimationFrame(loop);
}

loop();
