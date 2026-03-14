/**
 * Office Sort Game — 连续分拣小游戏
 * 办公/邮件主题：将下落的物品快速分为"紧急"（左）或"普通"（右）
 *
 * 速度随时间递增，追踪准确率、反应时间等指标
 */
const OfficeSortGame = {
    name: 'OfficeSortGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted, nextTick } = Vue;

        // ============================================================
        // Item Pool
        // ============================================================
        const ITEMS = [
            // URGENT (left)
            { emoji: '🔴', name: { zh: '紧急报告', en: 'Urgent Report', nl: 'Dringend Rapport' }, category: 'urgent' },
            { emoji: '📞', name: { zh: '未接来电', en: 'Missed Call', nl: 'Gemiste Oproep' }, category: 'urgent' },
            { emoji: '⚠️', name: { zh: '系统警告', en: 'System Alert', nl: 'Systeemwaarschuwing' }, category: 'urgent' },
            { emoji: '💊', name: { zh: '用药提醒', en: 'Medicine Reminder', nl: 'Medicijnherinnering' }, category: 'urgent' },
            { emoji: '🏥', name: { zh: '医生预约', en: 'Doctor Appt', nl: 'Doktersafspraak' }, category: 'urgent' },
            { emoji: '📋', name: { zh: '截止今天', en: 'Due Today', nl: 'Vandaag Deadline' }, category: 'urgent' },
            { emoji: '🔑', name: { zh: '忘带钥匙', en: 'Forgot Keys', nl: 'Sleutels Vergeten' }, category: 'urgent' },
            { emoji: '💰', name: { zh: '账单到期', en: 'Bill Due', nl: 'Rekening Vervalt' }, category: 'urgent' },
            { emoji: '🚨', name: { zh: '安全通知', en: 'Security Notice', nl: 'Veiligheidsmelding' }, category: 'urgent' },
            { emoji: '✈️', name: { zh: '航班变更', en: 'Flight Change', nl: 'Vluchtwijziging' }, category: 'urgent' },
            // NORMAL (right)
            { emoji: '📰', name: { zh: '新闻简报', en: 'Newsletter', nl: 'Nieuwsbrief' }, category: 'normal' },
            { emoji: '🎂', name: { zh: '生日祝福', en: 'Birthday Wishes', nl: 'Verjaardagswensen' }, category: 'normal' },
            { emoji: '📊', name: { zh: '周报总结', en: 'Weekly Summary', nl: 'Weekoverzicht' }, category: 'normal' },
            { emoji: '🛒', name: { zh: '促销通知', en: 'Sale Notice', nl: 'Aanbiedingsmelding' }, category: 'normal' },
            { emoji: '📸', name: { zh: '照片分享', en: 'Photo Share', nl: 'Foto Delen' }, category: 'normal' },
            { emoji: '🎵', name: { zh: '音乐推荐', en: 'Music Rec.', nl: 'Muziekaanbeveling' }, category: 'normal' },
            { emoji: '📅', name: { zh: '社区活动', en: 'Community Event', nl: 'Buurtactiviteit' }, category: 'normal' },
            { emoji: '🌤️', name: { zh: '天气预报', en: 'Weather Update', nl: 'Weerbericht' }, category: 'normal' },
            { emoji: '📖', name: { zh: '阅读推荐', en: 'Reading Rec.', nl: 'Leesaanbeveling' }, category: 'normal' },
            { emoji: '🎉', name: { zh: '节日问候', en: 'Holiday Greeting', nl: 'Feestdagengroet' }, category: 'normal' },
        ];

        // ============================================================
        // Configuration
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
            header_subtitle: { zh: '分拣训练', en: 'Sorting Training', nl: 'Sorteertraining' },
            header_title: { zh: '办公信件分拣', en: 'Office Mail Sort', nl: 'Kantoorpost Sorteren' },
            progress_label: { zh: '已分拣 {current} / {total}', en: 'Sorted {current} / {total}', nl: 'Gesorteerd {current} / {total}' },
            accuracy_label: { zh: '正确率: {value}%', en: 'Accuracy: {value}%', nl: 'Nauwkeurigheid: {value}%' },
            intro_title: { zh: '📬 办公信件分拣', en: '📬 Office Mail Sort', nl: '📬 Kantoorpost Sorteren' },
            intro_desc: {
                zh: '信件从上方落下，请根据类型快速分拣：<br/><strong class="text-red-600">📥 紧急</strong>物品 → 按<strong>左键</strong><br/><strong class="text-blue-600">📤 普通</strong>物品 → 按<strong>右键</strong>',
                en: 'Items fall from the top. Sort them quickly:<br/><strong class="text-red-600">📥 Urgent</strong> items → press <strong>Left</strong><br/><strong class="text-blue-600">📤 Normal</strong> items → press <strong>Right</strong>',
                nl: 'Items vallen van boven. Sorteer ze snel:<br/><strong class="text-red-600">📥 Dringend</strong> items → druk <strong>Links</strong><br/><strong class="text-blue-600">📤 Normaal</strong> items → druk <strong>Rechts</strong>'
            },
            intro_controls: {
                zh: '⌨️ 键盘: ← / → 或 A / D　　🖱️ 也可点击底部按钮',
                en: '⌨️ Keyboard: ← / → or A / D　　🖱️ Or click the buttons below',
                nl: '⌨️ Toetsenbord: ← / → of A / D　　🖱️ Of klik op de knoppen'
            },
            intro_example_urgent: { zh: '紧急示例：', en: 'Urgent examples:', nl: 'Dringend voorbeelden:' },
            intro_example_normal: { zh: '普通示例：', en: 'Normal examples:', nl: 'Normaal voorbeelden:' },
            start_button: { zh: '开始分拣', en: 'Start Sorting', nl: 'Begin Sorteren' },
            zone_urgent: { zh: '📥 紧急', en: '📥 Urgent', nl: '📥 Dringend' },
            zone_normal: { zh: '📤 普通', en: '📤 Normal', nl: '📤 Normaal' },
            perf_excellent: { zh: '非常出色！', en: 'Excellent!', nl: 'Uitstekend!' },
            perf_good: { zh: '表现不错！', en: 'Well done!', nl: 'Goed gedaan!' },
            perf_practice: { zh: '继续加油！', en: 'Keep practicing!', nl: 'Blijf oefenen!' },
            task_complete: { zh: '分拣任务完成', en: 'Sorting Complete', nl: 'Sorteren Voltooid' },
            total_accuracy: { zh: '总正确率', en: 'Total Accuracy', nl: 'Totale Nauwkeurigheid' },
            avg_rt: { zh: '平均反应时', en: 'Avg Response Time', nl: 'Gem. Reactietijd' },
            total_sorted: { zh: '成功分拣', en: 'Sorted Correctly', nl: 'Correct Gesorteerd' },
            total_errors: { zh: '错误数', en: 'Errors', nl: 'Fouten' },
            finish_button: { zh: '完成', en: 'Finish', nl: 'Voltooien' },
            missed_label: { zh: '漏接', en: 'Missed', nl: 'Gemist' },
            speed_label: { zh: '速度', en: 'Speed', nl: 'Snelheid' },
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
        const itemQueue = ref([]);            // pre-generated item sequence
        const currentItemIndex = ref(0);      // index into itemQueue
        const activeItem = ref(null);         // { ...item, x, y, spawnTime }
        const fallingY = ref(0);              // current y position (0–100 %)
        const flashResult = ref(null);        // 'correct' | 'wrong' | null
        const sortedCount = ref(0);
        const errorCount = ref(0);
        const missedCount = ref(0);
        const currentSpeed = ref(0);
        const itemResults = ref([]);          // per-item log

        let animFrameId = null;
        let spawnTimerId = null;
        let flashTimerId = null;
        let lastFrameTime = 0;
        let gameStartTime = 0;
        let itemSpawnTime = 0;

        // ============================================================
        // Sequence Generation
        // ============================================================
        const generateQueue = () => {
            const total = config.value.totalItems;
            const queue = [];
            for (let i = 0; i < total; i++) {
                const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
                queue.push({
                    ...item,
                    x: 15 + Math.random() * 70  // 15%–85% horizontal
                });
            }
            return queue;
        };

        // ============================================================
        // Computed
        // ============================================================
        const accuracy = computed(() => {
            const total = sortedCount.value + errorCount.value + missedCount.value;
            if (total === 0) return 0;
            return Math.round((sortedCount.value / total) * 100);
        });

        const avgResponseTime = computed(() => {
            const responded = itemResults.value.filter(r => r.rt !== null);
            if (responded.length === 0) return 0;
            return Math.round(responded.reduce((s, r) => s + r.rt, 0) / responded.length);
        });

        const progressPercent = computed(() => {
            const total = config.value.totalItems;
            const done = sortedCount.value + errorCount.value + missedCount.value;
            return Math.round((done / total) * 100);
        });

        const performanceLevel = computed(() => {
            if (accuracy.value >= 80) return 'excellent';
            if (accuracy.value >= 60) return 'good';
            return 'needsPractice';
        });

        const itemName = computed(() => {
            if (!activeItem.value) return '';
            return activeItem.value.name[lang.value] || activeItem.value.name.en;
        });

        // ============================================================
        // Game Control
        // ============================================================
        const startGame = () => {
            itemQueue.value = generateQueue();
            currentItemIndex.value = 0;
            sortedCount.value = 0;
            errorCount.value = 0;
            missedCount.value = 0;
            itemResults.value = [];
            currentSpeed.value = config.value.initialFallSpeed;
            gameStartTime = performance.now();
            phase.value = 'playing';
            nextTick(() => {
                spawnNextItem();
            });
        };

        const spawnNextItem = () => {
            if (currentItemIndex.value >= itemQueue.value.length) {
                endGame();
                return;
            }
            const item = itemQueue.value[currentItemIndex.value];
            activeItem.value = { ...item };
            fallingY.value = 0;
            itemSpawnTime = performance.now();
            lastFrameTime = itemSpawnTime;
            startFalling();
        };

        const startFalling = () => {
            cancelAnimationFrame(animFrameId);
            const tick = (now) => {
                if (phase.value !== 'playing' || !activeItem.value) return;
                const dt = (now - lastFrameTime) / 1000; // seconds
                lastFrameTime = now;
                fallingY.value += currentSpeed.value * dt * 100 / 6;
                // Item reached bottom → missed
                if (fallingY.value >= 100) {
                    handleMiss();
                    return;
                }
                animFrameId = requestAnimationFrame(tick);
            };
            animFrameId = requestAnimationFrame(tick);
        };

        const handleSort = (direction) => {
            if (phase.value !== 'playing' || !activeItem.value) return;
            cancelAnimationFrame(animFrameId);

            const item = activeItem.value;
            const rt = Math.round(performance.now() - itemSpawnTime);
            const expectedDirection = item.category === 'urgent' ? 'left' : 'right';
            const correct = direction === expectedDirection;

            if (correct) {
                sortedCount.value++;
                showFlash('correct');
            } else {
                errorCount.value++;
                showFlash('wrong');
            }

            itemResults.value.push({
                index: currentItemIndex.value,
                emoji: item.emoji,
                category: item.category,
                response: direction,
                correct,
                rt
            });

            activeItem.value = null;
            currentItemIndex.value++;
            advanceSpeed();
            scheduleNextSpawn();
        };

        const handleMiss = () => {
            cancelAnimationFrame(animFrameId);
            missedCount.value++;
            showFlash('wrong');

            itemResults.value.push({
                index: currentItemIndex.value,
                emoji: activeItem.value.emoji,
                category: activeItem.value.category,
                response: null,
                correct: false,
                rt: null
            });

            activeItem.value = null;
            currentItemIndex.value++;
            advanceSpeed();
            scheduleNextSpawn();
        };

        const advanceSpeed = () => {
            const { speedIncrement, maxFallSpeed } = config.value;
            currentSpeed.value = Math.min(currentSpeed.value + speedIncrement, maxFallSpeed);
        };

        const scheduleNextSpawn = () => {
            clearTimeout(spawnTimerId);
            if (currentItemIndex.value >= itemQueue.value.length) {
                endGame();
                return;
            }
            // Decrease interval proportionally with speed
            const ratio = (currentSpeed.value - config.value.initialFallSpeed) /
                          (config.value.maxFallSpeed - config.value.initialFallSpeed);
            const interval = config.value.spawnInterval -
                             ratio * (config.value.spawnInterval - config.value.minSpawnInterval);
            spawnTimerId = setTimeout(() => spawnNextItem(), Math.max(interval, config.value.minSpawnInterval));
        };

        const showFlash = (type) => {
            flashResult.value = type;
            clearTimeout(flashTimerId);
            flashTimerId = setTimeout(() => { flashResult.value = null; }, 350);
        };

        const endGame = () => {
            cancelAnimationFrame(animFrameId);
            clearTimeout(spawnTimerId);
            clearTimeout(flashTimerId);
            activeItem.value = null;
            phase.value = 'feedback';
        };

        const finishGame = () => {
            emit('complete', {
                success: accuracy.value >= 60,
                totalItems: config.value.totalItems,
                accuracy: accuracy.value,
                avgResponseTime: avgResponseTime.value,
                totalTime: Math.round(performance.now() - gameStartTime),
                errors: errorCount.value,
                missed: missedCount.value,
                sorted: sortedCount.value,
                items: itemResults.value
            });
        };

        // ============================================================
        // Keyboard
        // ============================================================
        const onKeyDown = (e) => {
            if (phase.value !== 'playing') return;
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                handleSort('left');
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                handleSort('right');
            }
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
            config, phase, activeItem, fallingY, flashResult,
            sortedCount, errorCount, missedCount, currentSpeed,
            itemResults, accuracy, avgResponseTime, progressPercent,
            performanceLevel, itemName, lang,
            startGame, handleSort, finishGame, t
        };
    },

    // ============================================================
    // Template
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-blue-50 to-slate-50">

        <!-- Header -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-blue-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-blue-100 p-3 rounded-xl">
                    <span class="text-3xl">📬</span>
                </div>
                <div>
                    <span class="text-blue-600 font-bold text-sm uppercase tracking-wider">{{ t('header_subtitle') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ t('header_title') }}</h2>
                </div>
            </div>

            <!-- Progress bar (playing) -->
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 transition-all duration-300"
                         :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{{ t('progress_label', { current: sortedCount + errorCount + missedCount, total: config.totalItems }) }}</span>
                    <span>{{ t('accuracy_label', { value: accuracy }) }}</span>
                </div>
            </div>
        </div>

        <!-- Main area -->
        <div class="flex-grow relative overflow-hidden">

            <!-- =============== INTRO =============== -->
            <div v-if="phase === 'intro'" class="absolute inset-0 flex items-center justify-center p-6">
                <div class="text-center max-w-md">
                    <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('intro_title') }}</h3>
                    <div class="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm text-left mb-6 space-y-4">
                        <p class="text-slate-600 leading-relaxed" v-html="t('intro_desc')"></p>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-red-50 rounded-xl p-3">
                                <p class="text-xs font-bold text-red-600 mb-2">{{ t('intro_example_urgent') }}</p>
                                <div class="flex flex-wrap gap-1">
                                    <span class="text-xl" title="Urgent">🔴</span>
                                    <span class="text-xl" title="Urgent">📞</span>
                                    <span class="text-xl" title="Urgent">⚠️</span>
                                    <span class="text-xl" title="Urgent">💊</span>
                                </div>
                            </div>
                            <div class="bg-blue-50 rounded-xl p-3">
                                <p class="text-xs font-bold text-blue-600 mb-2">{{ t('intro_example_normal') }}</p>
                                <div class="flex flex-wrap gap-1">
                                    <span class="text-xl" title="Normal">📰</span>
                                    <span class="text-xl" title="Normal">🎂</span>
                                    <span class="text-xl" title="Normal">🎵</span>
                                    <span class="text-xl" title="Normal">🌤️</span>
                                </div>
                            </div>
                        </div>

                        <p class="text-slate-500 text-sm">{{ t('intro_controls') }}</p>
                    </div>
                    <button @click="startGame"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                               shadow-[0_4px_0_#1e40af] active:shadow-none active:translate-y-[4px] transition-all">
                        {{ t('start_button') }}
                    </button>
                </div>
            </div>

            <!-- =============== PLAYING =============== -->
            <template v-if="phase === 'playing'">
                <!-- Flash overlay -->
                <div v-if="flashResult"
                     class="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200"
                     :class="flashResult === 'correct'
                         ? 'bg-green-400/20'
                         : 'bg-red-400/20'">
                </div>

                <!-- Falling item -->
                <div v-if="activeItem"
                     class="absolute z-20 transition-none"
                     :style="{
                         left: activeItem.x + '%',
                         top: fallingY + '%',
                         transform: 'translate(-50%, -50%)'
                     }">
                    <div class="bg-white rounded-2xl shadow-lg border-2 px-4 py-3 flex flex-col items-center gap-1 min-w-[80px]"
                         :class="activeItem.category === 'urgent'
                             ? 'border-red-300'
                             : 'border-blue-300'">
                        <span class="text-4xl select-none">{{ activeItem.emoji }}</span>
                        <span class="text-xs font-bold text-slate-600 whitespace-nowrap">{{ itemName }}</span>
                    </div>
                </div>

                <!-- Zone indicators at bottom -->
                <div class="absolute bottom-0 left-0 right-0 flex pointer-events-none z-0">
                    <div class="flex-1 h-20 bg-gradient-to-t from-red-100/80 to-transparent flex items-end justify-center pb-2">
                        <span class="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                            ← {{ t('zone_urgent') }}
                        </span>
                    </div>
                    <div class="flex-1 h-20 bg-gradient-to-t from-blue-100/80 to-transparent flex items-end justify-center pb-2">
                        <span class="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            {{ t('zone_normal') }} →
                        </span>
                    </div>
                </div>
            </template>

            <!-- =============== FEEDBACK =============== -->
            <div v-if="phase === 'feedback'" class="absolute inset-0 flex items-center justify-center p-6">
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

                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-blue-50 rounded-xl p-3">
                                <div class="text-3xl font-black text-blue-700">{{ accuracy }}%</div>
                                <div class="text-xs text-blue-500 font-bold">{{ t('total_accuracy') }}</div>
                            </div>
                            <div class="bg-slate-50 rounded-xl p-3">
                                <div class="text-3xl font-black text-slate-700">{{ avgResponseTime }}ms</div>
                                <div class="text-xs text-slate-500 font-bold">{{ t('avg_rt') }}</div>
                            </div>
                            <div class="bg-green-50 rounded-xl p-3">
                                <div class="text-2xl font-black text-green-700">{{ sortedCount }}</div>
                                <div class="text-xs text-green-500 font-bold">{{ t('total_sorted') }}</div>
                            </div>
                            <div class="bg-red-50 rounded-xl p-3">
                                <div class="text-2xl font-black text-red-700">{{ errorCount + missedCount }}</div>
                                <div class="text-xs text-red-500 font-bold">{{ t('total_errors') }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom bar -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            <!-- Playing: sort buttons -->
            <div v-if="phase === 'playing'" class="flex gap-4 justify-center">
                <button @click="handleSort('left')"
                    class="flex-1 max-w-[200px] bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xl py-5
                           shadow-[0_4px_0_#b91c1c] active:shadow-none active:translate-y-[4px] transition-all
                           flex items-center justify-center gap-2">
                    ← {{ t('zone_urgent') }}
                </button>
                <button @click="handleSort('right')"
                    class="flex-1 max-w-[200px] bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black text-xl py-5
                           shadow-[0_4px_0_#1e40af] active:shadow-none active:translate-y-[4px] transition-all
                           flex items-center justify-center gap-2">
                    {{ t('zone_normal') }} →
                </button>
            </div>

            <!-- Feedback: finish button -->
            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finish_button') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.OfficeSortGame = OfficeSortGame;
