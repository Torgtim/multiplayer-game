// === WebSocket ===
const socket = new WebSocket("wss://multiplayer-server-production-40dc.up.railway.app");

let roomCode = null;
let connected = false;
let myId = null;

// === UI ===
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

// Shop UI
const shop = document.getElementById("shop");
const skinPreview = document.getElementById("skinPreview");
const skinName = document.getElementById("skinName");
const skinPrice = document.getElementById("skinPrice");
const prevSkinBtn = document.getElementById("prevSkin");
const nextSkinBtn = document.getElementById("nextSkin");
const buySkinBtn = document.getElementById("buySkin");

// === Canvas ===
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
window.addEventListener("resize", resize);

// === Player data ===
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

let player = { x: 0, y: 0, dir: 0, speed: 4, hp: 100 };
let coins = 0;

// alle spillere i rommet
let players = {}; // { id: {x,y,dir,skin,name,hp} }

// === Skins ===
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

  if (ownedSkins[skin.name]) {
    buySkinBtn.textContent = "Equip";
  } else {
    buySkinBtn.textContent = "Buy";
  }
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
    } else {
      return;
    }
  }
  currentSkin = skin;
  saveSkins();
  updateShopUI();
};

updateShopUI();

// === Joystick ===
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

// === Shoot ===
let bullets = [];

document.getElementById("shoot-btn").addEventListener("touchstart", () => {
  if (!connected) return;
  bullets.push({
    x: player.x,
    y: player.y,
    dx: Math.cos(player.dir) * 10,
    dy: Math.sin(player.dir) * 10,
    owner: myId
  });
});

// === World ===
let walls = [
  { x: -200, y: -100, w: 200, h: 80 },
  { x: 200, y: 100, w: 250, h: 120 },
  { x: -100, y: 250, w: 150, h: 150 }
];

function rectCollides(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw &&
         ax + aw > bx &&
         ay < by + bh &&
         ay + ah > by;
}

// === Menu toggle ===
menuToggle.onclick = () => {
  const show = menu.style.display === "none";
  menu.style.display = show ? "block" : "none";
  shop.style.display = show ? "block" : "none";
};

// === Room buttons ===
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

// === Socket events ===
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
    if (players[myId]) {
      player.hp = players[myId].hp;
    }
  }
};

// === Game loop ===
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Kamera
  ctx.save();
  ctx.translate(canvas.width/2 - player.x, canvas.height/2 - player.y);

  // Bakgrunn
  ctx.fillStyle = "#222";
  ctx.fillRect(player.x - 1000, player.y - 1000, 2000, 2000);

  // Vegger
  ctx.fillStyle = "#555";
  walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

  // Bevegelse
  let newX = player.x + joyX * player.speed;
  let newY = player.y + joyY * player.speed;

  let blocked = walls.some(w =>
    rectCollides(newX - 20, newY - 20, 40, 40, w.x, w.y, w.w, w.h)
  );

  if (!blocked) {
    player.x = newX;
    player.y = newY;
  }

  // Oppdater HP HUD
  hpHUD.textContent = "HP: " + Math.max(0, Math.floor(player.hp));
  coinsHUD.textContent = "Coins: " + Math.floor(coins);

  // Tegn alle spillere
  for (let id in players) {
    const pl = players[id];
    const skin = skins.find(s => s.name === pl.skin) || skins[0];

    skin.draw(ctx, pl.x - 20, pl.y - 20);

    // Nametag
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(pl.name || "Player", pl.x, pl.y - 30);
  }

  // Tegn deg selv hvis du ikke har sync ennå
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

  // Send posisjon til server
  if (connected && myId && playerName) {
    socket.send(JSON.stringify({
      type: "update",
      x: player.x,
      y: player.y,
      dir: player.dir,
      skin: currentSkin.name,
      name: playerName
    }));
  }

  requestAnimationFrame(loop);
}

loop();
