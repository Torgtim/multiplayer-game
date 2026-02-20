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

// Shop UI
const shop = document.getElementById("shop");
const coinsDisplay = document.getElementById("coinsDisplay");
const skinPreview = document.getElementById("skinPreview");
const skinName = document.getElementById("skinName");
const skinPrice = document.getElementById("skinPrice");
const prevSkinBtn = document.getElementById("prevSkin");
const nextSkinBtn = document.getElementById("nextSkin");
const buySkinBtn = document.getElementById("buySkin");

// === Canvas ===
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

// === Players ===
let player = { x: 200, y: 200, dir: 0, speed: 3 };
let enemy = { x: 400, y: 200, dir: 0 };

// === Bullets ===
let bullets = [];
let enemyBullets = [];

// === Walls ===
let walls = [
    { x: 300, y: 200, w: 200, h: 80 },
    { x: 100, y: 500, w: 150, h: 150 }
];

// === Skins (bare in-game coins, ikke ekte penger) ===
let coins = 0;
let skins = [
    { name: "Default", color: "cyan", price: 0 },
    { name: "Red", color: "red", price: 50 },
    { name: "Green", color: "lime", price: 50 },
    { name: "Purple", color: "magenta", price: 100 }
];
let ownedSkins = { "Default": true };
let currentSkinIndex = 0;
let currentSkin = skins[0];

function updateShopUI() {
    const skin = skins[currentSkinIndex];
    skinPreview.style.background = skin.color;
    skinName.textContent = skin.name;
    skinPrice.textContent = "Price: " + skin.price + " coins";
    coinsDisplay.textContent = coins;

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
        x: player.x + 20,
        y: player.y + 20,
        dx: Math.cos(player.dir) * 8,
        dy: Math.sin(player.dir) * 8
    });

    if (connected) {
        socket.send(JSON.stringify({
            type: "shoot",
            bullets: bullets
        }));
    }
});

// === COLLISION ===
function collides(px, py, w) {
    return px < w.x + w.w &&
           px + 40 > w.x &&
           py < w.y + w.h &&
           py + 40 > w.y;
}

// === MENU BUTTONS ===
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
        menu.style.display = "none";
        connected = true;
    }

    if (data.type === "room_joined") {
        roomCode = data.code;
        roomDisplay.textContent = "Joined room: " + roomCode;
        menu.style.display = "none";
        connected = true;
    }

    if (data.type === "update") {
        enemy.x = data.x;
        enemy.y = data.y;
        enemy.dir = data.dir;
    }

    if (data.type === "enemy_shoot") {
        enemyBullets = data.bullets;
    }
};

// === GAME LOOP ===
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw walls
    ctx.fillStyle = "#555";
    walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // Move player with collision
    let newX = player.x + joyX * player.speed;
    let newY = player.y + joyY * player.speed;

    let blocked = walls.some(w => collides(newX, newY, w));

    if (!blocked) {
        player.x = newX;
        player.y = newY;
    }

    // Draw player with current skin
    ctx.fillStyle = currentSkin.color;
    ctx.fillRect(player.x, player.y, 40, 40);

    // Draw enemy
    ctx.fillStyle = "orange";
    ctx.fillRect(enemy.x, enemy.y, 40, 40);

    // Update bullets
    bullets.forEach(b => {
        b.x += b.dx;
        b.y += b.dy;
        ctx.fillStyle = "yellow";
        ctx.fillRect(b.x, b.y, 10, 10);
    });

    // Enemy bullets
    enemyBullets.forEach(b => {
        ctx.fillStyle = "red";
        ctx.fillRect(b.x, b.y, 10, 10);
    });

    // Gi coins over tid (bare for testing)
    coins += 0.02;
    coinsDisplay.textContent = Math.floor(coins);

    // Send player update
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
