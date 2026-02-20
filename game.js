// === WebSocket connection ===
const socket = new WebSocket("wss://multiplayer-server-production-40dc.up.railway.app");

let playerId = Math.random().toString(36).substring(2, 8);
let roomCode = null;

socket.onopen = () => {
    console.log("Connected to server");
    socket.send(JSON.stringify({ type: "create_room" }));
};

socket.onmessage = msg => {
    const data = JSON.parse(msg.data);

    if (data.type === "room_created") {
        roomCode = data.code;
        console.log("Room created:", roomCode);
    }

    if (data.type === "update") {
        enemy.x = data.x;
        enemy.y = data.y;
        enemy.dir = data.dir;
    }
};

// === Canvas setup ===
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === Player objects ===
let player = { x: 200, y: 200, dir: 0, speed: 3 };
let enemy = { x: 200, y: 200, dir: 0 };

// === Joystick logic ===
const joyArea = document.getElementById("joystick-area");
const joy = document.getElementById("joystick");

let joyActive = false;
let joyX = 0;
let joyY = 0;

joyArea.addEventListener("touchstart", e => {
    joyActive = true;
});

joyArea.addEventListener("touchmove", e => {
    const rect = joyArea.getBoundingClientRect();
    const touch = e.touches[0];

    let dx = touch.clientX - (rect.left + rect.width / 2);
    let dy = touch.clientY - (rect.top + rect.height / 2);

    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = 50;

    if (dist > maxDist) {
        dx = dx / dist * maxDist;
        dy = dy / dist * maxDist;
    }

    joy.style.left = (40 + dx) + "px";
    joy.style.top = (40 + dy) + "px";

    joyX = dx / maxDist;
    joyY = dy / maxDist;
});

joyArea.addEventListener("touchend", () => {
    joyActive = false;
    joy.style.left = "40px";
    joy.style.top = "40px";
    joyX = 0;
    joyY = 0;
});

// === Game loop ===
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Move player
    player.x += joyX * player.speed;
    player.y += joyY * player.speed;

    // Draw player
    ctx.fillStyle = "cyan";
    ctx.fillRect(player.x, player.y, 40, 40);

    // Draw enemy
    ctx.fillStyle = "orange";
    ctx.fillRect(enemy.x, enemy.y, 40, 40);

    // Send update to server
    socket.send(JSON.stringify({
        type: "update",
        x: player.x,
        y: player.y,
        dir: player.dir
    }));

    requestAnimationFrame(loop);
}

loop();
