// === WebSocket ===
const socket = new WebSocket("wss://multiplayer-server-production-40dc.up.railway.app");

let roomCode = null;
let connected = false;

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

// Shop UI
const shop = document.getElementById("shop");
const coinsDisplay = document.getElementById("coinsHUD"); // vi bruker HUD‑en
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

// === Players ===
let player = { x: 0, y: 0, dir: 0, speed: 4, hp: 100 };
let enemy = { x: 300, y: 0, dir: 0, hp: 100 };

// === Bullets ===
let bullets = [];
let enemyBullets = [];

// === Walls ===
let walls = [
    { x: -200, y: -100, w: 200, h: 80 },
    { x: 200, y: 100, w: 250, h: 120 },
    { x: -100, y: 250, w: 150, h: 150 }
];

// === Skins ===
let coins = 0;
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
            let grad = ctx.createLinearGradient(x, y, x+40, y+40);
            grad.addColorStop(0, "#f00");
            grad.addColorStop(1, "#ffa500");
            ctx.fillStyle = grad;
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
    }
];

let ownedSkins = { "Default": true };
let currentSkinIndex = 0;
let currentSkin = skins[0];

function updateShopUI() {
    const skin = skins[currentSkinIndex];
    skinPreview.style.background = "transparent";
    // Tegn preview i et midlertidig canvas
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
        if (coins >= skin.price) {
            coins -= skin.price;
            ownedSkins[skin.name] = true;
        } else {
            return;
        }
    }
    currentSkin = skin;
    updateShopUI();
};

updateShopUI();

// === JOYSTICK ===
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

// === SHOOT BUTTON ===
document.getElementById("shoot-btn").addEventListener("touchstart", () => {
    bullets.push({
        x: player.x,
        y: player.y,
        dx: Math.cos(player.dir) * 10,
        dy: Math.sin(player.dir) * 10
    });
});

// === COLLISION ===
function rectCollides(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw &&
           ax + aw > bx &&
           ay < by + bh &&
           ay + ah > by;
}

function bulletHitsPlayer(b, p) {
    return rectCollides(b.x, b.y, 10, 10, p.x - 20, p.y - 20, 40, 40);
}

// === MENY ===
menuToggle.onclick = () => {
    menu.style.display = (menu.style.display === "none") ? "block" : "none";
};

createBtn.onclick = () => {
    socket.send(JSON.stringify({ type: "create_room" }));
};

joinBtn.onclick = () => {
    const code = roomInput.value.toUpperCase();
    socket.send(JSON.stringify({ type: "join_room", code }));
};

// === SOCKET EVENTS ===
socket.onmessage = msg => {
    const data = JSON.parse(msg.data);

    if (data.type === "room_created") {
        roomCode = data.code;
        roomDisplay.textContent = "Room: " + roomCode;
        roomHUD.textContent = "Room: " + roomCode;
        menu.style.display = "none";
        connected = true;
    }

    if (data.type === "room_joined") {
        roomCode = data.code;
        roomDisplay.textContent = "Joined: " + roomCode;
        roomHUD.textContent = "Room: " + roomCode;
        menu.style.display = "none";
        connected = true;
    }

    if (data.type === "update") {
        enemy.x = data.x;
        enemy.y = data.y;
        enemy.dir = data.dir;
    }
};

// === GAME LOOP ===
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Kamera følger spilleren
    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Bakgrunn
    ctx.fillStyle = "#222";
    ctx.fillRect(player.x - 1000, player.y - 1000, 2000, 2000);

    // Vegger
    ctx.fillStyle = "#555";
    walls.forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
    });

    // Bevegelse med kollisjon
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

    // Tegn enemy
    ctx.fillStyle = "orange";
    ctx.fillRect(enemy.x - 20, enemy.y - 20, 40, 40);

    // Tegn player med skin
    currentSkin.draw(ctx, player.x - 20, player.y - 20);

    // Oppdater og tegn bullets
    ctx.fillStyle = "yellow";
    bullets.forEach((b, i) => {
        b.x += b.dx;
        b.y += b.dy;
        ctx.fillRect(b.x - 5, b.y - 5, 10, 10);

        // Kollisjon med enemy (lokalt – gir coins)
        if (bulletHitsPlayer(b, enemy)) {
            bullets.splice(i, 1);
            coins += 10;
        }
    });

    ctx.restore();

    // Oppdater coins HUD
    coinsHUD.textContent = "Coins: " + Math.floor(coins);

    // Send posisjon til server
    if (connected) {
        socket.send(JSON.stringify({
            type: "update",
            x: player.x,
            y: player.y,
            dir: player.dir
        }));
    }

    requestAnimationFrame(loop);
}

loop();
