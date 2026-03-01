/**
 * Kitchen Sort Game — 厨房分类
 * Continuous sorting minigame: food items fall from the top and the player
 * must quickly sort them LEFT (fridge / cold) or RIGHT (pantry / warm).
 *
 * Speed increases over time. Tracks accuracy, reaction time, errors.
 */

const KITCHEN_ITEMS = [
    // COLD (left) — items that go in the fridge
    { emoji: '🥛', name: { zh: '牛奶', en: 'Milk', nl: 'Melk' }, category: 'cold' },
    { emoji: '🧀', name: { zh: '奶酪', en: 'Cheese', nl: 'Kaas' }, category: 'cold' },
    { emoji: '🥚', name: { zh: '鸡蛋', en: 'Eggs', nl: 'Eieren' }, category: 'cold' },
    { emoji: '🍖', name: { zh: '生肉', en: 'Raw Meat', nl: 'Rauw Vlees' }, category: 'cold' },
    { emoji: '🥬', name: { zh: '生菜', en: 'Lettuce', nl: 'Sla' }, category: 'cold' },
    { emoji: '🍦', name: { zh: '冰淇淋', en: 'Ice Cream', nl: 'IJs' }, category: 'cold' },
    { emoji: '🧈', name: { zh: '黄油', en: 'Butter', nl: 'Boter' }, category: 'cold' },
    { emoji: '🥤', name: { zh: '果汁', en: 'Juice', nl: 'Sap' }, category: 'cold' },
    { emoji: '🍓', name: { zh: '草莓', en: 'Strawberry', nl: 'Aardbei' }, category: 'cold' },
    { emoji: '🐟', name: { zh: '鲜鱼', en: 'Fresh Fish', nl: 'Verse Vis' }, category: 'cold' },
    // WARM / PANTRY (right) — dry / shelf-stable items
    { emoji: '🍚', name: { zh: '大米', en: 'Rice', nl: 'Rijst' }, category: 'warm' },
    { emoji: '🍝', name: { zh: '意面', en: 'Pasta', nl: 'Pasta' }, category: 'warm' },
    { emoji: '🥫', name: { zh: '罐头', en: 'Canned Food', nl: 'Blikvoedsel' }, category: 'warm' },
    { emoji: '🍞', name: { zh: '面包', en: 'Bread', nl: 'Brood' }, category: 'warm' },
    { emoji: '🫘', name: { zh: '豆子', en: 'Beans', nl: 'Bonen' }, category: 'warm' },
    { emoji: '🧂', name: { zh: '盐', en: 'Salt', nl: 'Zout' }, category: 'warm' },
    { emoji: '🫒', name: { zh: '橄榄油', en: 'Olive Oil', nl: 'Olijfolie' }, category: 'warm' },
    { emoji: '🥜', name: { zh: '花生', en: 'Peanuts', nl: 'Pinda\'s' }, category: 'warm' },
    { emoji: '🍪', name: { zh: '饼干', en: 'Cookies', nl: 'Koekjes' }, category: 'warm' },
    { emoji: '🍫', name: { zh: '巧克力', en: 'Chocolate', nl: 'Chocolade' }, category: 'warm' },
];

const KitchenSortGame = {
    name: 'KitchenSortGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted, nextTick } = Vue;

        // ============================================================
        // Configuration
        // ============================================================
        const defaultScenario = {
            totalItems: 30,
            initialFallSpeed: 2.5,      // pixels per frame
            speedIncrement: 0.03,        // speed increase per sorted item
            maxFallSpeed: 6,
            spawnInterval: 1800,         // ms between spawns
            minSpawnInterval: 800,       // minimum spawn interval
            lang: 'zh'
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ============================================================
        // i18n
        // ============================================================
        const TEXTS = {
            header_subtitle: { zh: '分类挑战', en: 'Sorting Challenge', nl: 'Sorteeruitdaging' },
            header_title: { zh: '厨房整理', en: 'Kitchen Sort', nl: 'Keuken Sorteren' },
            progress_label: { zh: '{current} / {total}', en: '{current} / {total}', nl: '{current} / {total}' },
            accuracy_label: { zh: '正确率: {value}%', en: 'Accuracy: {value}%', nl: 'Nauwkeurigheid: {value}%' },
            intro_title: { zh: '厨房分类挑战', en: 'Kitchen Sort Challenge', nl: 'Keuken Sorteeruitdaging' },
            intro_desc: {
                zh: '食物会从上方掉落。请快速判断它应该放进<strong class="text-blue-600">🧊 冰箱</strong>还是<strong class="text-amber-700">🗄️ 橱柜</strong>！',
                en: 'Food items will fall from above. Quickly decide: does it go in the <strong class="text-blue-600">🧊 Fridge</strong> or the <strong class="text-amber-700">🗄️ Pantry</strong>?',
                nl: 'Voedsel valt van boven. Beslis snel: gaat het in de <strong class="text-blue-600">🧊 Koelkast</strong> of de <strong class="text-amber-700">🗄️ Voorraadkast</strong>?'
            },
            intro_rule: {
                zh: '需要冷藏的食物 → <strong>左边（冰箱）</strong><br>常温保存的食物 → <strong>右边（橱柜）</strong>',
                en: 'Items that need refrigeration → <strong>Left (Fridge)</strong><br>Shelf-stable items → <strong>Right (Pantry)</strong>',
                nl: 'Producten die gekoeld moeten worden → <strong>Links (Koelkast)</strong><br>Houdbare producten → <strong>Rechts (Voorraadkast)</strong>'
            },
            intro_controls: {
                zh: '⌨️ 按 <strong>← / A</strong> 放入冰箱，<strong>→ / D</strong> 放入橱柜<br>也可以点击底部按钮',
                en: '⌨️ Press <strong>← / A</strong> for Fridge, <strong>→ / D</strong> for Pantry<br>Or tap the buttons below',
                nl: '⌨️ Druk <strong>← / A</strong> voor Koelkast, <strong>→ / D</strong> voor Voorraadkast<br>Of tik op de knoppen'
            },
            intro_examples_cold: {
                zh: '冰箱示例：',
                en: 'Fridge examples:',
                nl: 'Koelkast voorbeelden:'
            },
            intro_examples_warm: {
                zh: '橱柜示例：',
                en: 'Pantry examples:',
                nl: 'Voorraadkast voorbeelden:'
            },
            start_button: { zh: '开始分类', en: 'Start Sorting', nl: 'Start Sorteren' },
            fridge_label: { zh: '🧊 冰箱', en: '🧊 Fridge', nl: '🧊 Koelkast' },
            pantry_label: { zh: '🗄️ 橱柜', en: '🗄️ Pantry', nl: '🗄️ Voorraadkast' },
            perf_excellent: { zh: '非常出色！', en: 'Excellent!', nl: 'Uitstekend!' },
            perf_good: { zh: '表现不错！', en: 'Well done!', nl: 'Goed gedaan!' },
            perf_practice: { zh: '继续加油！', en: 'Keep practicing!', nl: 'Blijf oefenen!' },
            task_complete: { zh: '厨房分类完成', en: 'Kitchen Sort Complete', nl: 'Keuken Sorteren Voltooid' },
            total_accuracy: { zh: '总正确率', en: 'Total Accuracy', nl: 'Totale Nauwkeurigheid' },
            avg_rt: { zh: '平均反应时', en: 'Avg Response Time', nl: 'Gem. Reactietijd' },
            sorted_label: { zh: '已分类', en: 'Sorted', nl: 'Gesorteerd' },
            errors_label: { zh: '错误', en: 'Errors', nl: 'Fouten' },
            missed_label: { zh: '遗漏', en: 'Missed', nl: 'Gemist' },
            speed_label: { zh: '最终速度', en: 'Final Speed', nl: 'Eindsnelheid' },
            finish_button: { zh: '完成', en: 'Finish', nl: 'Voltooien' },
            get_ready: { zh: '准备好了吗？', en: 'Get ready!', nl: 'Maak je klaar!' }
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
        const phase = ref('intro');          // 'intro' | 'playing' | 'feedback'
        const score = ref(0);
        const errors = ref(0);
        const missed = ref(0);
        const itemsSorted = ref(0);
        const currentFallSpeed = ref(0);
        const currentSpawnInterval = ref(0);

        // Active falling item
        const activeItem = ref(null);        // { ...KITCHEN_ITEMS[x], x, y, id }
        const flashResult = ref(null);       // 'correct' | 'wrong' | null
        const flashSide = ref(null);         // 'left' | 'right' | null

        // Results log
        const results = ref([]);             // { item, choice, correct, rt }
        const gameStartTime = ref(0);
        const itemSpawnTime = ref(0);

        // Game area dimensions (measured from DOM)
        const gameAreaRef = ref(null);
        const gameAreaHeight = ref(400);
        const gameAreaWidth = ref(300);

        // Animation & timers
        let animFrameId = null;
        let spawnTimerId = null;
        let flashTimerId = null;
        let waitingForNext = false;

        // Item queue
        const itemQueue = ref([]);

        // ============================================================
        // Computed
        // ============================================================
        const accuracy = computed(() => {
            const total = itemsSorted.value + missed.value;
            if (total === 0) return 0;
            return Math.round((score.value / total) * 100);
        });

        const progressPercent = computed(() => {
            const total = itemsSorted.value + missed.value;
            return Math.round((total / config.value.totalItems) * 100);
        });

        const avgResponseTime = computed(() => {
            const responded = results.value.filter(r => r.rt !== null);
            if (responded.length === 0) return 0;
            return Math.round(responded.reduce((sum, r) => sum + r.rt, 0) / responded.length);
        });

        const performanceLevel = computed(() => {
            if (accuracy.value >= 80) return 'excellent';
            if (accuracy.value >= 60) return 'good';
            return 'needsPractice';
        });

        const totalProcessed = computed(() => itemsSorted.value + missed.value);

        // ============================================================
        // Item queue generation
        // ============================================================
        const generateQueue = () => {
            const total = config.value.totalItems;
            const queue = [];
            for (let i = 0; i < total; i++) {
                const item = KITCHEN_ITEMS[Math.floor(Math.random() * KITCHEN_ITEMS.length)];
                queue.push({ ...item, id: i });
            }
            return queue;
        };

        // ============================================================
        // Game area measurement
        // ============================================================
        const measureGameArea = () => {
            if (gameAreaRef.value) {
                gameAreaHeight.value = gameAreaRef.value.clientHeight;
                gameAreaWidth.value = gameAreaRef.value.clientWidth;
            }
        };

        // ============================================================
        // Spawn & animation
        // ============================================================
        const spawnNext = () => {
            if (phase.value !== 'playing') return;
            if (totalProcessed.value >= config.value.totalItems) {
                endGame();
                return;
            }
            if (itemQueue.value.length === 0) {
                endGame();
                return;
            }

            waitingForNext = false;
            const next = itemQueue.value.shift();
            const margin = 60;
            const maxX = Math.max(gameAreaWidth.value - margin, margin);
            next.x = margin + Math.random() * (maxX - margin);
            next.y = -60;
            activeItem.value = next;
            itemSpawnTime.value = performance.now();
        };

        const animate = () => {
            if (phase.value !== 'playing') return;

            if (activeItem.value && !waitingForNext) {
                activeItem.value.y += currentFallSpeed.value;

                // Item reached bottom — missed
                if (activeItem.value.y >= gameAreaHeight.value - 20) {
                    handleMiss();
                }
            }

            animFrameId = requestAnimationFrame(animate);
        };

        const handleMiss = () => {
            if (!activeItem.value) return;
            const item = activeItem.value;

            missed.value++;
            results.value.push({
                item: { emoji: item.emoji, name: item.name, category: item.category },
                choice: null,
                correct: false,
                rt: null
            });

            showFlash('wrong', null);
            scheduleNext();
        };

        const scheduleNext = () => {
            activeItem.value = null;
            waitingForNext = true;

            if (totalProcessed.value >= config.value.totalItems) {
                // Small delay then end
                spawnTimerId = setTimeout(() => endGame(), 400);
                return;
            }

            spawnTimerId = setTimeout(() => {
                spawnNext();
            }, Math.max(currentSpawnInterval.value * 0.4, 300));
        };

        // ============================================================
        // Sorting logic
        // ============================================================
        const sortItem = (direction) => {
            // direction: 'left' (cold/fridge) or 'right' (warm/pantry)
            if (phase.value !== 'playing' || !activeItem.value || waitingForNext) return;

            const item = activeItem.value;
            const rt = Math.round(performance.now() - itemSpawnTime.value);
            const expectedDir = item.category === 'cold' ? 'left' : 'right';
            const correct = direction === expectedDir;

            if (correct) {
                score.value++;
            } else {
                errors.value++;
            }
            itemsSorted.value++;

            results.value.push({
                item: { emoji: item.emoji, name: item.name, category: item.category },
                choice: direction,
                correct,
                rt
            });

            // Increase speed
            currentFallSpeed.value = Math.min(
                currentFallSpeed.value + config.value.speedIncrement,
                config.value.maxFallSpeed
            );
            // Decrease spawn interval slightly
            const intervalReduction = (config.value.spawnInterval - config.value.minSpawnInterval) / config.value.totalItems;
            currentSpawnInterval.value = Math.max(
                currentSpawnInterval.value - intervalReduction,
                config.value.minSpawnInterval
            );

            showFlash(correct ? 'correct' : 'wrong', direction);
            scheduleNext();
        };

        // ============================================================
        // Flash feedback
        // ============================================================
        const showFlash = (result, side) => {
            flashResult.value = result;
            flashSide.value = side;
            clearTimeout(flashTimerId);
            flashTimerId = setTimeout(() => {
                flashResult.value = null;
                flashSide.value = null;
            }, 350);
        };

        // ============================================================
        // Keyboard handler
        // ============================================================
        const onKeyDown = (e) => {
            if (phase.value === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                startGame();
                return;
            }
            if (phase.value !== 'playing') return;

            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                sortItem('left');
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                sortItem('right');
            }
        };

        // ============================================================
        // Game control
        // ============================================================
        const startGame = () => {
            phase.value = 'playing';
            score.value = 0;
            errors.value = 0;
            missed.value = 0;
            itemsSorted.value = 0;
            results.value = [];
            activeItem.value = null;
            flashResult.value = null;
            flashSide.value = null;
            waitingForNext = false;
            currentFallSpeed.value = config.value.initialFallSpeed;
            currentSpawnInterval.value = config.value.spawnInterval;
            itemQueue.value = generateQueue();
            gameStartTime.value = performance.now();

            nextTick(() => {
                measureGameArea();
                spawnNext();
                animFrameId = requestAnimationFrame(animate);
            });
        };

        const endGame = () => {
            phase.value = 'feedback';
            cancelAnimationFrame(animFrameId);
            clearTimeout(spawnTimerId);
            clearTimeout(flashTimerId);
            animFrameId = null;
            activeItem.value = null;
        };

        const finishGame = () => {
            cancelAnimationFrame(animFrameId);
            clearTimeout(spawnTimerId);
            clearTimeout(flashTimerId);

            emit('complete', {
                success: accuracy.value >= 60,
                totalItems: config.value.totalItems,
                sorted: itemsSorted.value,
                correct: score.value,
                errors: errors.value,
                missed: missed.value,
                accuracy: accuracy.value,
                avgResponseTime: avgResponseTime.value,
                finalSpeed: Math.round(currentFallSpeed.value * 100) / 100,
                totalTime: Math.round(performance.now() - gameStartTime.value),
                trials: results.value
            });
        };

        // ============================================================
        // Lifecycle
        // ============================================================
        onMounted(() => {
            window.addEventListener('keydown', onKeyDown);
            if (window.lucide) window.lucide.createIcons();
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', onKeyDown);
            cancelAnimationFrame(animFrameId);
            clearTimeout(spawnTimerId);
            clearTimeout(flashTimerId);
        });

        return {
            config, phase, score, errors, missed, itemsSorted,
            activeItem, flashResult, flashSide,
            accuracy, progressPercent, avgResponseTime, performanceLevel, totalProcessed,
            currentFallSpeed,
            gameAreaRef,
            startGame, sortItem, finishGame,
            t, lang
        };
    },

    // ============================================================
    // Template
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-amber-50 to-orange-50 select-none">

        <!-- Header with progress -->
        <div class="bg-white/90 backdrop-blur p-4 border-b border-amber-200 shrink-0">
            <div class="flex items-center gap-3">
                <div class="bg-amber-100 p-2.5 rounded-xl">
                    <span class="text-2xl">🍳</span>
                </div>
                <div>
                    <span class="text-amber-600 font-bold text-xs uppercase tracking-wider">{{ t('header_subtitle') }}</span>
                    <h2 class="text-lg font-black text-slate-800">{{ t('header_title') }}</h2>
                </div>
                <div v-if="phase === 'playing'" class="ml-auto text-right">
                    <div class="text-sm font-bold text-slate-700">{{ score }} ✓</div>
                    <div class="text-xs text-slate-400">{{ t('accuracy_label', { value: accuracy }) }}</div>
                </div>
            </div>

            <!-- Progress bar (playing phase) -->
            <div v-if="phase === 'playing'" class="mt-2.5">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-amber-500 transition-all duration-300"
                         :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{{ t('progress_label', { current: totalProcessed, total: config.totalItems }) }}</span>
                </div>
            </div>
        </div>

        <!-- =============== INTRO =============== -->
        <div v-if="phase === 'intro'" class="flex-grow p-5 overflow-y-auto flex items-center justify-center">
            <div class="text-center max-w-md">
                <div class="text-6xl mb-3">🍳</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('intro_title') }}</h3>

                <div class="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm text-left mb-5 space-y-3">
                    <p class="text-slate-600 leading-relaxed" v-html="t('intro_desc')"></p>

                    <div class="bg-amber-50 rounded-xl p-4 space-y-2">
                        <p class="text-sm text-slate-600" v-html="t('intro_rule')"></p>
                    </div>

                    <!-- Examples -->
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-blue-50 rounded-xl p-3">
                            <p class="text-xs font-bold text-blue-700 mb-1">{{ t('intro_examples_cold') }}</p>
                            <div class="flex flex-wrap gap-1 text-xl">
                                <span>🥛</span><span>🧀</span><span>🥚</span><span>🍖</span>
                            </div>
                        </div>
                        <div class="bg-orange-50 rounded-xl p-3">
                            <p class="text-xs font-bold text-amber-700 mb-1">{{ t('intro_examples_warm') }}</p>
                            <div class="flex flex-wrap gap-1 text-xl">
                                <span>🍚</span><span>🍝</span><span>🥫</span><span>🍞</span>
                            </div>
                        </div>
                    </div>

                    <p class="text-slate-500 text-sm" v-html="t('intro_controls')"></p>
                </div>

                <button @click="startGame"
                    class="bg-amber-500 hover:bg-amber-600 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('start_button') }}
                </button>
            </div>
        </div>

        <!-- =============== PLAYING =============== -->
        <template v-if="phase === 'playing'">
            <!-- Game area -->
            <div ref="gameAreaRef" class="flex-grow relative overflow-hidden">

                <!-- Flash overlays -->
                <div v-if="flashResult === 'correct'"
                     class="absolute inset-0 bg-green-400/15 pointer-events-none z-10 transition-opacity"></div>
                <div v-if="flashResult === 'wrong'"
                     class="absolute inset-0 bg-red-400/15 pointer-events-none z-10 transition-opacity"></div>

                <!-- Zone hint backgrounds -->
                <div class="absolute inset-y-0 left-0 w-1/2 border-r border-dashed border-amber-300/50
                            flex items-end justify-center pb-3">
                    <span class="text-xs text-blue-400/60 font-bold">← {{ t('fridge_label') }}</span>
                </div>
                <div class="absolute inset-y-0 right-0 w-1/2
                            flex items-end justify-center pb-3">
                    <span class="text-xs text-amber-400/60 font-bold">{{ t('pantry_label') }} →</span>
                </div>

                <!-- Falling item -->
                <div v-if="activeItem"
                     class="absolute z-20 transition-none"
                     :style="{ left: activeItem.x + 'px', top: activeItem.y + 'px' }">
                    <div class="w-16 h-16 bg-white rounded-2xl shadow-lg border-2 border-amber-200
                                flex flex-col items-center justify-center">
                        <span class="text-3xl leading-none">{{ activeItem.emoji }}</span>
                        <span class="text-[10px] text-slate-500 mt-0.5 leading-none">{{ activeItem.name[lang] }}</span>
                    </div>
                </div>

                <!-- Flash result indicator -->
                <div v-if="flashResult" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                    <div class="text-5xl animate-ping"
                         :class="flashResult === 'correct' ? 'text-green-500' : 'text-red-500'">
                        {{ flashResult === 'correct' ? '✓' : '✗' }}
                    </div>
                </div>
            </div>

            <!-- Sort buttons -->
            <div class="bg-white/95 backdrop-blur border-t border-amber-200 shrink-0 p-3">
                <div class="flex gap-3">
                    <button @click="sortItem('left')"
                        class="flex-1 py-4 rounded-xl font-black text-lg transition-all
                               bg-blue-500 hover:bg-blue-600 text-white
                               shadow-[0_4px_0_#1d4ed8] active:shadow-none active:translate-y-[4px]"
                        :class="{ 'ring-4 ring-blue-300': flashSide === 'left' && flashResult === 'correct',
                                  'ring-4 ring-red-300': flashSide === 'left' && flashResult === 'wrong' }">
                        ← {{ t('fridge_label') }}
                    </button>
                    <button @click="sortItem('right')"
                        class="flex-1 py-4 rounded-xl font-black text-lg transition-all
                               bg-amber-500 hover:bg-amber-600 text-white
                               shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-[4px]"
                        :class="{ 'ring-4 ring-green-300': flashSide === 'right' && flashResult === 'correct',
                                  'ring-4 ring-red-300': flashSide === 'right' && flashResult === 'wrong' }">
                        {{ t('pantry_label') }} →
                    </button>
                </div>
            </div>
        </template>

        <!-- =============== FEEDBACK =============== -->
        <div v-if="phase === 'feedback'" class="flex-grow p-5 overflow-y-auto flex items-center justify-center">
            <div class="text-center max-w-md w-full">
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

                <!-- Stats cards -->
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-amber-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-amber-700">{{ accuracy }}%</div>
                            <div class="text-xs text-amber-500 font-bold">{{ t('total_accuracy') }}</div>
                        </div>
                        <div class="bg-blue-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-blue-700">{{ avgResponseTime }}ms</div>
                            <div class="text-xs text-blue-500 font-bold">{{ t('avg_rt') }}</div>
                        </div>
                        <div class="bg-green-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-green-700">{{ score }}</div>
                            <div class="text-xs text-green-500 font-bold">{{ t('sorted_label') }}</div>
                        </div>
                        <div class="bg-red-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-red-700">{{ errors + missed }}</div>
                            <div class="text-xs text-red-500 font-bold">{{ t('errors_label') }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom bar (feedback) -->
        <div v-if="phase === 'feedback'"
             class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            <button @click="finishGame"
                class="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                {{ t('finish_button') }}
            </button>
        </div>
    </div>
    `
};

window.KitchenSortGame = KitchenSortGame;
