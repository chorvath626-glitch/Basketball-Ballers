(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const floorY = 600;
    const hoops = {
        left: { x: 200, y: 280, radius: 38, boardX: 162, direction: -1 },
        right: { x: 1080, y: 280, radius: 38, boardX: 1118, direction: 1 }
    };
    const keys = new Set();
    const pressed = new Set();
    const crowd = [];

    const roster = {
        curry: { name: 'STEPHEN CURRY', color: '#2563eb', accent: '#facc15', number: '30', pattern: 'stripes' },
        lebron: { name: 'LEBRON JAMES', color: '#6d28d9', accent: '#facc15', number: '23', pattern: 'crown' },
        jordan: { name: 'MICHAEL JORDAN', color: '#b91c1c', accent: '#111827', number: '23', pattern: 'chevrons' },
        kobe: { name: 'KOBE BRYANT', color: '#7c3aed', accent: '#facc15', number: '24', pattern: 'slashes' },
        giannis: { name: 'GIANNIS', color: '#15803d', accent: '#ec4899', number: '34', pattern: 'blocks' },
        mrt: { name: 'MR. T', color: '#111827', accent: '#fbbf24', number: '1', pattern: 'diamond', mrT: true }
    };
    const player = createPlayer(245, '#2563eb', 'YOU', 48 * Math.PI / 180);
    const bot = createPlayer(830, '#3b82f6', 'BOT', 54 * Math.PI / 180);
    const playerChoice = document.getElementById('player-choice');
    let running = false;
    let playerScore = 0;
    let botScore = 0;
    let matchTime = 120;
    let playerOffense = true;
    let previousFrame = 0;
    let celebration = 0;
    let bannerTimeout = 0;

    function createPlayer(x, color, name, angle) {
        return {
            x, y: floorY, vx: 0, vy: 0, color, name, angle, defaultAngle: angle,
            ball: { x: 0, y: 0, vx: 0, vy: 0, launched: false, age: 0, previousX: 0, previousY: 0 },
            dribblePhase: 0, crossover: 0, moveType: 'crossover', shootPose: 0, renderLean: 0,
            jerseyPattern: 'stripes', jerseyNumber: '00', jerseyAccent: '#ffffff', mrT: false,
            blockTimer: 0, blockCooldown: 0, stealCooldown: 0, stealStun: 0, grounded: true, botShotTimer: 2.4
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
        p.renderLean = 0;
        p.angle = p.defaultAngle;
        p.shootPose = 0;
        p.blockTimer = 0;
        p.blockCooldown = 0;
        p.stealCooldown = 0;
        p.stealStun = 0;
        p.grounded = true;
        p.ball.launched = false;
        p.ball.age = 0;
        p.ball.vx = 0;
        p.ball.vy = 0;
        p.ball.previousX = 0;
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
    const roleStatusEl = document.getElementById('role-status');
    const hud = document.getElementById('hud');
    const startMenu = document.getElementById('start-menu');
    const endOverlay = document.getElementById('end-overlay');
    const scoreBanner = document.getElementById('score-banner');

    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function attackHoop() { return playerOffense ? hoops.right : hoops.left; }

    function facingDirection(p) {
        const hasBall = (p === player) === playerOffense;
        if (hasBall) return attackHoop().direction;
        const opponent = p === player ? bot : player;
        return Math.sign(opponent.x - p.x) || 1;
    }

    function updateTouchRole() {
        const control = key => document.querySelector(`#touch-controls [data-key="${key}"]`);
        control('Space').textContent = playerOffense ? 'SHOOT' : 'BLOCK';
        control('KeyR').classList.toggle('hidden', !playerOffense);
        control('ShiftLeft').textContent = playerOffense ? 'CROSS' : 'SLIDE';
        control('KeyE').textContent = playerOffense ? 'BEHIND' : 'SLIDE';
        control('KeyF').classList.toggle('hidden', !playerOffense);
        control('KeyQ').classList.toggle('hidden', playerOffense);
    }

    function updateTimer() {
        const seconds = Math.max(0, Math.ceil(matchTime));
        timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function startGame() {
        playerScore = 0;
        botScore = 0;
        matchTime = 120;
        playerOffense = true;
        celebration = 0;
        playerScoreEl.textContent = '0';
        botScoreEl.textContent = '0';
        updateTimer();
        roleStatusEl.textContent = 'YOU ATTACK · BOT DEFENDS';
        updateTouchRole();
        const selectedPlayer = roster[playerChoice.value];
        player.name = selectedPlayer.name;
        player.color = selectedPlayer.color;
        player.jerseyAccent = selectedPlayer.accent;
        player.jerseyNumber = selectedPlayer.number;
        player.jerseyPattern = selectedPlayer.pattern;
        player.mrT = Boolean(selectedPlayer.mrT);
        bot.jerseyAccent = '#93c5fd';
        bot.jerseyNumber = '9';
        bot.jerseyPattern = 'slashes';
        bot.mrT = false;
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
        if ((p === player) !== playerOffense) return;
        const origin = ballHandPosition(p);
        const direction = attackHoop().direction;
        p.ball.x = origin.x;
        p.ball.y = origin.y;
        p.ball.previousX = origin.x;
        p.ball.previousY = origin.y;
        p.ball.vx = direction * Math.cos(p.angle) * 19.5;
        p.ball.vy = -Math.sin(p.angle) * 19.5;
        p.ball.age = 0;
        p.ball.launched = true;
        p.shootPose = 0.45;
        if (p === bot) p.botShotTimer = 2.6 + Math.random() * 1.2;
    }

    function ballHandPosition(p) {
        const facing = facingDirection(p);
        const side = p.crossover > 0
            ? Math.sin(p.crossover * 17) * (p.moveType === 'behind' ? -28 : 20)
            : 0;
        return { x: p.x + (27 + side) * facing, y: p.y - 95 };
    }

    function attemptBlock() {
        if (playerOffense || player.blockCooldown > 0) return;
        player.blockTimer = 0.48;
        player.blockCooldown = 0.8;
        if (player.grounded) player.vy = -440;
        deflectShotIfReachable();
    }

    function deflectShotIfReachable() {
        const ball = bot.ball;
        if (ball.launched && Math.hypot(ball.x - player.x, ball.y - (player.y - 55)) < 76) {
            ball.vx = player.x < ball.x ? Math.abs(ball.vx) * 0.72 : -Math.abs(ball.vx) * 0.72;
            ball.vy = -Math.abs(ball.vy) * 0.35;
            ball.x += Math.sign(ball.vx) * 14;
            ball.age = Math.max(0, ball.age - 0.5);
            player.blockTimer = 0;
            scoreBanner.textContent = 'BLOCKED! GREAT DEFENSE!';
            scoreBanner.classList.remove('hidden');
            window.clearTimeout(bannerTimeout);
            bannerTimeout = window.setTimeout(() => scoreBanner.classList.add('hidden'), 1500);
        }
    }

    function attemptSteal() {
        if (playerOffense || player.stealCooldown > 0) return;
        player.stealCooldown = 1.2;
        if (!bot.ball.launched && Math.abs(player.x - bot.x) < 88) {
            bot.crossover = 0;
            bot.vx += player.x < bot.x ? 220 : -220;
            bot.stealStun = 1.1;
            bot.botShotTimer = 1.1;
            scoreBanner.textContent = 'STEAL! YOU KNOCKED THE BALL LOOSE!';
            scoreBanner.classList.remove('hidden');
            window.clearTimeout(bannerTimeout);
            bannerTimeout = window.setTimeout(() => scoreBanner.classList.add('hidden'), 1500);
        }
    }

    function attemptDunk() {
        if (!playerOffense || player.ball.launched) return;
        const hoop = attackHoop();
        const hand = ballHandPosition(player);
        const distance = (hoop.x - hand.x) * hoop.direction;
        if (distance < 100 || distance > 150) return;

        const frames = Math.max(distance / 3, 40);
        player.ball.x = hand.x;
        player.ball.y = hand.y;
        player.ball.previousX = hand.x;
        player.ball.previousY = hand.y;
        player.ball.vx = hoop.direction * distance / frames;
        player.ball.vy = (hoop.y - hand.y - 0.17 * frames * frames) / frames;
        player.ball.age = 0;
        player.ball.launched = true;
        player.shootPose = 0.6;
        player.vy = -820;
        player.vx += hoop.direction * 100;
        scoreBanner.textContent = 'TAKE FLIGHT!';
        scoreBanner.classList.remove('hidden');
        window.clearTimeout(bannerTimeout);
        bannerTimeout = window.setTimeout(() => scoreBanner.classList.add('hidden'), 1200);
    }

    function score(p) {
        if (p === player) {
            playerScore++;
            playerScoreEl.textContent = playerScore;
            scoreBanner.textContent = 'YAY MR. T! THE CROWD IS FEELING IT!';
            sayMrT();
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

    function sayMrT() {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const phrase = new SpeechSynthesisUtterance('Yay Mr. T');
        phrase.rate = 0.95;
        phrase.pitch = 1.08;
        window.speechSynthesis.speak(phrase);
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
        p.blockTimer = Math.max(0, p.blockTimer - seconds);
        p.blockCooldown = Math.max(0, p.blockCooldown - seconds);
        p.stealCooldown = Math.max(0, p.stealCooldown - seconds);
        p.stealStun = Math.max(0, p.stealStun - seconds);

        p.vy += 1500 * seconds;
        p.x += p.vx * seconds;
        p.y += p.vy * seconds;
        p.vx *= Math.pow(0.9, seconds);
        const targetLean = clamp(-p.vx / 6000, -0.065, 0.065);
        p.renderLean += (targetLean - p.renderLean) * (1 - Math.exp(-seconds * 15));
        const maxSpeed = p === player
            ? (playerOffense ? 270 : 360)
            : (playerOffense ? 330 : 220);
        p.vx = clamp(p.vx, -maxSpeed, maxSpeed);
        if (p.y >= floorY) {
            p.y = floorY;
            p.vy = 0;
            p.grounded = true;
        } else {
            p.grounded = false;
        }
        p.x = clamp(p.x, 90, 1190);
    }

    function updateBall(p, delta) {
        const b = p.ball;
        if (!b.launched) return;
        const seconds = delta / 1000;
        const frames = seconds * 60;
        b.previousX = b.x;
        b.previousY = b.y;
        b.x += b.vx * frames;
        b.y += b.vy * frames + 0.17 * frames * frames;
        b.vy += 0.34 * frames;
        b.age += seconds;
        if (p === bot && !playerOffense && player.blockTimer > 0) deflectShotIfReachable();

        const hoop = attackHoop();
        if (b.previousY < hoop.y && b.y >= hoop.y &&
            b.x > hoop.x - hoop.radius + 9 && b.x < hoop.x + hoop.radius - 9 &&
            b.vy > 0) {
            score(p);
            return;
        }

        const boardThickness = 14;
        const entersBackboard = b.y > 190 && b.y < 315 &&
            (hoop.direction > 0
                ? b.previousX <= hoop.boardX && b.x >= hoop.boardX
                : b.previousX >= hoop.boardX && b.x <= hoop.boardX);
        if (entersBackboard) {
            // Place the ball just in front of the board instead of letting it
            // cross behind the painted surface, where it can look invisible.
            b.x = hoop.boardX - hoop.direction * (boardThickness + 12);
            b.vx = -b.vx * 0.68;
            b.vy = Math.min(b.vy - 1.5, 9);
        }

        if (b.age > 3.8 || b.y > floorY + 80 || b.x > 1270 || b.x < 0) {
            b.launched = false;
            b.age = 0;
        }
    }

    function updateBotPosition() {
        const targetX = playerOffense
            ? clamp(player.x + 76, 110, 1170)
            : clamp(bot.x - 40, 500, 850);
        bot.vx = clamp((targetX - bot.x) * 2.5, -300, 300);
    }

    function resolveDefender() {
        const attacker = playerOffense ? player : bot;
        const defender = playerOffense ? bot : player;
        const horizontalDistance = attacker.x - defender.x;
        if (Math.abs(horizontalDistance) >= 44 || Math.abs(attacker.y - defender.y) >= 70) return;

        if (attacker.crossover > 0) {
            attacker.x = defender.x + (horizontalDistance < 0 ? 44 : -44);
            attacker.vx = horizontalDistance < 0 ? Math.max(attacker.vx, 220) : Math.min(attacker.vx, -220);
            return;
        }

        attacker.x = defender.x + (horizontalDistance < 0 ? -44 : 44);
        attacker.vx = 0;
    }

    function updateGame(delta) {
        const seconds = delta / 1000;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) player.vx -= 1250 * seconds;
        if (keys.has('KeyD') || keys.has('ArrowRight')) player.vx += 1250 * seconds;
        if (keys.has('ArrowUp')) player.angle = clamp(player.angle + seconds * 1.15, 0.3, 1.48);
        if (keys.has('ArrowDown')) player.angle = clamp(player.angle - seconds * 1.15, 0.3, 1.48);

        if (pressed.has('KeyW') && player.grounded) player.vy = -580;
        if (pressed.has('Space')) {
            if (playerOffense) launchShot(player);
            else attemptBlock();
        }
        if (pressed.has('KeyF')) attemptDunk();
        if (pressed.has('KeyQ')) attemptSteal();
        if (pressed.has('KeyE')) {
            if (playerOffense) {
                player.moveType = 'behind';
                player.crossover = 0.9;
                player.vx += attackHoop().direction * 170;
            } else {
                player.vx += (bot.x < player.x ? -1 : 1) * 320;
            }
        } else if (pressed.has('ShiftLeft') || pressed.has('ShiftRight')) {
            if (playerOffense) {
                player.moveType = 'crossover';
                player.crossover = 0.65;
                player.vx += attackHoop().direction * 170;
            } else {
                player.vx += (bot.x < player.x ? -1 : 1) * 240;
            }
        }
        pressed.clear();

        if (playerOffense && matchTime <= 60) {
            playerOffense = false;
            player.ball.launched = false;
            bot.ball.launched = false;
            bot.botShotTimer = 1.5;
            bot.stealStun = 0;
            roleStatusEl.textContent = 'YOU DEFEND · BOT ATTACKS';
            updateTouchRole();
            scoreBanner.textContent = 'HALFTIME! SWITCH SIDES — GUARD THE BOT!';
            scoreBanner.classList.remove('hidden');
            window.clearTimeout(bannerTimeout);
            bannerTimeout = window.setTimeout(() => scoreBanner.classList.add('hidden'), 3200);
        }

        updateBotPosition();
        if (!playerOffense) {
            if (bot.stealStun <= 0) bot.botShotTimer -= seconds;
            if (bot.botShotTimer <= 0 && !bot.ball.launched && bot.stealStun <= 0) {
                const targetAngle = shotAngle(ballHandPosition(bot), attackHoop());
                bot.angle = targetAngle ?? 0.94;
                launchShot(bot);
            }
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
        const floor = ctx.createLinearGradient(0, 480, 0, 720);
        floor.addColorStop(0, '#d99a50');
        floor.addColorStop(1, '#70421f');
        ctx.fillStyle = floor;
        ctx.fillRect(0, 480, 1280, 240);
        drawCourtLines();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(640, floorY, 85, 55, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawCourtLines() {
        ctx.save();
        ctx.strokeStyle = '#fff5dfcc';
        ctx.lineWidth = 3;

        // Full-court boundary, center line, and mirrored basket lanes.
        ctx.beginPath();
        ctx.moveTo(60, 495);
        ctx.lineTo(1205, 495);
        ctx.lineTo(1205, 705);
        ctx.lineTo(60, 705);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(640, 495);
        ctx.lineTo(640, 705);
        ctx.stroke();
        ctx.strokeRect(75, 495, 240, 210);
        ctx.strokeRect(965, 495, 240, 210);

        ctx.beginPath();
        ctx.ellipse(315, 600, 76, 55, 0, 0, Math.PI * 2);
        ctx.ellipse(965, 600, 76, 55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(hoops.left.x, 600, 250, 98, 0, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(hoops.right.x, 600, 250, 98, 0, Math.PI / 2, Math.PI * 1.5);
        ctx.stroke();

        ctx.fillStyle = '#fff5df';
        for (let i = 0; i < 5; i++) {
            const y = 535 + i * 26;
            ctx.fillRect(288, y, 10, 3);
            ctx.fillRect(982, y, 10, 3);
        }
        ctx.restore();
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

    function drawHoopAt(hoop) {
        const leftSide = hoop.direction < 0;
        const backboardX = leftSide ? hoop.boardX - 14 : hoop.boardX;
        const poleX = leftSide ? 132 : 1130;
        ctx.fillStyle = '#334155';
        ctx.fillRect(poleX, 260, 18, 335);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(backboardX, 190, 14, 125);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.strokeRect(backboardX + (leftSide ? 2 : 0), 229, 12, 47);
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

    function drawHoop() {
        drawHoopAt(hoops.left);
        drawHoopAt(hoops.right);
    }

    function drawAimGuide(p) {
        if (p !== player || p.ball.launched || !playerOffense) return;
        const origin = ballHandPosition(p);
        const hoop = attackHoop();
        const direction = hoop.direction;
        const speed = 19.5;
        let landing = null;
        ctx.save();
        ctx.fillStyle = '#fde68a';
        for (let frame = 4; frame < 130; frame += 4) {
            const t = frame / 60;
            const x = origin.x + direction * Math.cos(p.angle) * speed * frame;
            const y = origin.y - Math.sin(p.angle) * speed * frame + 0.5 * 0.34 * frame * frame;
            if (y > floorY || x > 1250 || x < 30) break;
            const radius = frame % 8 === 4 ? 4 : 3;
            ctx.globalAlpha = 0.9 - frame / 110;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            if (!landing && y >= hoop.y && x > hoop.x - hoop.radius && x < hoop.x + hoop.radius) {
                landing = { x, y };
            }
        }
        if (landing) {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#fde68a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(landing.x, landing.y, 9, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawPlayer(p, time) {
        const bob = p.grounded ? Math.abs(Math.sin(p.dribblePhase)) * (Math.abs(p.vx) > 40 ? 4 : 1) : 0;
        const feet = p.y - bob;
        const moving = Math.abs(p.vx) > 50;
        const facing = facingDirection(p);
        const legSwing = moving ? Math.sin(p.dribblePhase) * 17 : 0;
        const armRaise = p.blockTimer > 0 ? 58 : p.shootPose > 0 ? 34 : 0;
        const armSwing = moving ? Math.sin(p.dribblePhase + Math.PI) * 12 : 0;
        const crossDirection = p.moveType === 'behind' ? -1 : 1;
        const cross = p.crossover > 0
            ? Math.sin((0.9 - p.crossover) * 18) * 18 * crossDirection
            : 0;
        ctx.save();
        ctx.translate(p.x, feet);
        ctx.scale(facing, 1);
        if (moving) ctx.rotate(p.renderLean);

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

        drawJersey(p);

        ctx.strokeStyle = '#d9a17d';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-14, -62);
        ctx.lineTo(-27 + cross + armSwing, -43 - (p.blockTimer > 0 ? 25 : 0));
        ctx.moveTo(14, -62);
        ctx.lineTo(28 - armSwing, -57 - armRaise);
        ctx.stroke();
        ctx.fillStyle = '#f2c09a';
        ctx.beginPath();
        ctx.arc(0, -84, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.mrT ? '#8b5a32' : '#1f2937';
        ctx.beginPath();
        ctx.arc(0, -89, 15, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-15, -90, 30, p.mrT ? 8 : 5);
        if (p.mrT) {
            ctx.strokeStyle = '#8b5a32';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-9, -97);
            ctx.lineTo(-7, -103);
            ctx.lineTo(-3, -98);
            ctx.lineTo(1, -104);
            ctx.lineTo(5, -98);
            ctx.lineTo(9, -103);
            ctx.lineTo(11, -96);
            ctx.stroke();
        }
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(6, -84, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.font = '800 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(p.name, p.x, feet - 111);

        if (p.ball.launched) {
            drawBall(p.ball.x, p.ball.y, 12, time * 9);
        } else if ((p === player) === playerOffense && !(p === bot && p.stealStun > 0)) {
            const hand = ballHandPosition(p);
            const dribbling = p.shootPose <= 0 && (
                (p === player && (keys.has('KeyR') || moving || p.crossover > 0)) ||
                (p === bot && !playerOffense)
            );
            const ballY = dribbling
                ? p.y - 92 + (1 - Math.cos(p.dribblePhase)) * 40
                : hand.y;
            drawBall(hand.x, ballY - bob, 12, time * 5);
        }
    }

    function drawJersey(p) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-17, -69);
        ctx.lineTo(17, -69);
        ctx.lineTo(14, -27);
        ctx.lineTo(-14, -27);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-17, -69);
        ctx.lineTo(17, -69);
        ctx.lineTo(14, -27);
        ctx.lineTo(-14, -27);
        ctx.clip();
        ctx.strokeStyle = p.jerseyAccent;
        ctx.fillStyle = p.jerseyAccent;
        ctx.lineWidth = 4;
        if (p.jerseyPattern === 'stripes') {
            ctx.beginPath();
            ctx.moveTo(-20, -62); ctx.lineTo(20, -62);
            ctx.moveTo(-20, -54); ctx.lineTo(20, -54);
            ctx.stroke();
        } else if (p.jerseyPattern === 'crown') {
            ctx.beginPath();
            ctx.moveTo(-13, -61); ctx.lineTo(-9, -68); ctx.lineTo(-4, -61);
            ctx.lineTo(1, -68); ctx.lineTo(6, -61); ctx.lineTo(13, -68);
            ctx.lineTo(13, -59); ctx.closePath(); ctx.fill();
        } else if (p.jerseyPattern === 'chevrons') {
            ctx.beginPath();
            ctx.moveTo(-19, -58); ctx.lineTo(-9, -48); ctx.lineTo(1, -58);
            ctx.moveTo(-1, -58); ctx.lineTo(9, -48); ctx.lineTo(19, -58);
            ctx.stroke();
        } else if (p.jerseyPattern === 'slashes') {
            for (let x = -22; x < 24; x += 10) {
                ctx.beginPath(); ctx.moveTo(x, -67); ctx.lineTo(x + 18, -27); ctx.stroke();
            }
        } else if (p.jerseyPattern === 'blocks') {
            ctx.fillRect(-14, -64, 28, 7);
            ctx.fillStyle = p.color;
            ctx.fillRect(-4, -64, 8, 7);
            ctx.fillStyle = p.jerseyAccent;
            ctx.fillRect(-14, -34, 28, 7);
        } else {
            ctx.beginPath();
            ctx.moveTo(0, -68); ctx.lineTo(13, -52); ctx.lineTo(0, -36);
            ctx.lineTo(-13, -52); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = p.color;
            ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(0, -40); ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = '#fff';
        ctx.font = '900 14px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.jerseyNumber, 0, -43);
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

    function shotAngle(origin, target) {
        const direction = attackHoop().direction;
        const distanceX = (target.x - origin.x) * direction;
        if (distanceX < 1) return null;
        const distanceY = origin.y - target.y;
        const speed = 19.5;
        const gravity = 0.34;
        const arcFactor = gravity * distanceX * distanceX / (2 * speed * speed);
        const discriminant = distanceX * distanceX - 4 * arcFactor * (arcFactor + distanceY);
        if (discriminant < 0) return null;
        const tangent = (distanceX + Math.sqrt(discriminant)) / (2 * arcFactor);
        return clamp(Math.atan(tangent), 0.3, 1.48);
    }

    function setAimFromPointer(event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * canvas.width / rect.width;
        const y = (event.clientY - rect.top) * canvas.height / rect.height;
        const hand = ballHandPosition(player);
        const angle = shotAngle(hand, { x, y });
        if (angle !== null) player.angle = angle;
    }

    window.addEventListener('keydown', event => {
        const code = event.code;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) event.preventDefault();
        if (!keys.has(code)) pressed.add(code);
        keys.add(code);
    });
    window.addEventListener('keyup', event => keys.delete(event.code));
    window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });
    let aimPointerId = null;
    canvas.addEventListener('pointerdown', event => {
        if (!running || !playerOffense) return;
        aimPointerId = event.pointerId;
        canvas.setPointerCapture(event.pointerId);
        setAimFromPointer(event);
    });
    canvas.addEventListener('pointermove', event => {
        if (running && playerOffense &&
            (event.pointerType === 'mouse' || event.pointerId === aimPointerId)) {
            setAimFromPointer(event);
        }
    });
    const stopAiming = event => {
        if (event.pointerId === aimPointerId) aimPointerId = null;
    };
    canvas.addEventListener('pointerup', stopAiming);
    canvas.addEventListener('pointercancel', stopAiming);

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
