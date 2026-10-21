(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const floorY = 600;
    const hoop = { x: 1080, y: 280, radius: 38 };
    const keys = new Set();
    const pressed = new Set();
    const crowd = [];

    const player = createPlayer(245, '#f97316', 'YOU', 48 * Math.PI / 180);
    const bot = createPlayer(830, '#3b82f6', 'BOT', 54 * Math.PI / 180);
    let running = false;
    let playerScore = 0;
    let botScore = 0;
    let matchTime = 120;
    let previousFrame = 0;
    let celebration = 0;
    let bannerTimeout = 0;

    function createPlayer(x, color, name, angle) {
        return {
            x, y: floorY, vx: 0, vy: 0, color, name, angle, defaultAngle: angle,
            ball: { x: 0, y: 0, vx: 0, vy: 0, launched: false, age: 0, previousY: 0 },
            dribblePhase: 0, crossover: 0, moveType: 'crossover', shootPose: 0, grounded: true, botShotTimer: 2.4
        };
    }

    function resetPlayer(p, x) {
        p.x = x;
        p.y = floorY;
        p.vx = 0;
        p.vy = 0;
        p.dribblePhase = 0;
        p.crossover = 0;
        p.moveType = 'crossover';
        p.angle = p.defaultAngle;
        p.shootPose = 0;
        p.grounded = true;
        p.ball.launched = false;
        p.ball.age = 0;
        p.ball.vx = 0;
        p.ball.vy = 0;
        p.botShotTimer = 2.4;
    }

    function makeCrowd() {
        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < 25; i++) {
                crowd.push({
                    x: 22 + i * 50 + (row % 2) * 17,
                    y: 330 + row * 53,
                    color: ['#f472b6', '#60a5fa', '#fbbf24', '#a78bfa', '#34d399'][Math.floor(Math.random() * 5)],
                    phase: Math.random() * Math.PI * 2,
                    size: 0.75 + Math.random() * 0.5
                });
            }
        }
    }
    makeCrowd();

    const playerScoreEl = document.getElementById('player-score');
    const botScoreEl = document.getElementById('bot-score');
    const timerEl = document.getElementById('match-timer');
    const hud = document.getElementById('hud');
    const startMenu = document.getElementById('start-menu');
    const endOverlay = document.getElementById('end-overlay');
    const scoreBanner = document.getElementById('score-banner');

    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function updateTimer() {
        const seconds = Math.max(0, Math.ceil(matchTime));
        timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function startGame() {
        playerScore = 0;
        botScore = 0;
        matchTime = 120;
        celebration = 0;
        playerScoreEl.textContent = '0';
        botScoreEl.textContent = '0';
        updateTimer();
        resetPlayer(player, 245);
        resetPlayer(bot, 830);
        startMenu.classList.add('hidden');
        endOverlay.classList.add('hidden');
        hud.classList.remove('hidden');
        document.getElementById('touch-controls').classList.remove('hidden');
        running = true;
        previousFrame = 0;
        requestAnimationFrame(gameLoop);
    }

    function finishGame() {
        running = false;
        document.getElementById('touch-controls').classList.add('hidden');
        hud.classList.add('hidden');
        document.getElementById('final-player-score').textContent = playerScore;
        document.getElementById('final-bot-score').textContent = botScore;
        document.getElementById('winner-text').textContent =
            playerScore === botScore ? 'DRAW GAME!' : playerScore > botScore ? 'YOU WIN!' : 'BOT WINS!';
        endOverlay.classList.remove('hidden');
    }

    function launchShot(p) {
        if (p.ball.launched) return;
        const origin = ballHandPosition(p);
        p.ball.x = origin.x;
        p.ball.y = origin.y;
        p.ball.previousY = origin.y;
        p.ball.vx = Math.cos(p.angle) * 19.5;
        p.ball.vy = -Math.sin(p.angle) * 19.5;
        p.ball.age = 0;
        p.ball.launched = true;
        p.shootPose = 0.45;
        if (p === bot) p.botShotTimer = 2.6 + Math.random() * 1.2;
    }

    function ballHandPosition(p) {
        const side = p.crossover > 0
            ? Math.sin(p.crossover * 17) * (p.moveType === 'behind' ? -28 : 20)
            : 0;
        return { x: p.x + 27 + side, y: p.y - 75 };
    }

    function score(p) {
        if (p === player) {
            playerScore++;
            playerScoreEl.textContent = playerScore;
            scoreBanner.textContent = 'SWISH! THE CROWD IS FEELING IT!';
        } else {
            botScore++;
            botScoreEl.textContent = botScore;
            scoreBanner.textContent = 'BOT SCORES! THE CROWD KEEPS DANCING!';
        }
        celebration = 5;
        scoreBanner.classList.remove('hidden');
        window.clearTimeout(bannerTimeout);
        bannerTimeout = window.setTimeout(() => scoreBanner.classList.add('hidden'), 2600);
        p.ball.launched = false;
        p.ball.age = 0;
        p.shootPose = 0.25;
        playScoreSound();
    }

    function playScoreSound() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(660, audio.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(990, audio.currentTime + 0.12);
            gain.gain.setValueAtTime(0.12, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.24);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.25);
            oscillator.onended = () => audio.close();
        } catch (error) {
            console.warn('Could not play score sound.', error);
        }
    }

    function updatePlayer(p, delta) {
        const seconds = delta / 1000;
        p.dribblePhase += seconds * (Math.abs(p.vx) > 0.5 ? 13 : 7);
        p.crossover = Math.max(0, p.crossover - seconds);
        p.shootPose = Math.max(0, p.shootPose - seconds);

        p.vy += 1500 * seconds;
        p.x += p.vx * seconds;
        p.y += p.vy * seconds;
        p.vx *= Math.pow(0.84, seconds);
        if (p.y >= floorY) {
            p.y = floorY;
            p.vy = 0;
            p.grounded = true;
        } else {
            p.grounded = false;
        }
        p.x = clamp(p.x, 60, 1000);
    }

    function updateBall(p, delta) {
        const b = p.ball;
        if (!b.launched) return;
        const seconds = delta / 1000;
        const frames = seconds * 60;
        b.previousY = b.y;
        b.x += b.vx * frames;
        b.y += b.vy * frames + 0.17 * frames * frames;
        b.vy += 0.34 * frames;
        b.age += seconds;

        if (b.previousY < hoop.y && b.y >= hoop.y &&
            b.x > hoop.x - hoop.radius + 9 && b.x < hoop.x + hoop.radius - 9 &&
            b.vy > 0) {
            score(p);
            return;
        }

        if (b.age > 3.8 || b.y > floorY + 80 || b.x > 1270 || b.x < 0) {
            b.launched = false;
            b.age = 0;
        }
    }

    function resolveDefender() {
        const horizontalDistance = player.x - bot.x;
        if (Math.abs(horizontalDistance) >= 44 || Math.abs(player.y - bot.y) >= 70) return;

        if (player.crossover > 0 && horizontalDistance < 0) {
            player.x = bot.x + 44;
            player.vx = Math.max(player.vx, 220);
            return;
        }

        player.x = horizontalDistance < 0 ? bot.x - 44 : bot.x + 44;
        player.vx = 0;
    }

    function updateGame(delta) {
        const seconds = delta / 1000;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) player.vx -= 760 * seconds;
        if (keys.has('KeyD') || keys.has('ArrowRight')) player.vx += 760 * seconds;
        if (keys.has('ArrowUp')) player.angle = clamp(player.angle + seconds * 1.15, 0.3, 1.25);
        if (keys.has('ArrowDown')) player.angle = clamp(player.angle - seconds * 1.15, 0.3, 1.25);

        if (pressed.has('KeyW') && player.grounded) player.vy = -580;
        if (pressed.has('Space')) launchShot(player);
        if (pressed.has('KeyE')) {
            player.moveType = 'behind';
            player.crossover = 0.9;
            player.vx += 220;
        } else if (pressed.has('ShiftLeft') || pressed.has('ShiftRight')) {
            player.moveType = 'crossover';
            player.crossover = 0.65;
            player.vx += 380;
        }
        pressed.clear();

        bot.botShotTimer -= seconds;
        if (bot.botShotTimer <= 0 && !bot.ball.launched) {
            bot.angle = clamp(0.94 + (Math.random() - 0.5) * 0.12, 0.85, 1.03);
            launchShot(bot);
        }

        updatePlayer(player, delta);
        updatePlayer(bot, delta);
        resolveDefender();
        updateBall(player, delta);
        updateBall(bot, delta);
        celebration = Math.max(0, celebration - seconds);
        matchTime -= seconds;
        updateTimer();

        if (matchTime <= 0 || playerScore >= 11 || botScore >= 11) finishGame();
    }

    function gameLoop(timestamp) {
        if (!running) return;
        const delta = previousFrame ? Math.min(timestamp - previousFrame, 40) : 16.67;
        previousFrame = timestamp;
        updateGame(delta);
        drawGame(timestamp / 1000);
        if (running) requestAnimationFrame(gameLoop);
    }

    function drawArena(time) {
        const bg = ctx.createLinearGradient(0, 0, 0, floorY);
        bg.addColorStop(0, '#101a32');
        bg.addColorStop(1, '#26344a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1280, 720);

        ctx.fillStyle = '#18253b';
        ctx.fillRect(0, 290, 1280, 190);
        for (let i = 0; i < 8; i++) {
            const x = 65 + i * 165;
            ctx.fillStyle = `rgba(255,255,210,${0.05 + Math.sin(time * 2 + i) * 0.025})`;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x - 120, 305);
            ctx.lineTo(x + 120, 305);
            ctx.closePath();
            ctx.fill();
        }

        drawCrowd(time);
        const floor = ctx.createLinearGradient(0, 590, 0, 720);
        floor.addColorStop(0, '#d38a3b');
        floor.addColorStop(1, '#6c3c19');
        ctx.fillStyle = floor;
        ctx.fillRect(0, 590, 1280, 130);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(1280, floorY);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff77';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(640, floorY, 85, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hoop.x, floorY, 320, Math.PI, Math.PI * 1.5);
        ctx.stroke();
    }

    function drawCrowd(time) {
        const dancing = celebration > 0;
        crowd.forEach(person => {
            const beat = time * (dancing ? 11 : 2.5) + person.phase;
            const step = Math.sin(beat);
            const hop = dancing ? Math.abs(Math.sin(beat * 0.7)) * 12 : Math.max(0, step) * 2;
            const lean = dancing ? step * 0.24 : 0;
            const scale = person.size;
            ctx.save();
            ctx.translate(person.x, person.y - hop);
            ctx.rotate(lean);
            ctx.fillStyle = person.color;
            ctx.beginPath();
            ctx.arc(0, -12 * scale, 7 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-6 * scale, -4 * scale, 12 * scale, 19 * scale);
            ctx.strokeStyle = person.color;
            ctx.lineWidth = 3 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const armSwing = dancing ? step * 12 : Math.sin(beat) * 4;
            ctx.moveTo(-4 * scale, 1 * scale);
            ctx.lineTo(-12 * scale, -8 * scale - armSwing);
            ctx.moveTo(4 * scale, 1 * scale);
            ctx.lineTo(12 * scale, -8 * scale + armSwing);
            ctx.moveTo(-3 * scale, 14 * scale);
            ctx.lineTo(-7 * scale, 22 * scale + (dancing ? step * 5 : 0));
            ctx.moveTo(3 * scale, 14 * scale);
            ctx.lineTo(7 * scale, 22 * scale - (dancing ? step * 5 : 0));
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawHoop() {
        ctx.fillStyle = '#334155';
        ctx.fillRect(1130, 260, 18, 335);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(1117, 190, 14, 125);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.strokeRect(1118, 229, 12, 47);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(hoop.x - hoop.radius, hoop.y);
        ctx.lineTo(hoop.x + hoop.radius, hoop.y);
        ctx.stroke();
        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const x = hoop.x - hoop.radius + i * (hoop.radius * 2 / 6);
            ctx.moveTo(x, hoop.y + 3);
            ctx.lineTo(hoop.x + (i - 3) * 8, hoop.y + 52);
        }
        ctx.stroke();
    }

    function drawAimGuide(p) {
        if (p !== player || p.ball.launched) return;
        const origin = ballHandPosition(p);
        const speed = 19.5;
        ctx.save();
        ctx.fillStyle = '#fde68a';
        for (let frame = 4; frame < 70; frame += 4) {
            const t = frame / 60;
            const x = origin.x + Math.cos(p.angle) * speed * frame;
            const y = origin.y - Math.sin(p.angle) * speed * frame + 0.5 * 0.34 * frame * frame;
            if (y > floorY || x > 1250) break;
            const radius = frame % 8 === 4 ? 4 : 3;
            ctx.globalAlpha = 0.9 - frame / 110;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawPlayer(p, time) {
        const bob = p.grounded ? Math.abs(Math.sin(p.dribblePhase)) * (Math.abs(p.vx) > 40 ? 4 : 1) : 0;
        const feet = p.y - bob;
        const moving = Math.abs(p.vx) > 50;
        const legSwing = moving ? Math.sin(p.dribblePhase) * 13 : 0;
        const armRaise = p.shootPose > 0 ? 34 : 0;
        const crossDirection = p.moveType === 'behind' ? -1 : 1;
        const cross = p.crossover > 0
            ? Math.sin((0.9 - p.crossover) * 18) * 18 * crossDirection
            : 0;
        ctx.save();
        ctx.translate(p.x, feet);

        ctx.fillStyle = '#0006';
        ctx.beginPath();
        ctx.ellipse(0, 0, 31, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineCap = 'round';
        ctx.strokeStyle = '#172033';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(-7, -27);
        ctx.lineTo(-10 + legSwing, -5);
        ctx.moveTo(7, -27);
        ctx.lineTo(10 - legSwing, -5);
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-20 + legSwing, -8, 17, 7);
        ctx.fillRect(4 - legSwing, -8, 17, 7);

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-17, -69);
        ctx.lineTo(17, -69);
        ctx.lineTo(14, -27);
        ctx.lineTo(-14, -27);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#d9a17d';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-14, -62);
        ctx.lineTo(-27 + cross, -43);
        ctx.moveTo(14, -62);
        ctx.lineTo(28, -57 - armRaise);
        ctx.stroke();
        ctx.fillStyle = '#f2c09a';
        ctx.beginPath();
        ctx.arc(0, -84, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(0, -89, 15, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-15, -90, 30, 5);
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(6, -84, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '800 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(p.name, 0, -111);
        ctx.restore();

        if (p.ball.launched) {
            drawBall(p.ball.x, p.ball.y, 12, time * 9);
        } else {
            const hand = ballHandPosition(p);
            const bounce = p.shootPose > 0 ? 0 : Math.abs(Math.sin(p.dribblePhase)) * (moving ? 25 : 10);
            drawBall(hand.x, p.y - bounce - 20 - bob, 12, time * 5);
        }
    }

    function drawBall(x, y, radius, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        const gradient = ctx.createRadialGradient(-4, -5, 1, 0, 0, radius);
        gradient.addColorStop(0, '#fdba74');
        gradient.addColorStop(1, '#c2410c');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
        ctx.moveTo(-radius, 0);
        ctx.lineTo(radius, 0);
        ctx.moveTo(0, -radius);
        ctx.lineTo(0, radius);
        ctx.stroke();
        ctx.restore();
    }

    function drawGame(time) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawArena(time);
        drawHoop();
        drawAimGuide(player);
        drawPlayer(bot, time);
        drawPlayer(player, time);
    }

    function setAimFromPointer(event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * canvas.width / rect.width;
        const y = (event.clientY - rect.top) * canvas.height / rect.height;
        const hand = ballHandPosition(player);
        const distanceX = x - hand.x;
        if (distanceX < 1) return;
        const distanceY = y - hand.y;
        const speed = 19.5;
        const gravity = 0.34;
        const arcFactor = gravity * distanceX * distanceX / (2 * speed * speed);
        const discriminant = distanceX * distanceX - 4 * arcFactor * (arcFactor - distanceY);
        if (discriminant < 0) return;
        const tangent = (distanceX - Math.sqrt(discriminant)) / (2 * arcFactor);
        player.angle = clamp(Math.atan(tangent), 0.3, 1.25);
    }

    window.addEventListener('keydown', event => {
        const code = event.code;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) event.preventDefault();
        if (!keys.has(code)) pressed.add(code);
        keys.add(code);
    });
    window.addEventListener('keyup', event => keys.delete(event.code));
    window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });
    canvas.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse' && running) setAimFromPointer(event);
    });

    document.querySelectorAll('#touch-controls [data-key]').forEach(button => {
        const code = button.dataset.key;
        button.addEventListener('pointerdown', event => {
            event.preventDefault();
            if (!keys.has(code)) pressed.add(code);
            keys.add(code);
            button.setPointerCapture(event.pointerId);
        });
        const release = () => keys.delete(code);
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
    });

    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('replay-button').addEventListener('click', startGame);
    document.getElementById('menu-button').addEventListener('click', () => {
        endOverlay.classList.add('hidden');
        startMenu.classList.remove('hidden');
    });

    drawGame(0);
})();
