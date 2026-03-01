/**
 * 花园记忆 N-Back 工作记忆任务
 * Garden/nature-themed variant: judge if current flower equals the one N steps ago
 *
 * 默认 2-back，可通过 scenario.nLevel 配置
 * 刺激类型：花卉 / 植物 emoji
 */
const GardenNBackGame = {
    name: 'GardenNBackGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted, watch } = Vue;

        // ============================================================
        // 配置
        // ============================================================
        const defaultScenario = {
            nLevel: 2,
            totalTrials: 20,
            matchRatio: 0.3,
            stimulusDuration: 2500,
            interStimulusInterval: 500,
            stimuli: ['🌹','🌻','🌺','🌸','🌼','🌷','💐','🌿','🍀','☘️','🪻','🌾'],
            lang: 'zh'
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ============================================================
        // i18n
        // ============================================================
        const TEXTS = {
            header_subtitle:   { zh: '工作记忆测试', en: 'Working Memory Test', nl: 'Werkgeheugentest' },
            header_title:      { zh: '花园记忆', en: 'Garden Memory', nl: 'Tuingeheugen' },
            trial_progress:    { zh: '第 {current} / {total} 个', en: 'Trial {current} / {total}', nl: 'Trial {current} / {total}' },
            accuracy_label:    { zh: '正确率: {value}%', en: 'Accuracy: {value}%', nl: 'Nauwkeurigheid: {value}%' },
            intro_title:       { zh: '🌻 花园记忆挑战', en: '🌻 Garden Memory Challenge', nl: '🌻 Tuingeheugen Uitdaging' },
            intro_desc: {
                zh: '花坛中会依次出现不同的<strong class="text-emerald-700">花卉和植物</strong>。请判断当前植物是否与<strong class="text-emerald-700"> {n} 个之前</strong>的植物<strong class="text-emerald-700">相同</strong>。',
                en: 'Different <strong class="text-emerald-700">flowers and plants</strong> will appear in the garden bed one at a time. Determine if the current plant is <strong class="text-emerald-700">the same</strong> as the one <strong class="text-emerald-700">{n} steps ago</strong>.',
                nl: 'Er verschijnen verschillende <strong class="text-emerald-700">bloemen en planten</strong> één voor één in het tuinbed. Bepaal of de huidige plant <strong class="text-emerald-700">dezelfde</strong> is als die van <strong class="text-emerald-700">{n} stappen geleden</strong>.'
            },
            example_label:     { zh: '示例 ({n}-back):', en: 'Example ({n}-back):', nl: 'Voorbeeld ({n}-back):' },
            match_indicator:   { zh: '← 匹配！', en: '← Match!', nl: '← Match!' },
            timing_hint:       { zh: '⏱ 每株植物展示 {duration} 秒，请尽快作答。', en: '⏱ Each plant is shown for {duration} seconds. Respond quickly.', nl: '⏱ Elke plant wordt {duration} seconden getoond. Reageer zo snel mogelijk.' },
            start_button:      { zh: '开始挑战', en: 'Start Challenge', nl: 'Start Uitdaging' },
            remember_hint:     { zh: '请记住这株植物（前 {n} 个无需判断）', en: 'Remember this plant (no response needed for first {n})', nl: 'Onthoud deze plant (geen reactie nodig voor de eerste {n})' },
            match_question:    { zh: '与 {n} 个前的相同吗？', en: 'Same as {n} back?', nl: 'Hetzelfde als {n} terug?' },
            match_button:      { zh: '匹配', en: 'Match', nl: 'Match' },
            no_match_button:   { zh: '不匹配', en: 'No Match', nl: 'Geen Match' },
            perf_excellent:    { zh: '🌟 园艺大师！', en: '🌟 Garden Master!', nl: '🌟 Tuinmeester!' },
            perf_good:         { zh: '🌻 绿手指！', en: '🌻 Green Thumb!', nl: '🌻 Groene Vingers!' },
            perf_practice:     { zh: '🌱 继续浇灌！', en: '🌱 Keep Watering!', nl: '🌱 Blijf Gieten!' },
            task_complete:     { zh: '花园记忆任务完成', en: 'Garden Memory Complete', nl: 'Tuingeheugen Voltooid' },
            total_accuracy:    { zh: '总正确率', en: 'Total Accuracy', nl: 'Totale Nauwkeurigheid' },
            avg_rt:            { zh: '平均反应时', en: 'Avg Response Time', nl: 'Gem. Reactietijd' },
            hits_label:        { zh: '命中 (Hits)', en: 'Hits', nl: 'Hits' },
            false_alarms_label:{ zh: '虚报 (FA)', en: 'False Alarms', nl: 'Vals Alarm' },
            remember_first_n:  { zh: '请先记住前 {n} 株植物', en: 'Remember the first {n} plants', nl: 'Onthoud de eerste {n} planten' },
            answer_instruction:{ zh: '按"匹配"或"不匹配"作答', en: 'Press "Match" or "No Match" to respond', nl: 'Druk op "Match" of "Geen Match" om te reageren' },
            finish_button:     { zh: '完成', en: 'Finish', nl: 'Voltooien' }
        };

        const lang = computed(() => config.value.lang || 'zh');
        const t = (key, params = {}) => {
            let text = TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
            Object.entries(params).forEach(([k, v]) => {
                text = text.replaceAll(`{${k}}`, v);
            });
            return text;
        };

        const N = computed(() => config.value.nLevel);

        // ============================================================
        // 状态
        // ============================================================
        const phase = ref('intro');
        const sequence = ref([]);
        const currentTrialIndex = ref(-1);
        const currentStimulus = ref(null);
        const showingBlank = ref(false);
        const responded = ref(false);
        const trialStartTime = ref(0);

        const results = ref([]);
        const hits = ref(0);
        const misses = ref(0);
        const falseAlarms = ref(0);
        const correctRejections = ref(0);

        let trialTimer = null;
        let blankTimer = null;
        let gameStartTime = 0;
        let isDestroyed = false;

        // ============================================================
        // 序列生成
        // ============================================================
        const generateSequence = () => {
            const { totalTrials, matchRatio, stimuli } = config.value;
            const n = N.value;
            const seq = [];
            const numMatches = Math.round(totalTrials * matchRatio);

            const matchIndices = new Set();
            const candidates = [];
            for (let i = n; i < totalTrials; i++) candidates.push(i);
            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }
            for (let i = 0; i < Math.min(numMatches, candidates.length); i++) {
                matchIndices.add(candidates[i]);
            }

            const getRandomStimulus = () => stimuli[Math.floor(Math.random() * stimuli.length)];

            const getDifferentStimulus = (avoid) => {
                let s;
                let attempts = 0;
                do {
                    s = getRandomStimulus();
                    attempts++;
                } while (s === avoid && attempts < 50);
                return s;
            };

            for (let i = 0; i < n && i < totalTrials; i++) {
                seq.push({ stimulus: getRandomStimulus(), isMatch: false });
            }

            for (let i = n; i < totalTrials; i++) {
                if (matchIndices.has(i)) {
                    seq.push({ stimulus: seq[i - n].stimulus, isMatch: true });
                } else {
                    seq.push({ stimulus: getDifferentStimulus(seq[i - n].stimulus), isMatch: false });
                }
            }
            return seq;
        };

        // ============================================================
        // 游戏控制
        // ============================================================
        const startGame = () => {
            sequence.value = generateSequence();
            results.value = [];
            hits.value = 0;
            misses.value = 0;
            falseAlarms.value = 0;
            correctRejections.value = 0;
            currentTrialIndex.value = -1;
            gameStartTime = performance.now();
            phase.value = 'playing';
            nextTrial();
        };

        const nextTrial = () => {
            if (isDestroyed) return;
            const nextIdx = currentTrialIndex.value + 1;
            if (nextIdx >= sequence.value.length) {
                endGame();
                return;
            }

            if (currentTrialIndex.value >= 0 && !responded.value) {
                recordResponse(null);
            }

            currentTrialIndex.value = nextIdx;
            const trial = sequence.value[nextIdx];
            currentStimulus.value = trial.stimulus;
            showingBlank.value = false;
            responded.value = false;
            trialStartTime.value = performance.now();

            trialTimer = setTimeout(() => {
                if (isDestroyed) return;
                showingBlank.value = true;
                blankTimer = setTimeout(() => {
                    if (isDestroyed) return;
                    nextTrial();
                }, config.value.interStimulusInterval);
            }, config.value.stimulusDuration);
        };

        const handleResponse = (isMatch) => {
            if (responded.value || phase.value !== 'playing') return;
            responded.value = true;
            recordResponse(isMatch);
        };

        const recordResponse = (response) => {
            const idx = currentTrialIndex.value;
            const trial = sequence.value[idx];
            const rt = response !== null ? Math.round(performance.now() - trialStartTime.value) : null;
            const isActualMatch = trial.isMatch;

            let correct = false;
            if (response === null) {
                if (isActualMatch) {
                    misses.value++;
                } else {
                    correctRejections.value++;
                    correct = true;
                }
            } else if (response === true) {
                if (isActualMatch) {
                    hits.value++;
                    correct = true;
                } else {
                    falseAlarms.value++;
                }
            } else {
                if (!isActualMatch) {
                    correctRejections.value++;
                    correct = true;
                } else {
                    misses.value++;
                }
            }

            results.value.push({
                trial: idx,
                stimulus: trial.stimulus,
                isMatch: isActualMatch,
                response,
                correct,
                rt
            });
        };

        const endGame = () => {
            if (!responded.value && currentTrialIndex.value >= 0) {
                recordResponse(null);
            }
            clearTimeout(trialTimer);
            clearTimeout(blankTimer);
            phase.value = 'feedback';
        };

        // ============================================================
        // 计算属性
        // ============================================================
        const totalResponded = computed(() => results.value.length);
        const accuracy = computed(() => {
            if (totalResponded.value === 0) return 0;
            const correctCount = results.value.filter(r => r.correct).length;
            return Math.round((correctCount / totalResponded.value) * 100);
        });
        const avgResponseTime = computed(() => {
            const withRT = results.value.filter(r => r.rt !== null);
            if (withRT.length === 0) return 0;
            return Math.round(withRT.reduce((sum, r) => sum + r.rt, 0) / withRT.length);
        });
        const progressPercent = computed(() => {
            return Math.round(((currentTrialIndex.value + 1) / config.value.totalTrials) * 100);
        });
        const performanceLevel = computed(() => {
            if (accuracy.value >= 80) return 'excellent';
            if (accuracy.value >= 60) return 'good';
            return 'needsPractice';
        });

        // ============================================================
        // 完成
        // ============================================================
        const finishGame = () => {
            clearTimeout(trialTimer);
            clearTimeout(blankTimer);
            emit('complete', {
                game: 'GardenNBackGame',
                success: accuracy.value >= 60,
                nLevel: N.value,
                totalTrials: config.value.totalTrials,
                accuracy: accuracy.value,
                hits: hits.value,
                misses: misses.value,
                falseAlarms: falseAlarms.value,
                correctRejections: correctRejections.value,
                avgResponseTime: avgResponseTime.value,
                totalTime: Math.round(performance.now() - gameStartTime),
                trials: results.value
            });
        };

        // ============================================================
        // 生命周期
        // ============================================================
        onMounted(() => {
            if (window.lucide) window.lucide.createIcons();
        });

        onUnmounted(() => {
            isDestroyed = true;
            clearTimeout(trialTimer);
            clearTimeout(blankTimer);
        });

        return {
            config, N, phase,
            sequence, currentTrialIndex, currentStimulus, showingBlank, responded,
            results, hits, misses, falseAlarms, correctRejections,
            totalResponded, accuracy, avgResponseTime, progressPercent, performanceLevel,
            startGame, handleResponse, finishGame,
            t
        };
    },

    // ============================================================
    // 模板
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-green-50 to-lime-50">

        <!-- 顶部标题栏 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-emerald-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-emerald-100 p-3 rounded-xl">
                    <i data-lucide="flower-2" class="w-8 h-8 text-emerald-600"></i>
                </div>
                <div>
                    <span class="text-emerald-600 font-bold text-sm uppercase tracking-wider">{{ t('header_subtitle') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ t('header_title') }}</h2>
                </div>
            </div>

            <!-- 进度条 (playing 阶段) -->
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 transition-all duration-300"
                         :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{{ t('trial_progress', { current: currentTrialIndex + 1, total: config.totalTrials }) }}</span>
                    <span>{{ t('accuracy_label', { value: accuracy }) }}</span>
                </div>
            </div>
        </div>

        <!-- 中间：游戏主区域 -->
        <div class="flex-grow p-6 overflow-y-auto flex items-center justify-center">

            <!-- =============== INTRO 阶段 =============== -->
            <div v-if="phase === 'intro'" class="text-center max-w-md">
                <div class="text-6xl mb-4">🌻</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('intro_title') }}</h3>
                <div class="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm text-left mb-6 space-y-3">
                    <p class="text-slate-600 leading-relaxed" v-html="t('intro_desc', { n: N })"></p>
                    <div class="bg-green-50 rounded-xl p-4 space-y-2">
                        <p class="text-sm font-bold text-emerald-700">{{ t('example_label', { n: N }) }}</p>
                        <div class="flex items-center gap-2 text-lg">
                            <template v-if="N === 2">
                                <span class="bg-white px-3 py-1 rounded border text-2xl">🌹</span>
                                <span class="bg-white px-3 py-1 rounded border text-2xl">🌻</span>
                                <span class="bg-emerald-100 px-3 py-1 rounded border-2 border-emerald-500 text-2xl">🌹</span>
                                <span class="text-emerald-600 text-sm font-bold">{{ t('match_indicator') }}</span>
                            </template>
                            <template v-else>
                                <span class="bg-white px-3 py-1 rounded border text-2xl">🌹</span>
                                <span class="bg-emerald-100 px-3 py-1 rounded border-2 border-emerald-500 text-2xl">🌹</span>
                                <span class="text-emerald-600 text-sm font-bold">{{ t('match_indicator') }}</span>
                            </template>
                        </div>
                    </div>
                    <p class="text-slate-500 text-sm">
                        {{ t('timing_hint', { duration: (config.stimulusDuration / 1000).toFixed(1) }) }}
                    </p>
                </div>
                <button @click="startGame"
                    class="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#065f46] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('start_button') }}
                </button>
            </div>

            <!-- =============== PLAYING 阶段 =============== -->
            <div v-if="phase === 'playing'" class="text-center w-full max-w-md">
                <div class="relative">
                    <!-- 花盆 / Garden container -->
                    <div class="w-44 h-44 mx-auto rounded-3xl flex items-center justify-center mb-6 transition-all duration-200"
                         :class="showingBlank
                            ? 'bg-lime-50 border-2 border-dashed border-lime-300'
                            : 'bg-white border-4 border-emerald-400 shadow-lg shadow-emerald-200'">
                        <span v-if="!showingBlank"
                              class="text-8xl select-none">
                            {{ currentStimulus }}
                        </span>
                        <span v-else class="text-lime-400 text-lg">🌱</span>
                    </div>

                    <!-- 花盆底座装饰 -->
                    <div class="w-32 h-3 mx-auto -mt-4 mb-4 rounded-b-xl"
                         :class="showingBlank ? 'bg-lime-200' : 'bg-emerald-300'"></div>

                    <div v-if="responded" class="absolute top-2 right-2">
                        <span class="text-2xl">✓</span>
                    </div>
                </div>

                <!-- 提示文字 -->
                <p class="text-slate-500 text-sm mb-4">
                    <template v-if="currentTrialIndex < N">
                        {{ t('remember_hint', { n: N }) }}
                    </template>
                    <template v-else>
                        {{ t('match_question', { n: N }) }}
                    </template>
                </p>

                <!-- 响应按钮 -->
                <div class="flex gap-4 justify-center"
                     :class="{ 'opacity-30 pointer-events-none': currentTrialIndex < N || responded || showingBlank }">
                    <button @click="handleResponse(true)"
                        class="flex-1 max-w-[180px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xl py-5
                               shadow-[0_4px_0_#065f46] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="check" class="w-6 h-6"></i> {{ t('match_button') }}
                    </button>
                    <button @click="handleResponse(false)"
                        class="flex-1 max-w-[180px] bg-rose-400 hover:bg-rose-500 text-white rounded-xl font-black text-xl py-5
                               shadow-[0_4px_0_#be123c] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="x" class="w-6 h-6"></i> {{ t('no_match_button') }}
                    </button>
                </div>
            </div>

            <!-- =============== FEEDBACK 阶段 =============== -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">
                    {{ performanceLevel === 'excellent' ? '🌟' : performanceLevel === 'good' ? '👍' : '🌱' }}
                </div>
                <h3 class="text-2xl font-black mb-1"
                    :class="performanceLevel === 'excellent' ? 'text-emerald-600'
                          : performanceLevel === 'good' ? 'text-lime-600' : 'text-amber-600'">
                    {{ performanceLevel === 'excellent' ? t('perf_excellent')
                     : performanceLevel === 'good' ? t('perf_good') : t('perf_practice') }}
                </h3>
                <p class="text-slate-500 mb-5">{{ t('task_complete') }}</p>

                <!-- 结果卡片 -->
                <div class="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-emerald-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-emerald-700">{{ accuracy }}%</div>
                            <div class="text-xs text-emerald-500 font-bold">{{ t('total_accuracy') }}</div>
                        </div>
                        <div class="bg-lime-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-lime-700">{{ avgResponseTime }}ms</div>
                            <div class="text-xs text-lime-500 font-bold">{{ t('avg_rt') }}</div>
                        </div>
                        <div class="bg-green-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-green-700">{{ hits }}</div>
                            <div class="text-xs text-green-500 font-bold">{{ t('hits_label') }}</div>
                        </div>
                        <div class="bg-pink-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-pink-600">{{ falseAlarms }}</div>
                            <div class="text-xs text-pink-400 font-bold">{{ t('false_alarms_label') }}</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- 底部操作栏 -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-emerald-100 shrink-0 rounded-b-xl">
            <div v-if="phase === 'playing'" class="text-center text-slate-400 text-sm">
                <template v-if="currentTrialIndex < N">
                    {{ t('remember_first_n', { n: N }) }}
                </template>
                <template v-else>
                    {{ t('answer_instruction') }}
                </template>
            </div>

            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finish_button') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.GardenNBackGame = GardenNBackGame;
