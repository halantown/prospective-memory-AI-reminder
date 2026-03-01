/**
 * 多目标追踪 (Multiple Object Tracking, MOT)
 * 游戏化包装："星际雷达" — 在众多移动陨石中追踪敌方隐形飞船
 *
 * 玩法：
 *  1. 屏幕上出现 totalObjects 个相同的小球（陨石）
 *  2. 其中 targetCount 个闪烁标记为"目标"（敌方飞船）
 *  3. 所有小球开始随机运动（台球碰撞物理）
 *  4. moveDuration 秒后运动停止
 *  5. 玩家点击选出目标小球
 *
 * 可通过 scenario 配置:
 *   totalObjects (默认10), targetCount (默认4), moveDuration (默认8s),
 *   flashDuration (默认2s), objectRadius (默认22), lang ('zh'|'en'|'nl')
 */
const MOTGame = {
    name: 'MOTGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, reactive, onMounted, onUnmounted, nextTick } = Vue;

        // ============================================================
        // 配置
        // ============================================================
        const defaultScenario = {
            totalObjects: 10,
            targetCount: 4,
            moveDuration: 8000,
            flashDuration: 2000,
            objectRadius: 22,
            speed: 2.5,
            lang: 'zh'
        };
        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ============================================================
        // i18n
        // ============================================================
        const TEXTS = {
            header_subtitle: { zh: '多目标追踪', en: 'Multiple Object Tracking', nl: 'Meervoudig Object Volgen' },
            header_title: { zh: '星际雷达', en: 'Star Radar', nl: 'Sterrenradar' },
            intro_title: { zh: '🛸 星际雷达', en: '🛸 Star Radar', nl: '🛸 Sterrenradar' },
            intro_desc: {
                zh: '太空中有 <strong class="text-cyan-300">{total}</strong> 颗陨石在漂浮，其中 <strong class="text-red-400">{targets}</strong> 颗是<strong class="text-red-400">敌方隐形飞船</strong>伪装的！<br/><br/>它们会先<strong class="text-yellow-300">闪烁</strong>暴露身份，随后所有陨石开始移动。<br/>你的任务：在运动停止后，<strong class="text-cyan-300">点击</strong>找出那些隐形飞船！',
                en: 'There are <strong class="text-cyan-300">{total}</strong> asteroids floating in space. <strong class="text-red-400">{targets}</strong> of them are <strong class="text-red-400">enemy stealth ships</strong> in disguise!<br/><br/>They will <strong class="text-yellow-300">flash</strong> to reveal themselves, then all asteroids start moving.<br/>Your mission: after they stop, <strong class="text-cyan-300">click</strong> to identify the stealth ships!',
                nl: 'Er zijn <strong class="text-cyan-300">{total}</strong> asteroïden in de ruimte. <strong class="text-red-400">{targets}</strong> daarvan zijn vermomde <strong class="text-red-400">vijandelijke stealthschepen</strong>!<br/><br/>Ze <strong class="text-yellow-300">knipperen</strong> kort om zich te verraden, daarna gaan alle asteroïden bewegen.<br/>Jouw missie: na het stoppen, <strong class="text-cyan-300">klik</strong> om de stealthschepen te vinden!'
            },
            start_button: { zh: '启动雷达', en: 'Activate Radar', nl: 'Radar Activeren' },
            phase_flash: { zh: '🔴 锁定目标中…记住它们！', en: '🔴 Locking targets… Remember them!', nl: '🔴 Doelen vergrendelen… Onthoud ze!' },
            phase_move: { zh: '👀 保持追踪！剩余 {sec} 秒', en: '👀 Keep tracking! {sec}s left', nl: '👀 Blijf volgen! Nog {sec}s' },
            phase_select: { zh: '🎯 点击选出 {remaining} 个隐形飞船', en: '🎯 Click to select {remaining} stealth ship(s)', nl: '🎯 Klik om {remaining} stealthschip(en) te selecteren' },
            phase_result: { zh: '任务完成', en: 'Mission Complete', nl: 'Missie Voltooid' },
            correct_label: { zh: '命中', en: 'Hits', nl: 'Treffers' },
            missed_label: { zh: '遗漏', en: 'Missed', nl: 'Gemist' },
            false_alarm_label: { zh: '误选', en: 'False Alarms', nl: 'Vals Alarm' },
            accuracy_label: { zh: '准确率', en: 'Accuracy', nl: 'Nauwkeurigheid' },
            perf_excellent: { zh: '🌟 雷达精准度极高！', en: '🌟 Radar precision is outstanding!', nl: '🌟 Radarprecisie is uitstekend!' },
            perf_good: { zh: '👍 雷达表现不错！', en: '👍 Good radar performance!', nl: '👍 Goede radarprestatie!' },
            perf_ok: { zh: '🔄 继续校准雷达！', en: '🔄 Keep calibrating the radar!', nl: '🔄 Blijf de radar kalibreren!' },
            finish_button: { zh: '完成', en: 'Finish', nl: 'Voltooien' },
            selected_indicator: { zh: '已选 {n}/{total}', en: 'Selected {n}/{total}', nl: 'Geselecteerd {n}/{total}' }
        };
        const lang = computed(() => config.value.lang || 'zh');
        const t = (key, params = {}) => {
            let text = TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
            Object.entries(params).forEach(([k, v]) => {
                text = text.replaceAll(`{${k}}`, v);
            });
            return text;
        };

        // ============================================================
        // 状态
        // ============================================================
        const phase = ref('intro');       // 'intro' | 'flash' | 'move' | 'select' | 'result'
        const objects = ref([]);          // { id, x, y, vx, vy, isTarget, selected, revealed }
        const countdown = ref(0);
        const canvasRef = ref(null);
        const selectedCount = ref(0);
        const results = reactive({ hits: 0, misses: 0, falseAlarms: 0, accuracy: 0 });
        const startTime = ref(0);

        let animFrameId = null;
        let countdownTimer = null;
        let canvasW = 600;
        let canvasH = 500;

        // ============================================================
        // 初始化小球
        // ============================================================
        function initObjects() {
            const R = config.value.objectRadius;
            const total = config.value.totalObjects;
            const targets = config.value.targetCount;
            const padding = R * 2;
            const arr = [];

            // 随机选择目标索引
            const targetIndices = new Set();
            while (targetIndices.size < targets) {
                targetIndices.add(Math.floor(Math.random() * total));
            }

            for (let i = 0; i < total; i++) {
                let x, y, overlapping;
                // 确保小球不重叠
                let attempts = 0;
                do {
                    overlapping = false;
                    x = padding + Math.random() * (canvasW - padding * 2);
                    y = padding + Math.random() * (canvasH - padding * 2);
                    for (const obj of arr) {
                        const dx = obj.x - x;
                        const dy = obj.y - y;
                        if (Math.sqrt(dx * dx + dy * dy) < R * 2.5) {
                            overlapping = true;
                            break;
                        }
                    }
                    attempts++;
                } while (overlapping && attempts < 200);

                const angle = Math.random() * Math.PI * 2;
                const speed = config.value.speed;
                arr.push({
                    id: i,
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    isTarget: targetIndices.has(i),
                    selected: false,
                    revealed: false
                });
            }
            objects.value = arr;
        }

        // ============================================================
        // 物理引擎：碰撞检测 + 边界反弹
        // ============================================================
        function updatePhysics() {
            const R = config.value.objectRadius;
            const objs = objects.value;

            for (const obj of objs) {
                obj.x += obj.vx;
                obj.y += obj.vy;

                // 边界反弹
                if (obj.x - R < 0) { obj.x = R; obj.vx = Math.abs(obj.vx); }
                if (obj.x + R > canvasW) { obj.x = canvasW - R; obj.vx = -Math.abs(obj.vx); }
                if (obj.y - R < 0) { obj.y = R; obj.vy = Math.abs(obj.vy); }
                if (obj.y + R > canvasH) { obj.y = canvasH - R; obj.vy = -Math.abs(obj.vy); }
            }

            // 小球间弹性碰撞
            for (let i = 0; i < objs.length; i++) {
                for (let j = i + 1; j < objs.length; j++) {
                    const a = objs[i];
                    const b = objs[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = R * 2;

                    if (dist < minDist && dist > 0) {
                        // 法向量
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // 相对速度
                        const dvx = a.vx - b.vx;
                        const dvy = a.vy - b.vy;
                        const dvn = dvx * nx + dvy * ny;

                        // 只在靠近时碰撞
                        if (dvn > 0) {
                            a.vx -= dvn * nx;
                            a.vy -= dvn * ny;
                            b.vx += dvn * nx;
                            b.vy += dvn * ny;
                        }

                        // 分离重叠
                        const overlap = (minDist - dist) / 2;
                        a.x -= overlap * nx;
                        a.y -= overlap * ny;
                        b.x += overlap * nx;
                        b.y += overlap * ny;
                    }
                }
            }
        }

        // ============================================================
        // Canvas 渲染
        // ============================================================
        function render() {
            const canvas = canvasRef.value;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const R = config.value.objectRadius;

            ctx.clearRect(0, 0, canvasW, canvasH);

            // 绘制星空背景粒子
            drawStars(ctx);

            for (const obj of objects.value) {
                ctx.save();

                // 闪烁阶段：目标发光
                if (phase.value === 'flash' && obj.isTarget) {
                    // 外发光
                    ctx.shadowColor = '#ff4444';
                    ctx.shadowBlur = 20;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y, R + 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // 选中高亮
                if (obj.selected) {
                    ctx.shadowColor = '#00ffff';
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y, R + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // 结果阶段：揭示目标
                if (phase.value === 'result' && obj.isTarget && !obj.selected) {
                    ctx.shadowColor = '#ff6600';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y, R + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ff6600';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.shadowBlur = 0;
                }

                // 陨石本体
                const grad = ctx.createRadialGradient(obj.x - R * 0.3, obj.y - R * 0.3, R * 0.1, obj.x, obj.y, R);

                if (phase.value === 'flash' && obj.isTarget) {
                    grad.addColorStop(0, '#ff8888');
                    grad.addColorStop(0.7, '#cc2222');
                    grad.addColorStop(1, '#881111');
                } else if (phase.value === 'result' && obj.revealed) {
                    if (obj.selected && obj.isTarget) {
                        grad.addColorStop(0, '#88ffaa');
                        grad.addColorStop(0.7, '#22aa44');
                        grad.addColorStop(1, '#116622');
                    } else if (obj.selected && !obj.isTarget) {
                        grad.addColorStop(0, '#ff8888');
                        grad.addColorStop(0.7, '#cc3333');
                        grad.addColorStop(1, '#882222');
                    } else if (!obj.selected && obj.isTarget) {
                        grad.addColorStop(0, '#ffcc44');
                        grad.addColorStop(0.7, '#cc8800');
                        grad.addColorStop(1, '#885500');
                    } else {
                        grad.addColorStop(0, '#8899aa');
                        grad.addColorStop(0.7, '#556677');
                        grad.addColorStop(1, '#334455');
                    }
                } else {
                    grad.addColorStop(0, '#8899aa');
                    grad.addColorStop(0.7, '#556677');
                    grad.addColorStop(1, '#334455');
                }

                ctx.beginPath();
                ctx.arc(obj.x, obj.y, R, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                // 陨石纹理
                ctx.beginPath();
                ctx.arc(obj.x - R * 0.25, obj.y - R * 0.2, R * 0.2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(obj.x + R * 0.3, obj.y + R * 0.25, R * 0.12, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fill();

                // 结果阶段标记
                if (phase.value === 'result' && obj.revealed) {
                    ctx.font = `bold ${R * 0.8}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    if (obj.selected && obj.isTarget) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText('✓', obj.x, obj.y);
                    } else if (obj.selected && !obj.isTarget) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText('✗', obj.x, obj.y);
                    } else if (!obj.selected && obj.isTarget) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText('!', obj.x, obj.y);
                    }
                }

                ctx.restore();
            }
        }

        // 星空背景粒子
        let stars = [];
        function initStars() {
            stars = [];
            for (let i = 0; i < 80; i++) {
                stars.push({
                    x: Math.random() * canvasW,
                    y: Math.random() * canvasH,
                    r: Math.random() * 1.5 + 0.5,
                    alpha: Math.random() * 0.6 + 0.2
                });
            }
        }
        function drawStars(ctx) {
            for (const s of stars) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 220, 255, ${s.alpha})`;
                ctx.fill();
            }
        }

        // ============================================================
        // 动画循环
        // ============================================================
        function animationLoop() {
            if (phase.value === 'move') {
                updatePhysics();
            }
            render();
            animFrameId = requestAnimationFrame(animationLoop);
        }

        function stopAnimation() {
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        }

        // ============================================================
        // 游戏流程
        // ============================================================
        function startGame() {
            startTime.value = Date.now();
            selectedCount.value = 0;

            // 调整 canvas 尺寸
            nextTick(() => {
                const canvas = canvasRef.value;
                if (canvas) {
                    const container = canvas.parentElement;
                    canvasW = container.clientWidth;
                    canvasH = container.clientHeight;
                    canvas.width = canvasW;
                    canvas.height = canvasH;
                }
                initStars();
                initObjects();

                // 阶段 1: 闪烁
                phase.value = 'flash';
                animationLoop();

                setTimeout(() => {
                    // 阶段 2: 运动
                    phase.value = 'move';
                    const totalMs = config.value.moveDuration;
                    countdown.value = Math.ceil(totalMs / 1000);
                    countdownTimer = setInterval(() => {
                        countdown.value--;
                        if (countdown.value <= 0) {
                            clearInterval(countdownTimer);
                            countdownTimer = null;
                            // 阶段 3: 选择
                            phase.value = 'select';
                        }
                    }, 1000);
                }, config.value.flashDuration);
            });
        }

        // ============================================================
        // 点击选择
        // ============================================================
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

            // 找到最近的小球
            let closest = null;
            let closestDist = Infinity;
            for (const obj of objects.value) {
                const dx = obj.x - mx;
                const dy = obj.y - my;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < R * 1.5 && dist < closestDist) {
                    closest = obj;
                    closestDist = dist;
                }
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

                // 自动提交
                if (selectedCount.value === config.value.targetCount) {
                    setTimeout(evaluateResults, 500);
                }
            }
        }

        // ============================================================
        // 评估结果
        // ============================================================
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
            // 重新启动渲染以显示结果
            animationLoop();
        }

        function finishGame() {
            stopAnimation();
            emit('complete', {
                game: 'MOTGame',
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

        // ============================================================
        // 生命周期
        // ============================================================
        onUnmounted(() => {
            stopAnimation();
            if (countdownTimer) clearInterval(countdownTimer);
        });

        // ============================================================
        // 计算属性
        // ============================================================
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
    <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: linear-gradient(135deg, #0a0e27 0%, #1a1040 40%, #0d1b2a 100%);">
        <div class="relative w-full max-w-2xl mx-4 flex flex-col items-center" style="max-height: 90vh;">

            <!-- 顶部状态栏 -->
            <div v-if="phase !== 'intro'" class="w-full mb-3 px-2">
                <div class="flex items-center justify-between bg-slate-900/70 backdrop-blur rounded-xl px-4 py-2 border border-cyan-900/30">
                    <div class="flex items-center gap-2">
                        <span class="text-cyan-400 text-xs font-bold tracking-wider uppercase">{{ t('header_subtitle') }}</span>
                        <span class="text-slate-500 mx-1">|</span>
                        <span class="text-white text-sm font-bold">{{ t('header_title') }}</span>
                    </div>
                    <div v-if="phase === 'select'" class="text-cyan-300 text-sm font-mono">
                        {{ t('selected_indicator', { n: selectedCount, total: config.targetCount }) }}
                    </div>
                </div>

                <!-- 阶段提示 -->
                <div class="mt-2 text-center">
                    <div v-if="phase === 'flash'" class="text-red-400 text-sm font-bold animate-pulse">
                        {{ t('phase_flash') }}
                    </div>
                    <div v-else-if="phase === 'move'" class="text-yellow-300 text-sm font-bold">
                        {{ t('phase_move', { sec: countdown }) }}
                    </div>
                    <div v-else-if="phase === 'select'" class="text-cyan-300 text-sm font-bold">
                        {{ t('phase_select', { remaining: remaining }) }}
                    </div>
                </div>
            </div>

            <!-- 介绍页 -->
            <div v-if="phase === 'intro'" class="text-center px-6 py-10 bg-slate-900/60 backdrop-blur-lg rounded-2xl border border-cyan-900/30 max-w-lg">
                <div class="text-4xl mb-4">🛸</div>
                <h2 class="text-2xl font-black text-white mb-4">{{ t('intro_title') }}</h2>
                <p class="text-slate-300 text-sm leading-relaxed mb-8" v-html="t('intro_desc', { total: config.totalObjects, targets: config.targetCount })"></p>
                <button @click="startGame"
                    class="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/40 transition-all transform hover:scale-105 active:scale-95">
                    {{ t('start_button') }}
                </button>
            </div>

            <!-- 游戏画布 -->
            <div v-show="phase !== 'intro'" class="w-full relative rounded-xl overflow-hidden border border-cyan-900/40 shadow-2xl shadow-black/50" style="aspect-ratio: 6/5;">
                <canvas ref="canvasRef" @click="handleCanvasClick"
                    class="w-full h-full cursor-crosshair"
                    style="background: radial-gradient(ellipse at center, #0d1b2a 0%, #070b14 100%);">
                </canvas>

                <!-- 扫描线特效 -->
                <div v-if="phase === 'move'" class="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
                    <div class="absolute w-full h-0.5 bg-cyan-400 animate-scan-line"></div>
                </div>
            </div>

            <!-- 结果面板 -->
            <div v-if="phase === 'result'" class="w-full mt-4 bg-slate-900/70 backdrop-blur rounded-xl border border-cyan-900/30 p-5">
                <div class="text-center mb-3">
                    <h3 class="text-white font-bold text-lg">{{ t('phase_result') }}</h3>
                    <p class="text-lg mt-1">{{ perfMessage }}</p>
                </div>
                <div class="grid grid-cols-4 gap-3 mb-4">
                    <div class="text-center">
                        <div class="text-2xl font-black text-green-400">{{ results.hits }}</div>
                        <div class="text-xs text-slate-400">{{ t('correct_label') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-black text-yellow-400">{{ results.misses }}</div>
                        <div class="text-xs text-slate-400">{{ t('missed_label') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-black text-red-400">{{ results.falseAlarms }}</div>
                        <div class="text-xs text-slate-400">{{ t('false_alarm_label') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-black text-cyan-400">{{ results.accuracy }}%</div>
                        <div class="text-xs text-slate-400">{{ t('accuracy_label') }}</div>
                    </div>
                </div>
                <div class="flex justify-center">
                    <button @click="finishGame"
                        class="px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95">
                        {{ t('finish_button') }}
                    </button>
                </div>
            </div>

        </div>

        <!-- 扫描线动画 CSS -->
        <style>
            @keyframes scan-line {
                0% { top: -2px; }
                100% { top: 100%; }
            }
            .animate-scan-line {
                animation: scan-line 2s linear infinite;
            }
        </style>
    </div>
    `
};

window.MOTGame = MOTGame;
