const socket = new WebSocket("wss://multiplayer-server-production-40dc.up.railway.app");

let roomCode = null;
let connected = false;
let myId = null;

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
let player = { x: 0, y: 0, dir: 0, speed: 4, hp: 100, ammo: 30 };
let coins = 0;
let players = {};
let pickups = {};
let stats = {};
let killfeed = [];

// Skins
let skins = [
  {
    name: "Default",
    price: 0,
    draw: (ctx, x, y) => {
      ctx.fillStyle = "cyan";
      ctx.fillRect(x, y, 40, 40);
    }
  },
  {
    name: "Neon",
    price: 50,
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
    price: 100,
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
    price: 120,
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
    price: 80,
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
    price: 150,
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
  player.dir = Math.atan2(dy, dx);
});
joyArea.addEventListener("touchend", () => {
  joy.style.left = "40px";
  joy.style.top = "40px";
  joyX = 0;
  joyY = 0;
});

// Shoot
let bullets = [];
document.getElementById("shoot-btn").addEventListener("touchstart", () => {
  if (!connected) return;
  if (player.ammo <= 0) return;
  player.ammo--;
  bullets.push({
    x: player.x,
    y: player.y,
    dx: Math.cos(player.dir) * 10,
    dy: Math.sin(player.dir) * 10,
    owner: myId
  });
});

// World
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
    roomDisplay.textContent = "Room: " + roomCode;
    roomHUD.textContent = "Room: " + roomCode;
    menu.style.display = "none";
    shop.style.display = "none";
    connected = true;
  }

  if (data.type === "room_joined") {
    roomCode = data.code;
    myId = data.id;
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
      player.x = players[myId].x;
      player.y = players[myId].y;
    }
  }

  if (data.type === "killfeed") {
    killfeed.push(`${data.killer} eliminated ${data.victim}`);
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

// Lerp movement
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Game loop
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Kamera
  ctx.save();
  ctx.translate(canvas.width/2 - player.x, canvas.height/2 - player.y);

  // Bakgrunn
  ctx.fillStyle = "#222";
  ctx.fillRect(-800, -800, 1600, 1600);

  // Vegger
  ctx.fillStyle = "#555";
  walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

  // Movement (smooth)
  let targetX = player.x + joyX * player.speed;
  let targetY = player.y + joyY * player.speed;
  let blocked = walls.some(w =>
    rectCollides(targetX - 20, targetY - 20, 40, 40, w.x, w.y, w.w, w.h)
  );
  if (!blocked) {
    player.x = lerp(player.x, targetX, 0.25);
    player.y = lerp(player.y, targetY, 0.25);
  }

  // HP + ammo HUD
  hpHUD.textContent = "HP: " + Math.max(0, Math.floor(player.hp));
  ammoHUD.textContent = "AMMO: " + player.ammo;
  coinsHUD.textContent = "Coins: " + Math.floor(coins);

  // Pickups
  Object.values(pickups).forEach(pk => {
    if (pk.type === "ammo") ctx.fillStyle = "yellow";
    else if (pk.type === "speed") ctx.fillStyle = "blue";
    else if (pk.type === "shield") ctx.fillStyle = "cyan";
    else if (pk.type === "damage") ctx.fillStyle = "red";
    ctx.fillRect(pk.x - 10, pk.y - 10, 20, 20);

    // pickup collision
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
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(pl.name || "Player", pl.x, pl.y - 30);
  }

  // Hvis vi ikke har sync på oss selv ennå
  if (!players[myId]) {
    currentSkin.draw(ctx, player.x - 20, player.y - 20);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(playerName || "Player", player.x, player.y - 30);
  }

  // Bullets
  ctx.fillStyle = "yellow";
  bullets.forEach((b, i) => {
    b.x += b.dx;
    b.y += b.dy;
    ctx.fillRect(b.x - 5, b.y - 5, 10, 10);

    // Treff andre spillere
    for (let id in players) {
      if (id === myId) continue;
      const pl = players[id];
      if (rectCollides(b.x - 5, b.y - 5, 10, 10, pl.x - 20, pl.y - 20, 40, 40)) {
        bullets.splice(i, 1);
        if (connected) {
          coins += 10;
          socket.send(JSON.stringify({
            type: "hit",
            targetId: id,
            damage: 20
          }));
        }
        break;
      }
    }
  });

  ctx.restore();

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
      ammo: player.ammo
    }));
  }

  renderKillfeed();
  requestAnimationFrame(loop);
}

loop();
