/**
 * 滚水煮饺子 / 捞汤圆 — 基于多目标追踪 (MOT) 范式的高认知负荷小游戏
 *
 * 玩法：
 *  1. 屏幕中央有一口沸腾的大锅，锅里倒进 totalObjects 个白饺子
 *  2. 其中 targetCount 个闪烁绿光（素馅 — 你需要的）
 *  3. 所有饺子在沸水中剧烈翻滚 moveDuration 秒
 *  4. 水面平静后，玩家点击选出素馅饺子
 *
 * scenario 配置:
 *   totalObjects (10), targetCount (3), moveDuration (6000ms),
 *   flashDuration (2500ms), objectRadius (24), speed (2.2), lang
 */
const DumplingMOTGame = {
    name: 'DumplingMOTGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, reactive, onMounted, onUnmounted, nextTick } = Vue;

        // ── config ──────────────────────────────────────────────
        const defaultScenario = {
            totalObjects: 10,
            targetCount: 3,
            moveDuration: 6000,
            flashDuration: 2500,
            objectRadius: 24,
            speed: 2.2,
            lang: 'zh'
        };
        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ── i18n ────────────────────────────────────────────────
        const TEXTS = {
            header_subtitle: { zh: '多目标追踪', en: 'Multiple Object Tracking', nl: 'Meervoudig Object Volgen' },
            header_title: { zh: '滚水煮饺子', en: 'Boiling Dumplings', nl: 'Kokende Knoedels' },
            intro_title: { zh: '🥟 滚水煮饺子', en: '🥟 Boiling Dumplings', nl: '🥟 Kokende Knoedels' },
            intro_desc: {
                zh: '锅里有 <strong class="text-emerald-300">{total}</strong> 个白饺子，其中 <strong class="text-green-400">{targets}</strong> 个是<strong class="text-green-400">素馅</strong>的！<br/><br/>它们会先<strong class="text-green-300">闪烁绿光</strong>暴露身份，随后饺子在沸水中剧烈翻滚。<br/>水面平静后，<strong class="text-amber-300">点击</strong>捞出那几个素馅饺子！',
                en: 'There are <strong class="text-emerald-300">{total}</strong> dumplings in the pot. <strong class="text-green-400">{targets}</strong> of them have <strong class="text-green-400">vegetable filling</strong>!<br/><br/>They\'ll <strong class="text-green-300">flash green</strong> briefly, then all dumplings tumble in the boiling water.<br/>When the water calms down, <strong class="text-amber-300">click</strong> to fish out the veggie ones!',
                nl: 'Er zitten <strong class="text-emerald-300">{total}</strong> knoedels in de pot. <strong class="text-green-400">{targets}</strong> daarvan hebben <strong class="text-green-400">groentevulling</strong>!<br/><br/>Ze <strong class="text-green-300">knipperen groen</strong> even, daarna tuimelen alle knoedels in het kokende water.<br/>Als het water kalmeert, <strong class="text-amber-300">klik</strong> om de groenteknoedels eruit te vissen!'
            },
            start_button: { zh: '开始煮饺子', en: 'Start Boiling', nl: 'Begin met Koken' },
            phase_flash: { zh: '💚 记住哪些是素馅的！', en: '💚 Remember the veggie ones!', nl: '💚 Onthoud de groenteknoedels!' },
            phase_move: { zh: '🔥 沸腾中！剩余 {sec} 秒', en: '🔥 Boiling! {sec}s left', nl: '🔥 Aan het koken! Nog {sec}s' },
            phase_select: { zh: '🥢 捞出 {remaining} 个素馅饺子', en: '🥢 Fish out {remaining} veggie dumpling(s)', nl: '🥢 Vis {remaining} groenteknoedel(s) eruit' },
            phase_result: { zh: '捞饺子完成', en: 'Fishing Complete', nl: 'Vissen Voltooid' },
            correct_label: { zh: '捞对', en: 'Correct', nl: 'Juist' },
            missed_label: { zh: '漏掉', en: 'Missed', nl: 'Gemist' },
            false_alarm_label: { zh: '捞错', en: 'Wrong', nl: 'Fout' },
            accuracy_label: { zh: '准确率', en: 'Accuracy', nl: 'Nauwkeurigheid' },
            perf_excellent: { zh: '🌟 火眼金睛，完美捞出！', en: '🌟 Eagle eyes, perfect catch!', nl: '🌟 Adelaarsogen, perfecte vangst!' },
            perf_good: { zh: '👍 不错，差一点点！', en: '👍 Nice, almost perfect!', nl: '👍 Goed, bijna perfect!' },
            perf_ok: { zh: '🔄 再来一锅试试！', en: '🔄 Try another pot!', nl: '🔄 Probeer nog een pot!' },
            finish_button: { zh: '完成', en: 'Finish', nl: 'Voltooien' },
            selected_indicator: { zh: '已捞 {n}/{total}', en: 'Fished {n}/{total}', nl: 'Gevist {n}/{total}' }
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
        let canvasH = 560;

        // ── bubbles ─────────────────────────────────────────────
        let bubbles = [];
        function initBubbles() {
            bubbles = [];
            for (let i = 0; i < 40; i++) {
                bubbles.push({
                    x: Math.random() * canvasW,
                    y: canvasH * 0.3 + Math.random() * canvasH * 0.7,
                    r: Math.random() * 6 + 2,
                    speed: Math.random() * 1.2 + 0.3,
                    alpha: Math.random() * 0.35 + 0.1,
                    wobble: Math.random() * Math.PI * 2
                });
            }
        }
        function updateBubbles() {
            const boiling = phase.value === 'move' || phase.value === 'flash';
            for (const b of bubbles) {
                b.y -= b.speed * (boiling ? 1.8 : 0.5);
                b.wobble += 0.04;
                b.x += Math.sin(b.wobble) * 0.5;
                if (b.y < canvasH * 0.15) {
                    b.y = canvasH - b.r;
                    b.x = Math.random() * canvasW;
                }
            }
        }

        // ── steam particles ─────────────────────────────────────
        let steams = [];
        function initSteam() {
            steams = [];
            for (let i = 0; i < 12; i++) {
                steams.push(newSteamParticle());
            }
        }
        function newSteamParticle() {
            return {
                x: canvasW * 0.25 + Math.random() * canvasW * 0.5,
                y: canvasH * 0.18 + Math.random() * 10,
                r: Math.random() * 14 + 6,
                alpha: Math.random() * 0.2 + 0.05,
                vx: (Math.random() - 0.5) * 0.6,
                vy: -(Math.random() * 0.8 + 0.3),
                life: 1
            };
        }
        function updateSteam() {
            const boiling = phase.value === 'move' || phase.value === 'flash';
            for (let i = 0; i < steams.length; i++) {
                const s = steams[i];
                s.x += s.vx;
                s.y += s.vy * (boiling ? 1.6 : 0.7);
                s.life -= 0.008;
                s.r += 0.15;
                if (s.life <= 0) steams[i] = newSteamParticle();
            }
        }

        // ── init dumplings ──────────────────────────────────────
        function initObjects() {
            const R = config.value.objectRadius;
            const total = config.value.totalObjects;
            const targets = config.value.targetCount;
            // keep dumplings within the pot area (elliptical)
            const cx = canvasW / 2, cy = canvasH * 0.55;
            const rx = canvasW * 0.36, ry = canvasH * 0.28;
            const arr = [];

            const targetIndices = new Set();
            while (targetIndices.size < targets) targetIndices.add(Math.floor(Math.random() * total));

            for (let i = 0; i < total; i++) {
                let x, y, overlapping, attempts = 0;
                do {
                    overlapping = false;
                    const angle = Math.random() * Math.PI * 2;
                    const rFrac = Math.sqrt(Math.random()) * 0.85;
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
                    revealed: false
                });
            }
            objects.value = arr;
        }

        // ── physics ─────────────────────────────────────────────
        function updatePhysics() {
            const R = config.value.objectRadius;
            const objs = objects.value;
            const cx = canvasW / 2, cy = canvasH * 0.55;
            const rx = canvasW * 0.36 - R, ry = canvasH * 0.28 - R;

            for (const obj of objs) {
                // slight turbulence to feel like boiling
                obj.vx += (Math.random() - 0.5) * 0.35;
                obj.vy += (Math.random() - 0.5) * 0.35;
                // speed cap
                const spd = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
                const maxSpd = config.value.speed * 1.6;
                if (spd > maxSpd) { obj.vx *= maxSpd / spd; obj.vy *= maxSpd / spd; }

                obj.x += obj.vx;
                obj.y += obj.vy;

                // elliptical boundary (pot)
                const dx = (obj.x - cx) / rx, dy = (obj.y - cy) / ry;
                const dist = dx * dx + dy * dy;
                if (dist > 1) {
                    const norm = Math.sqrt(dist);
                    const nx = dx / (rx * norm), ny = dy / (ry * norm);
                    // reflect velocity
                    const dot = obj.vx * nx + obj.vy * ny;
                    obj.vx -= 2 * dot * nx;
                    obj.vy -= 2 * dot * ny;
                    // push inside
                    obj.x = cx + (dx / norm) * rx * 0.98;
                    obj.y = cy + (dy / norm) * ry * 0.98;
                }
            }

            // dumpling-to-dumpling collisions
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

        // ── render ──────────────────────────────────────────────
        function render() {
            const canvas = canvasRef.value;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const R = config.value.objectRadius;

            ctx.clearRect(0, 0, canvasW, canvasH);

            // -- background: kitchen / table
            ctx.fillStyle = '#3b2a1a';
            ctx.fillRect(0, 0, canvasW, canvasH);

            // -- pot body (dark ellipse)
            const cx = canvasW / 2, cy = canvasH * 0.55;
            const potRx = canvasW * 0.42, potRy = canvasH * 0.36;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy, potRx, potRy, 0, 0, Math.PI * 2);
            const potGrad = ctx.createRadialGradient(cx, cy - potRy * 0.3, potRx * 0.1, cx, cy, potRx);
            potGrad.addColorStop(0, '#4a4a4a');
            potGrad.addColorStop(0.5, '#2d2d2d');
            potGrad.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = potGrad;
            ctx.fill();
            ctx.restore();

            // -- pot rim
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy - potRy + 8, potRx + 6, 14, 0, 0, Math.PI * 2);
            const rimGrad = ctx.createLinearGradient(cx - potRx, 0, cx + potRx, 0);
            rimGrad.addColorStop(0, '#777');
            rimGrad.addColorStop(0.3, '#bbb');
            rimGrad.addColorStop(0.5, '#ddd');
            rimGrad.addColorStop(0.7, '#bbb');
            rimGrad.addColorStop(1, '#777');
            ctx.fillStyle = rimGrad;
            ctx.fill();
            ctx.restore();

            // -- water surface
            const waterRx = canvasW * 0.38, waterRy = canvasH * 0.30;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy, waterRx, waterRy, 0, 0, Math.PI * 2);
            const waterGrad = ctx.createRadialGradient(cx, cy - waterRy * 0.4, waterRx * 0.1, cx, cy, waterRx);
            waterGrad.addColorStop(0, 'rgba(180, 220, 240, 0.35)');
            waterGrad.addColorStop(0.6, 'rgba(120, 180, 220, 0.25)');
            waterGrad.addColorStop(1, 'rgba(80, 140, 180, 0.15)');
            ctx.fillStyle = waterGrad;
            ctx.fill();
            ctx.restore();

            // -- bubbles
            for (const b of bubbles) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 230, 255, ${b.alpha})`;
                ctx.fill();
                // tiny highlight
                ctx.beginPath();
                ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * 0.6})`;
                ctx.fill();
            }

            // -- dumplings
            for (const obj of objects.value) {
                ctx.save();

                // flash phase: target glow green
                if (phase.value === 'flash' && obj.isTarget) {
                    ctx.shadowColor = '#22ee66';
                    ctx.shadowBlur = 22;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y, R + 5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(34, 238, 102, 0.25)';
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // selected highlight
                if (obj.selected) {
                    ctx.shadowColor = '#ffcc00';
                    ctx.shadowBlur = 16;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y, R + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ffcc00';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // result: reveal missed targets
                if (phase.value === 'result' && obj.isTarget && !obj.selected) {
                    ctx.shadowColor = '#22ee66';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y, R + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = '#22ee66';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.shadowBlur = 0;
                }

                // dumpling body
                const grad = ctx.createRadialGradient(
                    obj.x - R * 0.25, obj.y - R * 0.3, R * 0.1,
                    obj.x, obj.y, R
                );

                if (phase.value === 'flash' && obj.isTarget) {
                    grad.addColorStop(0, '#d4ffd4');
                    grad.addColorStop(0.5, '#a0eeaa');
                    grad.addColorStop(1, '#66cc77');
                } else if (phase.value === 'result' && obj.revealed) {
                    if (obj.selected && obj.isTarget) {
                        grad.addColorStop(0, '#c8ffc8');
                        grad.addColorStop(0.5, '#77dd88');
                        grad.addColorStop(1, '#44aa55');
                    } else if (obj.selected && !obj.isTarget) {
                        grad.addColorStop(0, '#ffcccc');
                        grad.addColorStop(0.5, '#ee7777');
                        grad.addColorStop(1, '#cc4444');
                    } else if (!obj.selected && obj.isTarget) {
                        grad.addColorStop(0, '#ffffcc');
                        grad.addColorStop(0.5, '#ddcc55');
                        grad.addColorStop(1, '#aa9933');
                    } else {
                        grad.addColorStop(0, '#faf8f0');
                        grad.addColorStop(0.5, '#e8e4d4');
                        grad.addColorStop(1, '#ccc8b8');
                    }
                } else {
                    // normal white dumpling
                    grad.addColorStop(0, '#ffffff');
                    grad.addColorStop(0.4, '#f5f0e6');
                    grad.addColorStop(0.8, '#e8e0d0');
                    grad.addColorStop(1, '#d4cbb8');
                }

                ctx.beginPath();
                ctx.arc(obj.x, obj.y, R, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                // subtle dumpling pleats (top crescent)
                ctx.beginPath();
                ctx.arc(obj.x, obj.y - R * 0.15, R * 0.75, Math.PI * 1.15, Math.PI * 1.85);
                ctx.strokeStyle = 'rgba(180,170,150,0.35)';
                ctx.lineWidth = 1.2;
                ctx.stroke();

                // highlight
                ctx.beginPath();
                ctx.arc(obj.x - R * 0.2, obj.y - R * 0.25, R * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fill();

                // result marks
                if (phase.value === 'result' && obj.revealed) {
                    ctx.font = `bold ${R * 0.85}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    if (obj.selected && obj.isTarget) {
                        ctx.fillStyle = '#116622';
                        ctx.fillText('✓', obj.x, obj.y);
                    } else if (obj.selected && !obj.isTarget) {
                        ctx.fillStyle = '#881111';
                        ctx.fillText('✗', obj.x, obj.y);
                    } else if (!obj.selected && obj.isTarget) {
                        ctx.fillStyle = '#886600';
                        ctx.fillText('!', obj.x, obj.y);
                    }
                }

                ctx.restore();
            }

            // -- steam
            for (const s of steams) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(220, 230, 240, ${s.alpha * s.life})`;
                ctx.fill();
            }
        }

        // ── animation ───────────────────────────────────────────
        function animationLoop() {
            if (phase.value === 'move') updatePhysics();
            updateBubbles();
            updateSteam();
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

            nextTick(() => {
                const canvas = canvasRef.value;
                if (canvas) {
                    const container = canvas.parentElement;
                    canvasW = container.clientWidth;
                    canvasH = container.clientHeight;
                    canvas.width = canvasW;
                    canvas.height = canvasH;
                }
                initBubbles();
                initSteam();
                initObjects();

                phase.value = 'flash';
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
                if (dist < R * 1.5 && dist < closestDist) { closest = obj; closestDist = dist; }
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
                game: 'DumplingMOTGame',
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
    <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: linear-gradient(135deg, #2a1a0a 0%, #3b2210 40%, #1a0e05 100%);">
        <div class="relative w-full max-w-2xl mx-4 flex flex-col items-center" style="max-height: 90vh;">

            <!-- status bar -->
            <div v-if="phase !== 'intro'" class="w-full mb-3 px-2">
                <div class="flex items-center justify-between bg-stone-900/70 backdrop-blur rounded-xl px-4 py-2 border border-amber-900/30">
                    <div class="flex items-center gap-2">
                        <span class="text-amber-400 text-xs font-bold tracking-wider uppercase">{{ t('header_subtitle') }}</span>
                        <span class="text-stone-500 mx-1">|</span>
                        <span class="text-white text-sm font-bold">{{ t('header_title') }}</span>
                    </div>
                    <div v-if="phase === 'select'" class="text-amber-300 text-sm font-mono">
                        {{ t('selected_indicator', { n: selectedCount, total: config.targetCount }) }}
                    </div>
                </div>
                <div class="mt-2 text-center">
                    <div v-if="phase === 'flash'" class="text-green-400 text-sm font-bold animate-pulse">
                        {{ t('phase_flash') }}
                    </div>
                    <div v-else-if="phase === 'move'" class="text-orange-300 text-sm font-bold">
                        {{ t('phase_move', { sec: countdown }) }}
                    </div>
                    <div v-else-if="phase === 'select'" class="text-amber-300 text-sm font-bold">
                        {{ t('phase_select', { remaining: remaining }) }}
                    </div>
                </div>
            </div>

            <!-- intro -->
            <div v-if="phase === 'intro'" class="text-center px-6 py-10 bg-stone-900/60 backdrop-blur-lg rounded-2xl border border-amber-900/30 max-w-lg">
                <div class="text-5xl mb-4">🥟</div>
                <h2 class="text-2xl font-black text-white mb-4">{{ t('intro_title') }}</h2>
                <p class="text-stone-300 text-sm leading-relaxed mb-8" v-html="t('intro_desc', { total: config.totalObjects, targets: config.targetCount })"></p>
                <button @click="startGame"
                    class="px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-900/40 transition-all transform hover:scale-105 active:scale-95">
                    {{ t('start_button') }}
                </button>
            </div>

            <!-- canvas -->
            <div v-show="phase !== 'intro'" class="w-full relative rounded-xl overflow-hidden border border-amber-900/40 shadow-2xl shadow-black/50" style="aspect-ratio: 6/5.6;">
                <canvas ref="canvasRef" @click="handleCanvasClick"
                    class="w-full h-full cursor-crosshair"
                    style="background: #3b2a1a;">
                </canvas>

                <!-- boiling shimmer -->
                <div v-if="phase === 'move'" class="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.07]">
                    <div class="absolute w-full h-1 bg-orange-300 animate-boil-line"></div>
                </div>
            </div>

            <!-- result panel -->
            <div v-if="phase === 'result'" class="w-full mt-4 bg-stone-900/70 backdrop-blur rounded-xl border border-amber-900/30 p-5">
                <div class="text-center mb-3">
                    <h3 class="text-white font-bold text-lg">{{ t('phase_result') }}</h3>
                    <p class="text-lg mt-1">{{ perfMessage }}</p>
                </div>
                <div class="grid grid-cols-4 gap-3 mb-4">
                    <div class="text-center">
                        <div class="text-2xl font-black text-green-400">{{ results.hits }}</div>
                        <div class="text-xs text-stone-400">{{ t('correct_label') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-black text-yellow-400">{{ results.misses }}</div>
                        <div class="text-xs text-stone-400">{{ t('missed_label') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-black text-red-400">{{ results.falseAlarms }}</div>
                        <div class="text-xs text-stone-400">{{ t('false_alarm_label') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-black text-amber-400">{{ results.accuracy }}%</div>
                        <div class="text-xs text-stone-400">{{ t('accuracy_label') }}</div>
                    </div>
                </div>
                <div class="flex justify-center">
                    <button @click="finishGame"
                        class="px-8 py-2.5 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95">
                        {{ t('finish_button') }}
                    </button>
                </div>
            </div>

        </div>

        <style>
            @keyframes boil-line {
                0% { top: 100%; }
                100% { top: -2px; }
            }
            .animate-boil-line {
                animation: boil-line 1.5s ease-in-out infinite;
            }
        </style>
    </div>
    `
};

window.DumplingMOTGame = DumplingMOTGame;
