/**
 * Garden Sort Game — 花园分类游戏
 * Continuous sorting mini-game with a garden/nature theme.
 * Items fall from the top; player sorts LEFT (garden) or RIGHT (indoor).
 * Speed increases over time. Tracks accuracy, reaction time, errors.
 */
const GardenSortGame = {
    name: 'GardenSortGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted, nextTick } = Vue;

        // ============================================================
        // Item Pool
        // ============================================================
        const ITEMS = [
            // GARDEN (left)
            { emoji: '🌷', name: { zh: '郁金香', en: 'Tulip', nl: 'Tulp' }, category: 'garden' },
            { emoji: '🌻', name: { zh: '向日葵', en: 'Sunflower', nl: 'Zonnebloem' }, category: 'garden' },
            { emoji: '🪴', name: { zh: '盆栽', en: 'Potted Plant', nl: 'Potplant' }, category: 'garden' },
            { emoji: '🌿', name: { zh: '香草', en: 'Herbs', nl: 'Kruiden' }, category: 'garden' },
            { emoji: '🥕', name: { zh: '胡萝卜', en: 'Carrot', nl: 'Wortel' }, category: 'garden' },
            { emoji: '🍅', name: { zh: '西红柿', en: 'Tomato', nl: 'Tomaat' }, category: 'garden' },
            { emoji: '🌳', name: { zh: '树苗', en: 'Sapling', nl: 'Boompje' }, category: 'garden' },
            { emoji: '🦋', name: { zh: '蝴蝶', en: 'Butterfly', nl: 'Vlinder' }, category: 'garden' },
            { emoji: '🐝', name: { zh: '蜜蜂', en: 'Bee', nl: 'Bij' }, category: 'garden' },
            { emoji: '🪻', name: { zh: '薰衣草', en: 'Lavender', nl: 'Lavendel' }, category: 'garden' },
            // INDOOR (right)
            { emoji: '🛋️', name: { zh: '沙发', en: 'Sofa', nl: 'Bank' }, category: 'indoor' },
            { emoji: '📺', name: { zh: '电视', en: 'TV', nl: 'TV' }, category: 'indoor' },
            { emoji: '🧸', name: { zh: '玩具熊', en: 'Teddy Bear', nl: 'Teddybeer' }, category: 'indoor' },
            { emoji: '🕯️', name: { zh: '蜡烛', en: 'Candle', nl: 'Kaars' }, category: 'indoor' },
            { emoji: '📚', name: { zh: '书本', en: 'Books', nl: 'Boeken' }, category: 'indoor' },
            { emoji: '🖼️', name: { zh: '画框', en: 'Picture Frame', nl: 'Fotolijst' }, category: 'indoor' },
            { emoji: '⏰', name: { zh: '闹钟', en: 'Alarm Clock', nl: 'Wekker' }, category: 'indoor' },
            { emoji: '🧹', name: { zh: '扫把', en: 'Broom', nl: 'Bezem' }, category: 'indoor' },
            { emoji: '🪞', name: { zh: '镜子', en: 'Mirror', nl: 'Spiegel' }, category: 'indoor' },
            { emoji: '🧶', name: { zh: '毛线', en: 'Yarn', nl: 'Garen' }, category: 'indoor' },
        ];

        // ============================================================
        // Config
        // ============================================================
        const defaultScenario = {
            totalItems: 30,
            initialFallSpeed: 2.5,
            speedIncrement: 0.03,
            maxFallSpeed: 6,
            spawnInterval: 1800,
            minSpawnInterval: 800,
            lang: 'zh'
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ============================================================
        // i18n
        // ============================================================
        const TEXTS = {
            header_subtitle: { zh: '分类测试', en: 'Sorting Test', nl: 'Sorteertest' },
            header_title: { zh: '花园分类', en: 'Garden Sort', nl: 'Tuin Sorteren' },
            intro_title: { zh: '花园分类挑战', en: 'Garden Sort Challenge', nl: 'Tuin Sorteer Uitdaging' },
            intro_desc: {
                zh: '物品会从上方掉落。请将<strong class="text-green-700">花园/自然</strong>物品分到<strong class="text-green-700">左边</strong>，将<strong class="text-amber-700">室内</strong>物品分到<strong class="text-amber-700">右边</strong>。',
                en: 'Items will fall from above. Sort <strong class="text-green-700">garden/nature</strong> items to the <strong class="text-green-700">LEFT</strong> and <strong class="text-amber-700">indoor</strong> items to the <strong class="text-amber-700">RIGHT</strong>.',
                nl: 'Voorwerpen vallen van boven. Sorteer <strong class="text-green-700">tuin/natuur</strong> items naar <strong class="text-green-700">LINKS</strong> en <strong class="text-amber-700">binnen</strong> items naar <strong class="text-amber-700">RECHTS</strong>.'
            },
            intro_controls: {
                zh: '⌨️ 使用 ← / → 方向键或 A / D 键，也可以点击左右按钮。',
                en: '⌨️ Use ← / → arrow keys or A / D keys, or click the buttons.',
                nl: '⌨️ Gebruik ← / → pijltoetsen of A / D toetsen, of klik op de knoppen.'
            },
            intro_speed: {
                zh: '⚡ 速度会逐渐加快，请尽快分类！',
                en: '⚡ Speed increases over time — sort quickly!',
                nl: '⚡ Snelheid neemt toe — sorteer snel!'
            },
            example_garden: { zh: '花园物品示例：', en: 'Garden items example:', nl: 'Tuin items voorbeeld:' },
            example_indoor: { zh: '室内物品示例：', en: 'Indoor items example:', nl: 'Binnen items voorbeeld:' },
            start_button: { zh: '开始挑战', en: 'Start Challenge', nl: 'Start Uitdaging' },
            left_label: { zh: '🌱 花园', en: '🌱 Garden', nl: '🌱 Tuin' },
            right_label: { zh: '🏠 室内', en: '🏠 Indoor', nl: '🏠 Binnen' },
            progress_label: { zh: '已分类: {current} / {total}', en: 'Sorted: {current} / {total}', nl: 'Gesorteerd: {current} / {total}' },
            accuracy_label: { zh: '正确率: {value}%', en: 'Accuracy: {value}%', nl: 'Nauwkeurigheid: {value}%' },
            perf_excellent: { zh: '非常出色！', en: 'Excellent!', nl: 'Uitstekend!' },
            perf_good: { zh: '表现不错！', en: 'Well done!', nl: 'Goed gedaan!' },
            perf_practice: { zh: '继续加油！', en: 'Keep practicing!', nl: 'Blijf oefenen!' },
            task_complete: { zh: '花园分类完成', en: 'Garden Sort Complete', nl: 'Tuin Sorteren Voltooid' },
            total_accuracy: { zh: '总正确率', en: 'Total Accuracy', nl: 'Totale Nauwkeurigheid' },
            avg_rt: { zh: '平均反应时', en: 'Avg Response Time', nl: 'Gem. Reactietijd' },
            total_sorted: { zh: '总分类数', en: 'Total Sorted', nl: 'Totaal Gesorteerd' },
            errors_label: { zh: '错误数', en: 'Errors', nl: 'Fouten' },
            finish_button: { zh: '完成', en: 'Finish', nl: 'Voltooien' },
            missed_label: { zh: '遗漏', en: 'Missed', nl: 'Gemist' },
            correct_feedback: { zh: '✓ 正确', en: '✓ Correct', nl: '✓ Juist' },
            wrong_feedback: { zh: '✗ 错误', en: '✗ Wrong', nl: '✗ Fout' },
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
        // State
        // ============================================================
        const phase = ref('intro');           // 'intro' | 'playing' | 'feedback'
        const fallingItem = ref(null);        // current falling item { ...itemData, y, x, spawnTime }
        const fallSpeed = ref(0);             // current pixels-per-frame speed
        const spawnInterval = ref(0);         // current spawn interval in ms
        const itemsSpawned = ref(0);
        const itemsSorted = ref(0);
        const errors = ref(0);
        const missed = ref(0);
        const feedbackFlash = ref(null);      // 'correct' | 'wrong' | null
        const results = ref([]);              // per-item results
        const containerHeight = ref(500);
        const gameAreaRef = ref(null);

        let animFrameId = null;
        let spawnTimerId = null;
        let feedbackTimerId = null;
        let gameStartTime = 0;
        let lastFrameTime = 0;
        let keydownHandler = null;

        // ============================================================
        // Item generation
        // ============================================================
        const generateItemQueue = () => {
            const total = config.value.totalItems;
            const queue = [];
            for (let i = 0; i < total; i++) {
                const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
                queue.push({ ...item });
            }
            return queue;
        };

        let itemQueue = [];

        // ============================================================
        // Computed
        // ============================================================
        const accuracy = computed(() => {
            const total = itemsSorted.value + missed.value;
            if (total === 0) return 0;
            const correct = itemsSorted.value - errors.value;
            return Math.round((Math.max(0, correct) / total) * 100);
        });

        const avgResponseTime = computed(() => {
            const responded = results.value.filter(r => r.rt !== null);
            if (responded.length === 0) return 0;
            return Math.round(responded.reduce((sum, r) => sum + r.rt, 0) / responded.length);
        });

        const progressPercent = computed(() => {
            const total = config.value.totalItems;
            return Math.round(((itemsSorted.value + missed.value) / total) * 100);
        });

        const performanceLevel = computed(() => {
            if (accuracy.value >= 80) return 'excellent';
            if (accuracy.value >= 60) return 'good';
            return 'needsPractice';
        });

        const fallPercent = computed(() => {
            if (!fallingItem.value) return 0;
            return fallingItem.value.y;
        });

        // ============================================================
        // Game control
        // ============================================================
        const startGame = () => {
            itemQueue = generateItemQueue();
            itemsSpawned.value = 0;
            itemsSorted.value = 0;
            errors.value = 0;
            missed.value = 0;
            results.value = [];
            fallingItem.value = null;
            feedbackFlash.value = null;
            fallSpeed.value = config.value.initialFallSpeed;
            spawnInterval.value = config.value.spawnInterval;
            gameStartTime = performance.now();
            phase.value = 'playing';

            nextTick(() => {
                if (gameAreaRef.value) {
                    containerHeight.value = gameAreaRef.value.clientHeight || 500;
                }
                spawnNextItem();
                startAnimationLoop();
            });
        };

        const spawnNextItem = () => {
            if (itemsSpawned.value >= config.value.totalItems) return;

            // If there's still a falling item, mark it missed
            if (fallingItem.value) {
                handleMissed();
            }

            const item = itemQueue[itemsSpawned.value];
            const xPos = 20 + Math.random() * 60; // 20%-80% horizontal range
            fallingItem.value = {
                ...item,
                y: 0,
                x: xPos,
                spawnTime: performance.now()
            };
            itemsSpawned.value++;

            // Increase speed
            fallSpeed.value = Math.min(
                config.value.maxFallSpeed,
                config.value.initialFallSpeed + config.value.speedIncrement * itemsSpawned.value
            );
            spawnInterval.value = Math.max(
                config.value.minSpawnInterval,
                config.value.spawnInterval - itemsSpawned.value * 20
            );

            // Schedule next spawn
            if (itemsSpawned.value < config.value.totalItems) {
                spawnTimerId = setTimeout(spawnNextItem, spawnInterval.value);
            }
        };

        const startAnimationLoop = () => {
            lastFrameTime = performance.now();
            const loop = (now) => {
                if (phase.value !== 'playing') return;
                const delta = (now - lastFrameTime) / 16.67; // normalize to ~60fps
                lastFrameTime = now;

                if (fallingItem.value) {
                    fallingItem.value.y += fallSpeed.value * delta;

                    // Reached bottom — missed
                    if (fallingItem.value.y >= 100) {
                        handleMissed();
                    }
                }

                animFrameId = requestAnimationFrame(loop);
            };
            animFrameId = requestAnimationFrame(loop);
        };

        const handleMissed = () => {
            if (!fallingItem.value) return;
            const item = fallingItem.value;
            results.value.push({
                emoji: item.emoji,
                category: item.category,
                response: null,
                correct: false,
                rt: null
            });
            missed.value++;
            showFeedback('wrong');
            fallingItem.value = null;
            checkEnd();
        };

        const handleSort = (side) => {
            if (phase.value !== 'playing' || !fallingItem.value) return;
            const item = fallingItem.value;
            const rt = Math.round(performance.now() - item.spawnTime);
            const correctSide = item.category === 'garden' ? 'left' : 'right';
            const isCorrect = side === correctSide;

            results.value.push({
                emoji: item.emoji,
                category: item.category,
                response: side,
                correct: isCorrect,
                rt
            });

            itemsSorted.value++;
            if (!isCorrect) errors.value++;

            showFeedback(isCorrect ? 'correct' : 'wrong');
            fallingItem.value = null;
            checkEnd();
        };

        const showFeedback = (type) => {
            feedbackFlash.value = type;
            clearTimeout(feedbackTimerId);
            feedbackTimerId = setTimeout(() => {
                feedbackFlash.value = null;
            }, 400);
        };

        const checkEnd = () => {
            const total = itemsSorted.value + missed.value;
            if (total >= config.value.totalItems) {
                endGame();
            }
        };

        const endGame = () => {
            cancelAnimationFrame(animFrameId);
            clearTimeout(spawnTimerId);
            clearTimeout(feedbackTimerId);
            animFrameId = null;
            spawnTimerId = null;
            fallingItem.value = null;
            phase.value = 'feedback';
        };

        const finishGame = () => {
            emit('complete', {
                success: accuracy.value >= 60,
                totalItems: config.value.totalItems,
                accuracy: accuracy.value,
                avgResponseTime: avgResponseTime.value,
                totalTime: Math.round(performance.now() - gameStartTime),
                errors: errors.value,
                missed: missed.value,
                items: results.value
            });
        };

        // ============================================================
        // Keyboard
        // ============================================================
        const setupKeyboard = () => {
            keydownHandler = (e) => {
                if (phase.value !== 'playing') return;
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    e.preventDefault();
                    handleSort('left');
                } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    e.preventDefault();
                    handleSort('right');
                }
            };
            window.addEventListener('keydown', keydownHandler);
        };

        // ============================================================
        // Lifecycle
        // ============================================================
        onMounted(() => {
            setupKeyboard();
            if (window.lucide) window.lucide.createIcons();
        });

        onUnmounted(() => {
            cancelAnimationFrame(animFrameId);
            clearTimeout(spawnTimerId);
            clearTimeout(feedbackTimerId);
            if (keydownHandler) {
                window.removeEventListener('keydown', keydownHandler);
            }
        });

        return {
            config, phase, fallingItem, fallSpeed, feedbackFlash,
            itemsSpawned, itemsSorted, errors, missed, results,
            accuracy, avgResponseTime, progressPercent, performanceLevel,
            fallPercent, gameAreaRef, containerHeight,
            startGame, handleSort, finishGame,
            t, lang, ITEMS
        };
    },

    // ============================================================
    // Template
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-green-50 to-emerald-50">

        <!-- Header -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-green-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-green-100 p-3 rounded-xl">
                    <span class="text-3xl">🌱</span>
                </div>
                <div>
                    <span class="text-green-600 font-bold text-sm uppercase tracking-wider">{{ t('header_subtitle') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ t('header_title') }}</h2>
                </div>
            </div>

            <!-- Progress bar (playing phase) -->
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 transition-all duration-300"
                         :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{{ t('progress_label', { current: itemsSorted + missed, total: config.totalItems }) }}</span>
                    <span>{{ t('accuracy_label', { value: accuracy }) }}</span>
                </div>
            </div>
        </div>

        <!-- Main game area -->
        <div class="flex-grow p-4 overflow-hidden flex items-center justify-center">

            <!-- =============== INTRO =============== -->
            <div v-if="phase === 'intro'" class="text-center max-w-md">
                <div class="text-6xl mb-4">🌻</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('intro_title') }}</h3>
                <div class="bg-white rounded-2xl p-5 border border-green-200 shadow-sm text-left mb-6 space-y-3">
                    <p class="text-slate-600 leading-relaxed" v-html="t('intro_desc')"></p>

                    <!-- Examples -->
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-green-50 rounded-xl p-3">
                            <p class="text-xs font-bold text-green-700 mb-2">{{ t('example_garden') }}</p>
                            <div class="flex flex-wrap gap-1">
                                <span v-for="item in ITEMS.filter(i => i.category === 'garden').slice(0, 4)" :key="item.emoji"
                                      class="text-2xl">{{ item.emoji }}</span>
                            </div>
                            <p class="text-xs text-green-600 mt-1 font-bold">← {{ t('left_label') }}</p>
                        </div>
                        <div class="bg-amber-50 rounded-xl p-3">
                            <p class="text-xs font-bold text-amber-700 mb-2">{{ t('example_indoor') }}</p>
                            <div class="flex flex-wrap gap-1">
                                <span v-for="item in ITEMS.filter(i => i.category === 'indoor').slice(0, 4)" :key="item.emoji"
                                      class="text-2xl">{{ item.emoji }}</span>
                            </div>
                            <p class="text-xs text-amber-600 mt-1 font-bold">{{ t('right_label') }} →</p>
                        </div>
                    </div>

                    <p class="text-slate-500 text-sm">{{ t('intro_controls') }}</p>
                    <p class="text-slate-500 text-sm">{{ t('intro_speed') }}</p>
                </div>
                <button @click="startGame"
                    class="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('start_button') }}
                </button>
            </div>

            <!-- =============== PLAYING =============== -->
            <div v-if="phase === 'playing'" class="w-full h-full flex flex-col max-w-lg mx-auto">

                <!-- Zone labels -->
                <div class="flex justify-between items-center mb-2 px-2">
                    <div class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                        ← {{ t('left_label') }}
                    </div>
                    <div class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-bold">
                        {{ t('right_label') }} →
                    </div>
                </div>

                <!-- Falling area -->
                <div ref="gameAreaRef"
                     class="flex-grow relative bg-white/60 rounded-2xl border-2 border-dashed overflow-hidden"
                     :class="feedbackFlash === 'correct' ? 'border-green-400 bg-green-50/60'
                           : feedbackFlash === 'wrong' ? 'border-red-400 bg-red-50/60'
                           : 'border-green-200'">

                    <!-- Left/Right zone indicators -->
                    <div class="absolute inset-y-0 left-0 w-1/2 border-r border-dashed border-green-200/50 flex items-end justify-center pb-4 pointer-events-none">
                        <span class="text-green-300 text-4xl">🌱</span>
                    </div>
                    <div class="absolute inset-y-0 right-0 w-1/2 flex items-end justify-center pb-4 pointer-events-none">
                        <span class="text-amber-300 text-4xl">🏠</span>
                    </div>

                    <!-- Falling item -->
                    <div v-if="fallingItem"
                         class="absolute transition-none pointer-events-none"
                         :style="{
                             top: fallingItem.y + '%',
                             left: fallingItem.x + '%',
                             transform: 'translate(-50%, -50%)'
                         }">
                        <div class="bg-white rounded-2xl shadow-lg border-2 border-green-200 px-4 py-3 flex flex-col items-center gap-1 min-w-[70px]">
                            <span class="text-4xl">{{ fallingItem.emoji }}</span>
                            <span class="text-xs font-bold text-slate-600">{{ fallingItem.name[lang] }}</span>
                        </div>
                    </div>

                    <!-- Feedback flash overlay -->
                    <div v-if="feedbackFlash"
                         class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <span class="text-4xl font-black animate-ping"
                              :class="feedbackFlash === 'correct' ? 'text-green-500' : 'text-red-500'">
                            {{ feedbackFlash === 'correct' ? '✓' : '✗' }}
                        </span>
                    </div>
                </div>

                <!-- Sort buttons -->
                <div class="flex gap-3 mt-3">
                    <button @click="handleSort('left')"
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-lg py-4
                               shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <span>←</span> {{ t('left_label') }}
                    </button>
                    <button @click="handleSort('right')"
                        class="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-lg py-4
                               shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        {{ t('right_label') }} <span>→</span>
                    </button>
                </div>
            </div>

            <!-- =============== FEEDBACK =============== -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">
                    {{ performanceLevel === 'excellent' ? '🏆' : performanceLevel === 'good' ? '👍' : '💪' }}
                </div>
                <h3 class="text-2xl font-black mb-1"
                    :class="performanceLevel === 'excellent' ? 'text-green-600'
                          : performanceLevel === 'good' ? 'text-blue-600' : 'text-amber-600'">
                    {{ performanceLevel === 'excellent' ? t('perf_excellent')
                     : performanceLevel === 'good' ? t('perf_good') : t('perf_practice') }}
                </h3>
                <p class="text-slate-500 mb-5">{{ t('task_complete') }}</p>

                <!-- Result cards -->
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-green-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-green-700">{{ accuracy }}%</div>
                            <div class="text-xs text-green-500 font-bold">{{ t('total_accuracy') }}</div>
                        </div>
                        <div class="bg-blue-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-blue-700">{{ avgResponseTime }}ms</div>
                            <div class="text-xs text-blue-500 font-bold">{{ t('avg_rt') }}</div>
                        </div>
                        <div class="bg-emerald-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-emerald-700">{{ itemsSorted }}</div>
                            <div class="text-xs text-emerald-500 font-bold">{{ t('total_sorted') }}</div>
                        </div>
                        <div class="bg-red-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-red-700">{{ errors }} / {{ missed }}</div>
                            <div class="text-xs text-red-500 font-bold">{{ t('errors_label') }} / {{ t('missed_label') }}</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- Bottom bar -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            <div v-if="phase === 'playing'" class="text-center text-slate-400 text-sm">
                ⌨️ ← / A &nbsp;|&nbsp; → / D
            </div>
            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finish_button') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.GardenSortGame = GardenSortGame;
