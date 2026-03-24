/**
 * 厨房记忆 N-Back 任务 (Kitchen Memory N-Back)
 * 高认知负荷小游戏：判断当前食材是否与 N 步之前的食材相同
 *
 * 默认 2-back，可通过 scenario.nLevel 配置
 * 刺激类型：食物 emoji
 */
const CookingGame = {
    name: 'CookingGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted } = Vue;

        // ============================================================
        // 配置
        // ============================================================
        const defaultScenario = {
            nLevel: 2,
            totalTrials: 20,
            matchRatio: 0.3,
            stimulusDuration: 2500,
            interStimulusInterval: 500,
            stimulusType: 'emoji',
            stimuli: ['🥕','🍅','🧅','🥩','🍳','🧈','🌶️','🍆','🥦','🫑','🧄','🍗'],
            totalRounds: 1,
            lang: 'zh'
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ============================================================
        // i18n
        // ============================================================
        const TEXTS = {
            header_subtitle: { zh: '厨房记忆', en: 'Kitchen Memory', nl: 'Keukengeheugen' },
            header_title: { zh: '-Back 任务', en: '-Back Task', nl: '-Back Taak' },
            trial_progress: { zh: '第 {current} / {total} 个', en: 'Trial {current} / {total}', nl: 'Trial {current} / {total}' },
            accuracy_label: { zh: '正确率: {value}%', en: 'Accuracy: {value}%', nl: 'Nauwkeurigheid: {value}%' },
            intro_title: { zh: '厨房记忆挑战', en: 'Kitchen Memory Challenge', nl: 'Keukengeheugen Uitdaging' },
            intro_desc: {
                zh: '屏幕上会依次出现<strong class="text-orange-700">食材</strong>。请判断当前食材是否与<strong class="text-orange-700"> {n} 个之前</strong>的食材<strong class="text-orange-700">相同</strong>。',
                en: '<strong class="text-orange-700">Food items</strong> will appear one at a time. Determine if the current item is <strong class="text-orange-700">the same</strong> as the one <strong class="text-orange-700">{n} steps ago</strong>.',
                nl: 'Er verschijnen <strong class="text-orange-700">voedselitems</strong> één voor één. Bepaal of het huidige item <strong class="text-orange-700">hetzelfde</strong> is als dat van <strong class="text-orange-700">{n} stappen geleden</strong>.'
            },
            example_label: { zh: '示例 ({n}-back):', en: 'Example ({n}-back):', nl: 'Voorbeeld ({n}-back):' },
            match_indicator: { zh: '← 匹配！', en: '← Match!', nl: '← Match!' },
            timing_hint: { zh: '⏱ 每个食材展示 {duration} 秒，请尽快作答。', en: '⏱ Each item is shown for {duration} seconds. Respond quickly.', nl: '⏱ Elk item wordt {duration} seconden getoond. Reageer zo snel mogelijk.' },
            start_button: { zh: '开始挑战', en: 'Start Challenge', nl: 'Start Uitdaging' },
            remember_hint: { zh: '请记住这个食材（前 {n} 个无需判断）', en: 'Remember this item (no response needed for first {n})', nl: 'Onthoud dit item (geen reactie nodig voor de eerste {n})' },
            match_question: { zh: '与 {n} 个前的相同吗？', en: 'Same as {n} back?', nl: 'Hetzelfde als {n} terug?' },
            match_button: { zh: '匹配', en: 'Match', nl: 'Match' },
            no_match_button: { zh: '不匹配', en: 'No Match', nl: 'Geen Match' },
            perf_excellent: { zh: '大厨水平！', en: 'Master Chef!', nl: 'Meesterkok!' },
            perf_good: { zh: '不错的厨艺！', en: 'Great Cooking!', nl: 'Goed Gekookt!' },
            perf_practice: { zh: '继续练习！', en: 'Keep Practicing!', nl: 'Blijf Oefenen!' },
            task_complete: { zh: '-Back 任务完成', en: '-Back Task Complete', nl: '-Back Taak Voltooid' },
            total_accuracy: { zh: '总正确率', en: 'Total Accuracy', nl: 'Totale Nauwkeurigheid' },
            avg_rt: { zh: '平均反应时', en: 'Avg Response Time', nl: 'Gem. Reactietijd' },
            hits_label: { zh: '命中 (Hits)', en: 'Hits', nl: 'Hits' },
            false_alarms_label: { zh: '虚报 (FA)', en: 'False Alarms', nl: 'Vals Alarm' },
            remember_first_n: { zh: '请先记住前 {n} 个食材', en: 'Remember the first {n} items', nl: 'Onthoud de eerste {n} items' },
            answer_instruction: { zh: '按"匹配"或"不匹配"作答', en: 'Press "Match" or "No Match" to respond', nl: 'Druk op "Match" of "Geen Match" om te reageren' },
            finish_button: { zh: '完成', en: 'Finish', nl: 'Voltooien' },
            round_label: { zh: '第 {current} / {total} 轮', en: 'Round {current} / {total}', nl: 'Ronde {current} / {total}' },
            round_complete: { zh: '本轮完成！', en: 'Round Complete!', nl: 'Ronde Voltooid!' },
            round_accuracy: { zh: '本轮正确率: {value}%', en: 'This round accuracy: {value}%', nl: 'Nauwkeurigheid deze ronde: {value}%' },
            next_round: { zh: '开始下一轮', en: 'Next Round', nl: 'Volgende Ronde' }
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
        const phase = ref('intro');         // 'intro' | 'playing' | 'round_break' | 'feedback'
        const sequence = ref([]);
        const currentTrialIndex = ref(-1);
        const currentStimulus = ref(null);
        const showingBlank = ref(false);
        const responded = ref(false);
        const trialStartTime = ref(0);

        // Multi-round tracking
        const currentRound = ref(1);
        const allRoundResults = ref([]);

        const results = ref([]);
        const hits = ref(0);
        const misses = ref(0);
        const falseAlarms = ref(0);
        const correctRejections = ref(0);

        let trialTimer = null;
        let blankTimer = null;
        let gameStartTime = 0;

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

            const getRandomStimulus = () => {
                return stimuli[Math.floor(Math.random() * stimuli.length)];
            };

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
            currentRound.value = 1;
            allRoundResults.value = [];
            startRound();
        };

        const startRound = () => {
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
                showingBlank.value = true;
                blankTimer = setTimeout(() => {
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

            // Save this round's results
            allRoundResults.value.push({
                round: currentRound.value,
                accuracy: accuracy.value,
                hits: hits.value,
                misses: misses.value,
                falseAlarms: falseAlarms.value,
                correctRejections: correctRejections.value,
                avgResponseTime: avgResponseTime.value,
                totalTime: Math.round(performance.now() - gameStartTime),
                trials: [...results.value]
            });

            const maxRounds = config.value.totalRounds || 1;
            if (currentRound.value < maxRounds) {
                phase.value = 'round_break';
            } else {
                phase.value = 'feedback';
            }
        };

        const startNextRound = () => {
            currentRound.value++;
            startRound();
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
            const resp = results.value.filter(r => r.rt !== null);
            if (resp.length === 0) return 0;
            return Math.round(resp.reduce((sum, r) => sum + r.rt, 0) / resp.length);
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
        const overallAccuracy = computed(() => {
            const rounds = allRoundResults.value;
            if (rounds.length === 0) return accuracy.value;
            const total = rounds.reduce((s, r) => s + r.trials.length, 0);
            if (total === 0) return 0;
            const correct = rounds.reduce((s, r) => s + r.trials.filter(t => t.correct).length, 0);
            return Math.round((correct / total) * 100);
        });

        const finishGame = () => {
            clearTimeout(trialTimer);
            clearTimeout(blankTimer);
            const rounds = allRoundResults.value;
            emit('complete', {
                game: 'CookingGame',
                success: overallAccuracy.value >= 60,
                nLevel: N.value,
                totalTrials: config.value.totalTrials,
                totalRounds: rounds.length,
                accuracy: overallAccuracy.value,
                hits: rounds.reduce((s, r) => s + r.hits, 0),
                misses: rounds.reduce((s, r) => s + r.misses, 0),
                falseAlarms: rounds.reduce((s, r) => s + r.falseAlarms, 0),
                correctRejections: rounds.reduce((s, r) => s + r.correctRejections, 0),
                avgResponseTime: Math.round(rounds.reduce((s, r) => s + r.avgResponseTime, 0) / rounds.length),
                totalTime: rounds.reduce((s, r) => s + r.totalTime, 0),
                rounds: rounds
            });
        };

        // ============================================================
        // 生命周期
        // ============================================================
        onMounted(() => {
            if (window.lucide) window.lucide.createIcons();
        });

        onUnmounted(() => {
            clearTimeout(trialTimer);
            clearTimeout(blankTimer);
        });

        return {
            config, N, phase, currentRound, allRoundResults, overallAccuracy,
            sequence, currentTrialIndex, currentStimulus, showingBlank, responded,
            results, hits, misses, falseAlarms, correctRejections,
            totalResponded, accuracy, avgResponseTime, progressPercent, performanceLevel,
            startGame, startNextRound, handleResponse, finishGame,
            t
        };
    },

    // ============================================================
    // 模板
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-orange-50 to-amber-50">

        <!-- 顶部标题栏 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-orange-200 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-orange-100 p-3 rounded-xl">
                    <i data-lucide="chef-hat" class="w-8 h-8 text-orange-600"></i>
                </div>
                <div>
                    <span class="text-orange-600 font-bold text-sm uppercase tracking-wider">{{ t('header_subtitle') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ N }}{{ t('header_title') }}</h2>
                </div>
            </div>

            <!-- 进度条 (playing 阶段) -->
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-orange-100 rounded-full overflow-hidden">
                    <div class="h-full bg-orange-500 transition-all duration-300"
                         :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{{ t('trial_progress', { current: currentTrialIndex + 1, total: config.totalTrials }) }}
                        <template v-if="config.totalRounds > 1"> · {{ t('round_label', { current: currentRound, total: config.totalRounds }) }}</template>
                    </span>
                    <span>{{ t('accuracy_label', { value: accuracy }) }}</span>
                </div>
            </div>
        </div>

        <!-- 中间：游戏主区域 -->
        <div class="flex-grow p-6 overflow-y-auto flex items-center justify-center">

            <!-- =============== INTRO 阶段 =============== -->
            <div v-if="phase === 'intro'" class="text-center max-w-md">
                <div class="text-6xl mb-4">🍳</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('intro_title') }}</h3>
                <div class="bg-white rounded-2xl p-5 border border-orange-200 shadow-sm text-left mb-6 space-y-3">
                    <p class="text-slate-600 leading-relaxed" v-html="t('intro_desc', { n: N })"></p>
                    <div class="bg-orange-50 rounded-xl p-4 space-y-2">
                        <p class="text-sm font-bold text-orange-700">{{ t('example_label', { n: N }) }}</p>
                        <div class="flex items-center gap-2 text-2xl">
                            <template v-if="N === 2">
                                <span class="bg-white px-3 py-1 rounded border">🥕</span>
                                <span class="bg-white px-3 py-1 rounded border">🍅</span>
                                <span class="bg-green-100 px-3 py-1 rounded border-2 border-green-500 font-bold">🥕</span>
                                <span class="text-green-600 text-sm font-bold">{{ t('match_indicator') }}</span>
                            </template>
                            <template v-else>
                                <span class="bg-white px-3 py-1 rounded border">🥕</span>
                                <span class="bg-green-100 px-3 py-1 rounded border-2 border-green-500 font-bold">🥕</span>
                                <span class="text-green-600 text-sm font-bold">{{ t('match_indicator') }}</span>
                            </template>
                        </div>
                    </div>
                    <p class="text-slate-500 text-sm">
                        {{ t('timing_hint', { duration: (config.stimulusDuration / 1000).toFixed(1) }) }}
                    </p>
                </div>
                <button @click="startGame"
                    class="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#c2410c] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('start_button') }}
                </button>
            </div>

            <!-- =============== PLAYING 阶段 =============== -->
            <div v-if="phase === 'playing'" class="text-center w-full max-w-md">
                <div class="relative">
                    <!-- 盘子造型刺激显示区 -->
                    <div class="w-48 h-48 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-200"
                         :class="showingBlank
                            ? 'bg-orange-50 border-4 border-dashed border-orange-200'
                            : 'bg-white border-[6px] border-orange-300 shadow-lg shadow-orange-200'">
                        <span v-if="!showingBlank"
                              class="text-8xl select-none leading-none"
                              style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
                            {{ currentStimulus }}
                        </span>
                        <span v-else class="text-orange-300 text-lg">...</span>
                    </div>

                    <!-- 已响应指示 -->
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
                        class="flex-1 max-w-[180px] bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xl py-5
                               shadow-[0_4px_0_#c2410c] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="check" class="w-6 h-6"></i> {{ t('match_button') }}
                    </button>
                    <button @click="handleResponse(false)"
                        class="flex-1 max-w-[180px] bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xl py-5
                               shadow-[0_4px_0_#b91c1c] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="x" class="w-6 h-6"></i> {{ t('no_match_button') }}
                    </button>
                </div>
            </div>

            <!-- =============== ROUND BREAK 阶段 =============== -->
            <div v-if="phase === 'round_break'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">✅</div>
                <h3 class="text-2xl font-black text-slate-800 mb-2">{{ t('round_complete') }}</h3>
                <p class="text-slate-600 mb-2">{{ t('round_accuracy', { value: accuracy }) }}</p>
                <p class="text-slate-500 text-sm mb-6">{{ t('round_label', { current: currentRound, total: config.totalRounds }) }}</p>
                <button @click="startNextRound"
                    class="bg-orange-600 hover:bg-orange-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#c2410c] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('next_round') }}
                </button>
            </div>

            <!-- =============== FEEDBACK 阶段 =============== -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">
                    {{ performanceLevel === 'excellent' ? '👨‍🍳' : performanceLevel === 'good' ? '🍽️' : '🔪' }}
                </div>
                <h3 class="text-2xl font-black mb-1"
                    :class="performanceLevel === 'excellent' ? 'text-green-600'
                          : performanceLevel === 'good' ? 'text-orange-600' : 'text-amber-600'">
                    {{ performanceLevel === 'excellent' ? t('perf_excellent')
                     : performanceLevel === 'good' ? t('perf_good') : t('perf_practice') }}
                </h3>
                <p class="text-slate-500 mb-5">{{ N }}{{ t('task_complete') }}</p>

                <!-- 结果卡片 -->
                <div class="bg-white rounded-2xl border border-orange-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-orange-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-orange-700">{{ accuracy }}%</div>
                            <div class="text-xs text-orange-500 font-bold">{{ t('total_accuracy') }}</div>
                        </div>
                        <div class="bg-amber-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-amber-700">{{ avgResponseTime }}ms</div>
                            <div class="text-xs text-amber-500 font-bold">{{ t('avg_rt') }}</div>
                        </div>
                        <div class="bg-green-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-green-700">{{ hits }}</div>
                            <div class="text-xs text-green-500 font-bold">{{ t('hits_label') }}</div>
                        </div>
                        <div class="bg-red-50 rounded-xl p-3">
                            <div class="text-2xl font-black text-red-700">{{ falseAlarms }}</div>
                            <div class="text-xs text-red-500 font-bold">{{ t('false_alarms_label') }}</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- 底部操作栏 -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-orange-100 shrink-0 rounded-b-xl">
            <!-- playing 阶段提示 -->
            <div v-if="phase === 'playing'" class="text-center text-slate-400 text-sm">
                <template v-if="currentTrialIndex < N">
                    {{ t('remember_first_n', { n: N }) }}
                </template>
                <template v-else>
                    {{ t('answer_instruction') }}
                </template>
            </div>

            <!-- feedback 阶段按钮 -->
            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finish_button') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.CookingGame = CookingGame;