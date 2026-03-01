/**
 * 池塘锦鲤 — 基于多目标追踪 (MOT) 范式的公园池塘主题小游戏
 *
 * 玩法：
 *  1. 池塘里有 totalObjects 条锦鲤在游动
 *  2. 其中 targetCount 条闪烁金色（金色锦鲤 — 目标）
 *  3. 所有锦鲤自由游动 moveDuration 秒
 *  4. 停止后玩家点击选出金色锦鲤
 *
 * scenario 配置:
 *   totalObjects (10), targetCount (4), moveDuration (8000ms),
 *   flashDuration (2000ms), objectRadius (20), speed (2.0), lang
 */
const ParkMOTGame = {
    name: 'ParkMOTGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, reactive, onMounted, onUnmounted, nextTick } = Vue;

        // ── config ──────────────────────────────────────────────
        const defaultScenario = {
            totalObjects: 10,
            targetCount: 4,
            moveDuration: 8000,
            flashDuration: 2000,
            objectRadius: 20,
            speed: 2.0,
            lang: 'zh'
        };
        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ── i18n ────────────────────────────────────────────────
        const TEXTS = {
            header_subtitle: { zh: '多目标追踪', en: 'Multiple Object Tracking', nl: 'Meervoudig Object Volgen' },
            header_title: { zh: '池塘锦鲤', en: 'Pond Koi', nl: 'Vijver Koi' },
            intro_title: { zh: '🐟 池塘锦鲤', en: '🐟 Pond Koi', nl: '🐟 Vijver Koi' },
            intro_desc: {
                zh: '池塘里有 <strong class="text-amber-300">{total}</strong> 条锦鲤，其中 <strong class="text-yellow-400">{targets}</strong> 条是<strong class="text-yellow-400">金色锦鲤</strong>！<br/><br/>它们会先<strong class="text-yellow-300">闪烁金光</strong>暴露身份，随后所有锦鲤自由游动。<br/>游动停止后，<strong class="text-cyan-300">点击</strong>找出那些金色锦鲤！',
                en: 'The pond has <strong class="text-amber-300">{total}</strong> koi fish. <strong class="text-yellow-400">{targets}</strong> of them are <strong class="text-yellow-400">golden koi</strong>!<br/><br/>They will <strong class="text-yellow-300">flash gold</strong> briefly, then all koi swim around.<br/>After they stop, <strong class="text-cyan-300">click</strong> to identify the golden ones!',
                nl: 'De vijver heeft <strong class="text-amber-300">{total}</strong> koivissen. <strong class="text-yellow-400">{targets}</strong> daarvan zijn <strong class="text-yellow-400">gouden koi</strong>!<br/><br/>Ze <strong class="text-yellow-300">flitsen goud</strong> even, daarna zwemmen alle koi rond.<br/>Nadat ze stoppen, <strong class="text-cyan-300">klik</strong> om de gouden te vinden!'
            },
            start_button: { zh: '开始观察', en: 'Start Watching', nl: 'Begin met Observeren' },
            phase_flash: { zh: '✨ 记住金色锦鲤！', en: '✨ Remember the golden koi!', nl: '✨ Onthoud de gouden koi!' },
            phase_move: { zh: '👀 保持追踪！剩余 {sec} 秒', en: '👀 Keep tracking! {sec}s left', nl: '👀 Blijf volgen! Nog {sec}s' },
            phase_select: { zh: '🎯 点击选出 {remaining} 条金色锦鲤', en: '🎯 Click to select {remaining} golden koi', nl: '🎯 Klik om {remaining} gouden koi te selecteren' },
            phase_result: { zh: '观察完成', en: 'Observation Complete', nl: 'Observatie Voltooid' },
            correct_label: { zh: '正确', en: 'Correct', nl: 'Juist' },
            missed_label: { zh: '遗漏', en: 'Missed', nl: 'Gemist' },
            false_alarm_label: { zh: '误选', en: 'False Alarms', nl: 'Vals Alarm' },
            accuracy_label: { zh: '准确率', en: 'Accuracy', nl: 'Nauwkeurigheid' },
            perf_excellent: { zh: '🌟 火眼金睛，完美辨认！', en: '🌟 Perfect eye, flawless identification!', nl: '🌟 Perfect oog, foutloze identificatie!' },
            perf_good: { zh: '👍 观察力不错！', en: '👍 Good observation skills!', nl: '👍 Goede observatievaardigheden!' },
            perf_ok: { zh: '🔄 再仔细看看！', en: '🔄 Take another careful look!', nl: '🔄 Kijk nog eens goed!' },
            finish_button: { zh: '完成', en: 'Finish', nl: 'Voltooien' },
            selected_indicator: { zh: '已选 {n}/{total}', en: 'Selected {n}/{total}', nl: 'Geselecteerd {n}/{total}' }
        };
        const lang = computed(() => config.value.lang || 'zh');
        const t = (key, params = {}) => {
            let text = TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
            Object.entries(params).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, v); });
            return text;
        };

        // ── state ───────────────────────────────────────────────
        const phase = ref('intro');
        const objects = ref([]);
        const countdown = ref(0);
        const canvasRef = ref(null);
        const selectedCount = ref(0);
        const results = reactive({ hits: 0, misses: 0, falseAlarms: 0, accuracy: 0 });
        const startTime = ref(0);

        let animFrameId = null;
        let countdownTimer = null;
        let canvasW = 600;
        let canvasH = 500;

        // ── lily pads (static decoration) ───────────────────────
        let lilyPads = [];
        function initLilyPads() {
            lilyPads = [];
            const cx = canvasW / 2, cy = canvasH * 0.52;
            const rx = canvasW * 0.36, ry = canvasH * 0.30;
            const count = 5 + Math.floor(Math.random() * 4); // 5-8
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const rFrac = 0.55 + Math.random() * 0.4;
                lilyPads.push({
                    x: cx + Math.cos(angle) * rx * rFrac,
                    y: cy + Math.sin(angle) * ry * rFrac,
                    r: 8 + Math.random() * 10,
                    rotation: Math.random() * Math.PI * 2,
                    shade: Math.random() * 0.15
                });
            }
        }

        // ── ripple effects ──────────────────────────────────────
        let ripples = [];
        function initRipples() {
            ripples = [];
            for (let i = 0; i < 6; i++) {
                ripples.push(newRipple());
            }
        }
        function newRipple() {
            const cx = canvasW / 2, cy = canvasH * 0.52;
            const rx = canvasW * 0.32, ry = canvasH * 0.26;
            const angle = Math.random() * Math.PI * 2;
            const rFrac = Math.sqrt(Math.random()) * 0.8;
            return {
                x: cx + Math.cos(angle) * rx * rFrac,
                y: cy + Math.sin(angle) * ry * rFrac,
                radius: 0,
                maxRadius: 15 + Math.random() * 25,
                alpha: 0.3 + Math.random() * 0.2,
                speed: 0.3 + Math.random() * 0.4
            };
        }
        function updateRipples() {
            for (let i = 0; i < ripples.length; i++) {
                const r = ripples[i];
                r.radius += r.speed;
                r.alpha -= 0.003;
                if (r.radius >= r.maxRadius || r.alpha <= 0) {
                    ripples[i] = newRipple();
                }
            }
        }

        // ── init fish ───────────────────────────────────────────
        function initObjects() {
            const R = config.value.objectRadius;
            const total = config.value.totalObjects;
            const targets = config.value.targetCount;
            const cx = canvasW / 2, cy = canvasH * 0.52;
            const rx = canvasW * 0.36, ry = canvasH * 0.30;
            const arr = [];

            const targetIndices = new Set();
            while (targetIndices.size < targets) targetIndices.add(Math.floor(Math.random() * total));

            for (let i = 0; i < total; i++) {
                let x, y, overlapping, attempts = 0;
                do {
                    overlapping = false;
                    const angle = Math.random() * Math.PI * 2;
                    const rFrac = Math.sqrt(Math.random()) * 0.80;
                    x = cx + Math.cos(angle) * rx * rFrac;
                    y = cy + Math.sin(angle) * ry * rFrac;
                    for (const obj of arr) {
                        const dx = obj.x - x, dy = obj.y - y;
                        if (Math.sqrt(dx * dx + dy * dy) < R * 2.5) { overlapping = true; break; }
                    }
                    attempts++;
                } while (overlapping && attempts < 300);

                const a = Math.random() * Math.PI * 2;
                const speed = config.value.speed;
                arr.push({
                    id: i, x, y,
                    vx: Math.cos(a) * speed,
                    vy: Math.sin(a) * speed,
                    isTarget: targetIndices.has(i),
                    selected: false,
                    revealed: false,
                    tailPhase: Math.random() * Math.PI * 2 // for tail wag animation
                });
            }
            objects.value = arr;
        }

        // ── physics ─────────────────────────────────────────────
        function updatePhysics() {
            const R = config.value.objectRadius;
            const objs = objects.value;
            const cx = canvasW / 2, cy = canvasH * 0.52;
            const rx = canvasW * 0.36 - R, ry = canvasH * 0.30 - R;

            for (const obj of objs) {
                // slight random direction changes to simulate swimming
                obj.vx += (Math.random() - 0.5) * 0.2;
                obj.vy += (Math.random() - 0.5) * 0.2;
                // speed cap
                const spd = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
                const maxSpd = config.value.speed * 1.5;
                const minSpd = config.value.speed * 0.5;
                if (spd > maxSpd) { obj.vx *= maxSpd / spd; obj.vy *= maxSpd / spd; }
                else if (spd < minSpd && spd > 0) { obj.vx *= minSpd / spd; obj.vy *= minSpd / spd; }

                obj.x += obj.vx;
                obj.y += obj.vy;

                // tail wag
                obj.tailPhase += 0.15;

                // elliptical pond boundary
                const dx = (obj.x - cx) / rx, dy = (obj.y - cy) / ry;
                const dist = dx * dx + dy * dy;
                if (dist > 1) {
                    const norm = Math.sqrt(dist);
                    const nx = dx / (rx * norm), ny = dy / (ry * norm);
                    const dot = obj.vx * nx + obj.vy * ny;
                    obj.vx -= 2 * dot * nx;
                    obj.vy -= 2 * dot * ny;
                    // smooth turning: add slight curve instead of instant flip
                    obj.vx += (Math.random() - 0.5) * 0.5;
                    obj.vy += (Math.random() - 0.5) * 0.5;
                    obj.x = cx + (dx / norm) * rx * 0.97;
                    obj.y = cy + (dy / norm) * ry * 0.97;
                }
            }

            // fish-to-fish collision avoidance
            for (let i = 0; i < objs.length; i++) {
                for (let j = i + 1; j < objs.length; j++) {
                    const a = objs[i], b = objs[j];
                    const ddx = b.x - a.x, ddy = b.y - a.y;
                    const d = Math.sqrt(ddx * ddx + ddy * ddy);
                    const minD = R * 2;
                    if (d < minD && d > 0) {
                        const nx = ddx / d, ny = ddy / d;
                        const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                        if (dvn > 0) {
                            a.vx -= dvn * nx; a.vy -= dvn * ny;
                            b.vx += dvn * nx; b.vy += dvn * ny;
                        }
                        const overlap = (minD - d) / 2;
                        a.x -= overlap * nx; a.y -= overlap * ny;
                        b.x += overlap * nx; b.y += overlap * ny;
                    }
                }
            }
        }

        // ── render helpers ──────────────────────────────────────
        function drawPondBackground(ctx) {
            const cx = canvasW / 2, cy = canvasH * 0.52;

            // park green background
            ctx.fillStyle = '#4a7c59';
            ctx.fillRect(0, 0, canvasW, canvasH);

            // grass texture: subtle darker patches
            for (let i = 0; i < 30; i++) {
                const gx = Math.random() * canvasW;
                const gy = Math.random() * canvasH;
                ctx.beginPath();
                ctx.arc(gx, gy, 15 + Math.random() * 25, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(55, 100, 65, ${0.15 + Math.random() * 0.15})`;
                ctx.fill();
            }

            // stone border (outer ring of pond)
            const stoneRx = canvasW * 0.40, stoneRy = canvasH * 0.34;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy, stoneRx, stoneRy, 0, 0, Math.PI * 2);
            const stoneGrad = ctx.createRadialGradient(cx, cy - stoneRy * 0.2, stoneRx * 0.6, cx, cy, stoneRx);
            stoneGrad.addColorStop(0, '#8a8a7a');
            stoneGrad.addColorStop(0.5, '#7a7a6a');
            stoneGrad.addColorStop(1, '#5a5a4a');
            ctx.fillStyle = stoneGrad;
            ctx.fill();
            ctx.restore();

            // individual stone details on border
            const numStones = 24;
            for (let i = 0; i < numStones; i++) {
                const angle = (i / numStones) * Math.PI * 2;
                const sx = cx + Math.cos(angle) * stoneRx * 0.97;
                const sy = cy + Math.sin(angle) * stoneRy * 0.97;
                ctx.beginPath();
                ctx.arc(sx, sy, 6 + Math.random() * 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${100 + Math.random() * 40}, ${100 + Math.random() * 30}, ${80 + Math.random() * 30}, 0.5)`;
                ctx.fill();
            }

            // pond water
            const waterRx = canvasW * 0.37, waterRy = canvasH * 0.31;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy, waterRx, waterRy, 0, 0, Math.PI * 2);
            const waterGrad = ctx.createRadialGradient(cx, cy - waterRy * 0.3, waterRx * 0.1, cx, cy, waterRx);
            waterGrad.addColorStop(0, 'rgba(100, 180, 200, 0.85)');
            waterGrad.addColorStop(0.4, 'rgba(60, 140, 170, 0.75)');
            waterGrad.addColorStop(0.8, 'rgba(40, 110, 140, 0.70)');
            waterGrad.addColorStop(1, 'rgba(30, 80, 110, 0.65)');
            ctx.fillStyle = waterGrad;
            ctx.fill();
            ctx.restore();

            // water surface shimmer
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy, waterRx, waterRy, 0, 0, Math.PI * 2);
            ctx.clip();
            ctx.beginPath();
            ctx.ellipse(cx - waterRx * 0.15, cy - waterRy * 0.25, waterRx * 0.5, waterRy * 0.35, -0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(150, 210, 230, 0.15)';
            ctx.fill();
            ctx.restore();
        }

        function drawLilyPads(ctx) {
            for (const pad of lilyPads) {
                ctx.save();
                ctx.translate(pad.x, pad.y);
                ctx.rotate(pad.rotation);

                // lily pad circle with notch
                ctx.beginPath();
                ctx.arc(0, 0, pad.r, 0.15, Math.PI * 2 - 0.15);
                ctx.lineTo(0, 0);
                ctx.closePath();
                const padGrad = ctx.createRadialGradient(-pad.r * 0.2, -pad.r * 0.2, 0, 0, 0, pad.r);
                padGrad.addColorStop(0, `rgba(80, 160, 60, ${0.75 - pad.shade})`);
                padGrad.addColorStop(1, `rgba(40, 120, 35, ${0.65 - pad.shade})`);
                ctx.fillStyle = padGrad;
                ctx.fill();

                // veins
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -pad.r * 0.8);
                ctx.moveTo(0, 0);
                ctx.lineTo(pad.r * 0.6, pad.r * 0.5);
                ctx.moveTo(0, 0);
                ctx.lineTo(-pad.r * 0.6, pad.r * 0.5);
                ctx.strokeStyle = 'rgba(30, 90, 25, 0.3)';
                ctx.lineWidth = 0.8;
                ctx.stroke();

                ctx.restore();
            }
        }

        function drawRipples(ctx) {
            for (const r of ripples) {
                if (r.alpha <= 0) continue;
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(180, 220, 240, ${r.alpha * 0.5})`;
                ctx.lineWidth = 1;
                ctx.stroke();
                // inner ring
                if (r.radius > 5) {
                    ctx.beginPath();
                    ctx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(180, 220, 240, ${r.alpha * 0.25})`;
                    ctx.stroke();
                }
            }
        }

        function drawFish(ctx, obj, R) {
            const angle = Math.atan2(obj.vy, obj.vx);
            const bodyLen = R * 1.8;
            const bodyW = R * 0.9;

            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(angle);

            // determine fish color
            let bodyColor1, bodyColor2, bodyColor3;
            const isFlashing = phase.value === 'flash' && obj.isTarget;
            const isRevealed = phase.value === 'result' && obj.revealed;

            if (isFlashing) {
                bodyColor1 = '#ffe066';
                bodyColor2 = '#ffb800';
                bodyColor3 = '#cc8800';
            } else if (isRevealed) {
                if (obj.selected && obj.isTarget) {
                    bodyColor1 = '#88ffaa'; bodyColor2 = '#33cc55'; bodyColor3 = '#228833';
                } else if (obj.selected && !obj.isTarget) {
                    bodyColor1 = '#ff8888'; bodyColor2 = '#cc3333'; bodyColor3 = '#882222';
                } else if (!obj.selected && obj.isTarget) {
                    bodyColor1 = '#ffe066'; bodyColor2 = '#ddaa33'; bodyColor3 = '#996600';
                } else {
                    bodyColor1 = '#ee8855'; bodyColor2 = '#cc6633'; bodyColor3 = '#884422';
                }
            } else {
                // normal koi: orange-white
                bodyColor1 = '#ff9966';
                bodyColor2 = '#ee7744';
                bodyColor3 = '#cc5533';
            }

            // glow for flash phase targets
            if (isFlashing) {
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 25;
            }

            // tail (triangle at back, with wag)
            const tailWag = Math.sin(obj.tailPhase) * 0.4;
            ctx.save();
            ctx.rotate(tailWag);
            ctx.beginPath();
            ctx.moveTo(-bodyLen * 0.6, 0);
            ctx.lineTo(-bodyLen * 1.3, -bodyW * 0.8);
            ctx.lineTo(-bodyLen * 1.3, bodyW * 0.8);
            ctx.closePath();
            ctx.fillStyle = bodyColor2;
            ctx.fill();
            ctx.restore();

            // body (elongated ellipse)
            ctx.beginPath();
            ctx.ellipse(0, 0, bodyLen, bodyW, 0, 0, Math.PI * 2);
            const bodyGrad = ctx.createLinearGradient(-bodyLen, -bodyW, bodyLen, bodyW);
            bodyGrad.addColorStop(0, bodyColor1);
            bodyGrad.addColorStop(0.5, bodyColor2);
            bodyGrad.addColorStop(1, bodyColor3);
            ctx.fillStyle = bodyGrad;
            ctx.fill();

            ctx.shadowBlur = 0;

            // white belly patch
            ctx.beginPath();
            ctx.ellipse(bodyLen * 0.1, bodyW * 0.15, bodyLen * 0.5, bodyW * 0.35, 0, 0, Math.PI * 2);
            ctx.fillStyle = isFlashing ? 'rgba(255, 255, 200, 0.35)' : 'rgba(255, 255, 255, 0.25)';
            ctx.fill();

            // eye
            ctx.beginPath();
            ctx.arc(bodyLen * 0.55, -bodyW * 0.2, R * 0.18, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bodyLen * 0.57, -bodyW * 0.23, R * 0.07, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            // dorsal fin (small arc on top)
            ctx.beginPath();
            ctx.ellipse(0, -bodyW * 0.7, bodyLen * 0.3, bodyW * 0.35, 0, Math.PI, Math.PI * 2);
            ctx.fillStyle = bodyColor3;
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            ctx.restore();

            // selection ring
            if (obj.selected) {
                ctx.save();
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, R * 1.5, 0, Math.PI * 2);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            // result: reveal missed targets with dashed ring
            if (phase.value === 'result' && obj.isTarget && !obj.selected) {
                ctx.save();
                ctx.shadowColor = '#ffaa00';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, R * 1.5, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            // result marks
            if (phase.value === 'result' && obj.revealed) {
                ctx.save();
                ctx.font = `bold ${R * 0.9}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                if (obj.selected && obj.isTarget) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#22aa44';
                    ctx.shadowBlur = 6;
                    ctx.fillText('✓', obj.x, obj.y);
                } else if (obj.selected && !obj.isTarget) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#cc2222';
                    ctx.shadowBlur = 6;
                    ctx.fillText('✗', obj.x, obj.y);
                } else if (!obj.selected && obj.isTarget) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#cc8800';
                    ctx.shadowBlur = 6;
                    ctx.fillText('!', obj.x, obj.y);
                }
                ctx.restore();
            }
        }

        // ── main render ─────────────────────────────────────────
        function render() {
            const canvas = canvasRef.value;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const R = config.value.objectRadius;

            ctx.clearRect(0, 0, canvasW, canvasH);

            drawPondBackground(ctx);
            drawRipples(ctx);
            drawLilyPads(ctx);

            // draw fish
            for (const obj of objects.value) {
                drawFish(ctx, obj, R);
            }
        }

        // ── animation ───────────────────────────────────────────
        function animationLoop() {
            if (phase.value === 'move') updatePhysics();
            updateRipples();
            render();
            animFrameId = requestAnimationFrame(animationLoop);
        }
        function stopAnimation() {
            if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        }

        // ── game flow ───────────────────────────────────────────
        function startGame() {
            startTime.value = Date.now();
            selectedCount.value = 0;
            phase.value = 'flash'; // Show canvas first so container has dimensions

            nextTick(() => {
                const canvas = canvasRef.value;
                if (canvas) {
                    const container = canvas.parentElement;
                    canvasW = container.clientWidth;
                    canvasH = container.clientHeight;
                    canvas.width = canvasW;
                    canvas.height = canvasH;
                }
                initLilyPads();
                initRipples();
                initObjects();
                animationLoop();

                setTimeout(() => {
                    phase.value = 'move';
                    const totalMs = config.value.moveDuration;
                    countdown.value = Math.ceil(totalMs / 1000);
                    countdownTimer = setInterval(() => {
                        countdown.value--;
                        if (countdown.value <= 0) {
                            clearInterval(countdownTimer);
                            countdownTimer = null;
                            phase.value = 'select';
                        }
                    }, 1000);
                }, config.value.flashDuration);
            });
        }

        // ── click handling ──────────────────────────────────────
        function handleCanvasClick(event) {
            if (phase.value !== 'select') return;
            const canvas = canvasRef.value;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvasW / rect.width;
            const scaleY = canvasH / rect.height;
            const mx = (event.clientX - rect.left) * scaleX;
            const my = (event.clientY - rect.top) * scaleY;
            const R = config.value.objectRadius;

            let closest = null, closestDist = Infinity;
            for (const obj of objects.value) {
                const dx = obj.x - mx, dy = obj.y - my;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < R * 1.8 && dist < closestDist) { closest = obj; closestDist = dist; }
            }

            if (closest) {
                if (closest.selected) {
                    closest.selected = false;
                    selectedCount.value--;
                } else if (selectedCount.value < config.value.targetCount) {
                    closest.selected = true;
                    selectedCount.value++;
                }
                render();
                if (selectedCount.value === config.value.targetCount) {
                    setTimeout(evaluateResults, 500);
                }
            }
        }

        // ── results ─────────────────────────────────────────────
        function evaluateResults() {
            stopAnimation();
            let hits = 0, misses = 0, falseAlarms = 0;
            for (const obj of objects.value) {
                obj.revealed = true;
                if (obj.isTarget && obj.selected) hits++;
                else if (obj.isTarget && !obj.selected) misses++;
                else if (!obj.isTarget && obj.selected) falseAlarms++;
            }
            results.hits = hits;
            results.misses = misses;
            results.falseAlarms = falseAlarms;
            results.accuracy = Math.round((hits / config.value.targetCount) * 100);
            phase.value = 'result';
            animationLoop();
        }

        function finishGame() {
            stopAnimation();
            emit('complete', {
                game: 'ParkMOTGame',
                totalObjects: config.value.totalObjects,
                targetCount: config.value.targetCount,
                moveDuration: config.value.moveDuration,
                hits: results.hits,
                misses: results.misses,
                falseAlarms: results.falseAlarms,
                accuracy: results.accuracy,
                duration: Date.now() - startTime.value
            });
        }

        // ── lifecycle ───────────────────────────────────────────
        onUnmounted(() => {
            stopAnimation();
            if (countdownTimer) clearInterval(countdownTimer);
        });

        const remaining = computed(() => config.value.targetCount - selectedCount.value);
        const perfMessage = computed(() => {
            if (results.accuracy >= 90) return t('perf_excellent');
            if (results.accuracy >= 60) return t('perf_good');
            return t('perf_ok');
        });

        return {
            phase, objects, countdown, canvasRef, selectedCount, results, remaining,
            perfMessage, config, t, startGame, handleCanvasClick, finishGame
        };
    },

    template: `
    <div class="h-full flex flex-col overflow-hidden" style="background: linear-gradient(135deg, #2d5a27 0%, #3a6b34 40%, #1a3d15 100%);">

            <!-- status bar -->
            <div class="shrink-0 px-4 pt-3 pb-1">
                <div v-if="phase !== 'intro'" class="flex items-center justify-between bg-green-950/70 backdrop-blur rounded-xl px-4 py-2 border border-emerald-800/30">
                    <div class="flex items-center gap-2">
                        <span class="text-emerald-400 text-xs font-bold tracking-wider uppercase">{{ t('header_subtitle') }}</span>
                        <span class="text-green-700 mx-1">|</span>
                        <span class="text-white text-sm font-bold">{{ t('header_title') }}</span>
                    </div>
                    <div v-if="phase === 'select'" class="text-amber-300 text-sm font-mono">
                        {{ t('selected_indicator', { n: selectedCount, total: config.targetCount }) }}
                    </div>
                </div>
                <div v-if="phase !== 'intro'" class="mt-2 text-center">
                    <div v-if="phase === 'flash'" class="text-yellow-300 text-sm font-bold animate-pulse">
                        {{ t('phase_flash') }}
                    </div>
                    <div v-else-if="phase === 'move'" class="text-emerald-300 text-sm font-bold">
                        {{ t('phase_move', { sec: countdown }) }}
                    </div>
                    <div v-else-if="phase === 'select'" class="text-cyan-300 text-sm font-bold">
                        {{ t('phase_select', { remaining: remaining }) }}
                    </div>
                </div>
            </div>

            <!-- intro -->
            <div v-if="phase === 'intro'" class="flex-grow flex items-center justify-center p-6">
                <div class="text-center px-6 py-8 bg-green-950/60 backdrop-blur-lg rounded-2xl border border-emerald-800/30 max-w-lg">
                    <div class="text-5xl mb-4">🐟</div>
                    <h2 class="text-2xl font-black text-white mb-4">{{ t('intro_title') }}</h2>
                    <p class="text-green-200 text-sm leading-relaxed mb-8" v-html="t('intro_desc', { total: config.totalObjects, targets: config.targetCount })"></p>
                    <button @click="startGame"
                        class="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/40 transition-all transform hover:scale-105 active:scale-95">
                        {{ t('start_button') }}
                    </button>
                </div>
            </div>

            <!-- canvas container -->
            <div v-show="phase !== 'intro'" class="flex-grow relative mx-4 mb-2 rounded-xl overflow-hidden border border-emerald-900/40 shadow-2xl shadow-black/50">
                <canvas ref="canvasRef" @click="handleCanvasClick"
                    class="w-full h-full cursor-crosshair"
                    style="background: #4a7c59;">
                </canvas>

                <!-- result overlay (inside canvas container) -->
                <div v-if="phase === 'result'" class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div class="bg-white/95 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <div class="text-center mb-3">
                            <h3 class="text-gray-800 font-bold text-lg">{{ t('phase_result') }}</h3>
                            <p class="text-lg mt-1">{{ perfMessage }}</p>
                        </div>
                        <div class="grid grid-cols-4 gap-3 mb-4">
                            <div class="text-center">
                                <div class="text-2xl font-black text-green-600">{{ results.hits }}</div>
                                <div class="text-xs text-gray-500">{{ t('correct_label') }}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-black text-yellow-500">{{ results.misses }}</div>
                                <div class="text-xs text-gray-500">{{ t('missed_label') }}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-black text-red-500">{{ results.falseAlarms }}</div>
                                <div class="text-xs text-gray-500">{{ t('false_alarm_label') }}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-black text-teal-600">{{ results.accuracy }}%</div>
                                <div class="text-xs text-gray-500">{{ t('accuracy_label') }}</div>
                            </div>
                        </div>
                        <div class="flex justify-center">
                            <button @click="finishGame"
                                class="px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95">
                                {{ t('finish_button') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
    </div>
    `
};

window.ParkMOTGame = ParkMOTGame;
