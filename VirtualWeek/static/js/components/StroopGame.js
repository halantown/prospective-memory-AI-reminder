/**
 * Stroop 色词干扰任务
 * 经典心理学认知负荷测试：文字含义与显示颜色不一致时判断颜色
 * 
 * 流程：显示一个颜色词（如"红色"），用不同的颜色渲染
 * 玩家需要判断文字的【显示颜色】而非文字含义
 */
const StroopGame = {
    name: 'StroopGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted } = Vue;

        const defaultScenario = {
            totalTrials: 15,
            congruentRatio: 0.3,    // 一致条件的比例（越少越难）
            stimulusDuration: 3000, // ms
            interTrialInterval: 500
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        const COLORS = [
            { name: '红色', nameEn: 'RED',    nameNl: 'ROOD',  css: 'text-red-500',    bg: 'bg-red-500',    hex: '#ef4444' },
            { name: '蓝色', nameEn: 'BLUE',   nameNl: 'BLAUW', css: 'text-blue-500',   bg: 'bg-blue-500',   hex: '#3b82f6' },
            { name: '绿色', nameEn: 'GREEN',  nameNl: 'GROEN', css: 'text-green-500',  bg: 'bg-green-500',  hex: '#22c55e' },
            { name: '黄色', nameEn: 'YELLOW', nameNl: 'GEEL',  css: 'text-yellow-500', bg: 'bg-yellow-500', hex: '#eab308' },
        ];

        const TEXTS = {
            attentionTest: { zh: '注意力测试', en: 'Attention Test', nl: 'Aandachtstest' },
            stroopTask: { zh: 'Stroop 色词任务', en: 'Stroop Color-Word Task', nl: 'Stroop Kleur-Woord Taak' },
            accuracyLabel: { zh: '正确率:', en: 'Accuracy:', nl: 'Nauwkeurigheid:' },
            stroopInterference: { zh: 'Stroop 色词干扰', en: 'Stroop Color-Word Interference', nl: 'Stroop Kleur-Woord Interferentie' },
            introDesc: {
                zh: '屏幕上会出现<strong>颜色词</strong>，但文字的<strong class="text-pink-700">显示颜色</strong>可能和文字含义不同。请判断文字的<strong class="text-pink-700">显示颜色</strong>，而不是文字含义。',
                en: 'Color words will appear on screen, but the <strong class="text-pink-700">display color</strong> may differ from the word meaning. Judge the <strong class="text-pink-700">display color</strong> of the text, not the word meaning.',
                nl: 'Er verschijnen kleurwoorden op het scherm, maar de <strong class="text-pink-700">weergavekleur</strong> kan verschillen van de woordbetekenis. Beoordeel de <strong class="text-pink-700">weergavekleur</strong> van de tekst, niet de woordbetekenis.'
            },
            example: { zh: '示例：', en: 'Example:', nl: 'Voorbeeld:' },
            displayColor: { zh: '显示颜色:', en: 'Display color:', nl: 'Weergavekleur:' },
            answerQuickly: { zh: '⚡ 请尽快作答，忽略文字含义！', en: '⚡ Answer quickly, ignore the word meaning!', nl: '⚡ Antwoord snel, negeer de woordbetekenis!' },
            startChallenge: { zh: '开始挑战', en: 'Start', nl: 'Start' },
            selectDisplayColor: {
                zh: '请选择文字的<strong>显示颜色</strong>',
                en: 'Select the <strong>display color</strong> of the text',
                nl: 'Selecteer de <strong>weergavekleur</strong> van de tekst'
            },
            taskComplete: { zh: 'Stroop 任务完成', en: 'Stroop Task Complete', nl: 'Stroop Taak Voltooid' },
            attentionInhibition: { zh: '注意力与抑制控制测试', en: 'Attention & Inhibition Control Test', nl: 'Aandacht & Inhibitiecontrole Test' },
            totalAccuracy: { zh: '总正确率', en: 'Total Accuracy', nl: 'Totale Nauwkeurigheid' },
            avgResponseTime: { zh: '平均反应时', en: 'Avg Response Time', nl: 'Gem. Reactietijd' },
            stroopEffectAnalysis: { zh: 'Stroop 效应分析', en: 'Stroop Effect Analysis', nl: 'Stroop Effect Analyse' },
            congruent: { zh: '一致条件:', en: 'Congruent:', nl: 'Congruent:' },
            incongruent: { zh: '不一致:', en: 'Incongruent:', nl: 'Incongruent:' },
            interferenceEffect: { zh: '干扰效应:', en: 'Interference:', nl: 'Interferentie:' },
            footerHint: { zh: '选择文字的显示颜色，而非文字含义', en: 'Select the display color, not the word meaning', nl: 'Selecteer de weergavekleur, niet de woordbetekenis' },
            complete: { zh: '完成', en: 'Complete', nl: 'Voltooien' },
        };
        const lang = computed(() => config.value.lang || 'zh');
        const t = (key) => TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;

        const colorName = (idx) => {
            const c = COLORS[idx];
            if (!c) return '';
            if (lang.value === 'nl') return c.nameNl;
            if (lang.value === 'en') return c.nameEn;
            return c.name;
        };

        const trialProgressText = computed(() => {
            const n = currentTrialIndex.value + 1;
            const m = config.value.totalTrials;
            if (lang.value === 'nl') return 'Opgave ' + n + ' / ' + m;
            if (lang.value === 'en') return 'Trial ' + n + ' / ' + m;
            return '第 ' + n + ' / ' + m + ' 个';
        });

        // ============================================================
        // 状态
        // ============================================================
        const phase = ref('intro');
        const currentTrialIndex = ref(-1);
        const trials = ref([]);
        const currentWord = ref('');
        const currentWordColor = ref('');   // Tailwind class
        const currentInkColorIdx = ref(-1); // 正确答案的颜色索引
        const isCongruent = ref(false);
        const showingBlank = ref(false);
        const responded = ref(false);
        const trialStartTime = ref(0);

        const results = ref([]);
        let trialTimer = null;
        let blankTimer = null;
        let gameStartTime = 0;

        // ============================================================
        // 生成试次
        // ============================================================
        const generateTrials = () => {
            const { totalTrials, congruentRatio } = config.value;
            const numCongruent = Math.round(totalTrials * congruentRatio);
            const arr = [];

            for (let i = 0; i < totalTrials; i++) {
                const wordIdx = Math.floor(Math.random() * COLORS.length);
                let inkIdx;
                if (i < numCongruent) {
                    // 一致条件
                    inkIdx = wordIdx;
                } else {
                    // 不一致条件
                    do { inkIdx = Math.floor(Math.random() * COLORS.length); } while (inkIdx === wordIdx);
                }
                arr.push({ wordIdx, inkIdx, congruent: wordIdx === inkIdx });
            }
            // 随机打乱
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        // ============================================================
        // 游戏控制
        // ============================================================
        const startGame = () => {
            trials.value = generateTrials();
            results.value = [];
            currentTrialIndex.value = -1;
            gameStartTime = performance.now();
            phase.value = 'playing';
            nextTrial();
        };

        const nextTrial = () => {
            const nextIdx = currentTrialIndex.value + 1;

            // 记录未响应的试次
            if (currentTrialIndex.value >= 0 && !responded.value) {
                recordResponse(null);
            }

            if (nextIdx >= trials.value.length) {
                endGame();
                return;
            }

            currentTrialIndex.value = nextIdx;
            const trial = trials.value[nextIdx];
            currentWord.value = colorName(trial.wordIdx);
            currentWordColor.value = COLORS[trial.inkIdx].css;
            currentInkColorIdx.value = trial.inkIdx;
            isCongruent.value = trial.congruent;
            showingBlank.value = false;
            responded.value = false;
            trialStartTime.value = performance.now();

            trialTimer = setTimeout(() => {
                showingBlank.value = true;
                blankTimer = setTimeout(nextTrial, config.value.interTrialInterval);
            }, config.value.stimulusDuration);
        };

        const handleColorChoice = (colorIdx) => {
            if (responded.value || phase.value !== 'playing' || showingBlank.value) return;
            responded.value = true;
            recordResponse(colorIdx);
        };

        const recordResponse = (colorIdx) => {
            const idx = currentTrialIndex.value;
            const trial = trials.value[idx];
            const rt = colorIdx !== null ? Math.round(performance.now() - trialStartTime.value) : null;
            const correct = colorIdx === trial.inkIdx;

            results.value.push({
                trial: idx,
                word: COLORS[trial.wordIdx].name,
                inkColor: COLORS[trial.inkIdx].name,
                congruent: trial.congruent,
                response: colorIdx !== null ? COLORS[colorIdx].name : null,
                correct: colorIdx !== null ? correct : false,
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
        const respondedResults = computed(() => results.value.filter(r => r.rt !== null));
        const accuracy = computed(() => {
            if (results.value.length === 0) return 0;
            return Math.round((results.value.filter(r => r.correct).length / results.value.length) * 100);
        });
        const congruentAcc = computed(() => {
            const c = results.value.filter(r => r.congruent && r.rt !== null);
            if (c.length === 0) return 0;
            return Math.round((c.filter(r => r.correct).length / c.length) * 100);
        });
        const incongruentAcc = computed(() => {
            const ic = results.value.filter(r => !r.congruent && r.rt !== null);
            if (ic.length === 0) return 0;
            return Math.round((ic.filter(r => r.correct).length / ic.length) * 100);
        });
        const avgRT = computed(() => {
            if (respondedResults.value.length === 0) return 0;
            return Math.round(respondedResults.value.reduce((s, r) => s + r.rt, 0) / respondedResults.value.length);
        });
        const congruentRT = computed(() => {
            const c = respondedResults.value.filter(r => r.congruent);
            if (c.length === 0) return 0;
            return Math.round(c.reduce((s, r) => s + r.rt, 0) / c.length);
        });
        const incongruentRT = computed(() => {
            const ic = respondedResults.value.filter(r => !r.congruent);
            if (ic.length === 0) return 0;
            return Math.round(ic.reduce((s, r) => s + r.rt, 0) / ic.length);
        });
        const stroopEffect = computed(() => incongruentRT.value - congruentRT.value);
        const progressPercent = computed(() => Math.round(((currentTrialIndex.value + 1) / config.value.totalTrials) * 100));

        const finishGame = () => {
            clearTimeout(trialTimer);
            clearTimeout(blankTimer);
            emit('complete', {
                success: accuracy.value >= 60,
                totalTrials: config.value.totalTrials,
                accuracy: accuracy.value,
                congruentAccuracy: congruentAcc.value,
                incongruentAccuracy: incongruentAcc.value,
                avgResponseTime: avgRT.value,
                congruentRT: congruentRT.value,
                incongruentRT: incongruentRT.value,
                stroopEffect: stroopEffect.value,
                totalTime: Math.round(performance.now() - gameStartTime),
                trials: results.value
            });
        };

        onMounted(() => { if (window.lucide) window.lucide.createIcons(); });
        onUnmounted(() => { clearTimeout(trialTimer); clearTimeout(blankTimer); });

        return {
            config, COLORS, phase,
            currentTrialIndex, currentWord, currentWordColor, isCongruent,
            showingBlank, responded,
            accuracy, avgRT, congruentAcc, incongruentAcc, congruentRT, incongruentRT,
            stroopEffect, progressPercent,
            startGame, handleColorChoice, finishGame,
            t, colorName, trialProgressText
        };
    },

    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-pink-50 to-white">

        <!-- 顶部 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-pink-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-pink-100 p-3 rounded-xl">
                    <i data-lucide="palette" class="w-8 h-8 text-pink-600"></i>
                </div>
                <div>
                    <span class="text-pink-600 font-bold text-sm uppercase tracking-wider">注意力测试</span>
                    <h2 class="text-xl font-black text-slate-800">Stroop 色词任务</h2>
                </div>
            </div>
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-pink-500 transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>第 {{ currentTrialIndex + 1 }} / {{ config.totalTrials }} 个</span>
                    <span>正确率: {{ accuracy }}%</span>
                </div>
            </div>
        </div>

        <!-- 中间 -->
        <div class="flex-grow p-6 overflow-y-auto flex items-center justify-center">

            <!-- INTRO -->
            <div v-if="phase === 'intro'" class="text-center max-w-md">
                <div class="text-6xl mb-4">🎨</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">Stroop 色词干扰</h3>
                <div class="bg-white rounded-2xl p-5 border border-pink-200 shadow-sm text-left mb-6 space-y-3">
                    <p class="text-slate-600 leading-relaxed">
                        屏幕上会出现<strong>颜色词</strong>，但文字的<strong class="text-pink-700">显示颜色</strong>可能和文字含义不同。
                        请判断文字的<strong class="text-pink-700">显示颜色</strong>，而不是文字含义。
                    </p>
                    <div class="bg-pink-50 rounded-xl p-4 space-y-3">
                        <p class="text-sm font-bold text-pink-700">示例：</p>
                        <div class="flex items-center gap-4">
                            <div class="text-center">
                                <span class="text-3xl font-black text-blue-500">红色</span>
                                <p class="text-xs text-slate-500 mt-1">显示颜色: <strong>蓝色</strong> ✅</p>
                            </div>
                            <div class="text-center">
                                <span class="text-3xl font-black text-red-500">红色</span>
                                <p class="text-xs text-slate-500 mt-1">显示颜色: <strong>红色</strong> ✅</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-slate-500 text-sm">⚡ 请尽快作答，忽略文字含义！</p>
                </div>
                <button @click="startGame"
                    class="bg-pink-600 hover:bg-pink-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#9d174d] active:shadow-none active:translate-y-[4px] transition-all">
                    开始挑战
                </button>
            </div>

            <!-- PLAYING -->
            <div v-if="phase === 'playing'" class="text-center w-full max-w-md">
                <!-- 刺激显示 -->
                <div class="w-52 h-36 mx-auto rounded-3xl flex items-center justify-center mb-8 transition-all duration-200"
                     :class="showingBlank
                        ? 'bg-slate-100 border-2 border-dashed border-slate-300'
                        : 'bg-white border-4 border-pink-300 shadow-lg shadow-pink-200'">
                    <span v-if="!showingBlank"
                          class="text-5xl font-black select-none" :class="currentWordColor">
                        {{ currentWord }}
                    </span>
                    <span v-else class="text-slate-400 text-lg">...</span>
                </div>

                <p class="text-slate-500 text-sm mb-4">请选择文字的<strong>显示颜色</strong></p>

                <!-- 颜色按钮 -->
                <div class="grid grid-cols-2 gap-3"
                     :class="{ 'opacity-30 pointer-events-none': showingBlank || responded }">
                    <button v-for="(color, idx) in COLORS" :key="idx"
                        @click="handleColorChoice(idx)"
                        class="py-4 rounded-xl font-black text-xl text-white transition-all
                               active:scale-95 active:shadow-none"
                        :class="[color.bg, 'hover:opacity-90 shadow-lg']">
                        {{ color.name }}
                    </button>
                </div>

                <div v-if="responded" class="mt-3">
                    <span class="text-2xl">✓</span>
                </div>
            </div>

            <!-- FEEDBACK -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">🎨</div>
                <h3 class="text-2xl font-black text-slate-800 mb-1">Stroop 任务完成</h3>
                <p class="text-slate-500 mb-5">注意力与抑制控制测试</p>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="bg-pink-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-pink-700">{{ accuracy }}%</div>
                            <div class="text-xs text-pink-500 font-bold">总正确率</div>
                        </div>
                        <div class="bg-blue-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-blue-700">{{ avgRT }}ms</div>
                            <div class="text-xs text-blue-500 font-bold">平均反应时</div>
                        </div>
                    </div>
                    
                    <!-- Stroop 效应 -->
                    <div class="bg-slate-50 rounded-xl p-4 space-y-2">
                        <p class="text-sm font-bold text-slate-600">Stroop 效应分析</p>
                        <div class="flex justify-between text-sm">
                            <span class="text-green-600">一致条件: {{ congruentAcc }}% / {{ congruentRT }}ms</span>
                            <span class="text-red-600">不一致: {{ incongruentAcc }}% / {{ incongruentRT }}ms</span>
                        </div>
                        <div class="text-center">
                            <span class="text-lg font-black" :class="stroopEffect > 0 ? 'text-amber-600' : 'text-green-600'">
                                干扰效应: {{ stroopEffect > 0 ? '+' : '' }}{{ stroopEffect }}ms
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部 -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            <div v-if="phase === 'playing'" class="text-center text-slate-400 text-sm">
                选择文字的显示颜色，而非文字含义
            </div>
            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-pink-600 hover:bg-pink-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    完成
                </button>
            </div>
        </div>
    </div>
    `
};

window.StroopGame = StroopGame;
