/**
 * 双任务切换游戏 (Task Switching / Dual Task)
 * 高认知负荷：在两种判断规则之间快速切换
 * 
 * 规则A (数字): 判断数字是奇数还是偶数
 * 规则B (字母): 判断字母是元音还是辅音
 * 
 * 当前规则由背景色提示（蓝=数字，绿=字母），规则随机切换
 * 切换代价 (switch cost) 是核心测量指标
 */
const TaskSwitchGame = {
    name: 'TaskSwitchGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted } = Vue;

        const defaultScenario = {
            totalTrials: 20,
            switchRatio: 0.5,           // 切换比例
            stimulusDuration: 3500,     // ms
            interTrialInterval: 600
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        const TEXTS = {
            execFunctionTest: { zh: '执行功能测试', en: 'Executive Function Test', nl: 'Executieve Functietest' },
            taskSwitching: { zh: '任务切换', en: 'Task Switching', nl: 'Taakwisseling' },
            trialPrefix: { zh: '第', en: 'Trial', nl: 'Vraag' },
            trialSuffix: { zh: '个', en: '', nl: '' },
            accuracyLabel: { zh: '正确率', en: 'Accuracy', nl: 'Nauwkeurigheid' },
            taskSwitchChallenge: { zh: '任务切换挑战', en: 'Task Switching Challenge', nl: 'Taakwisselingsuitdaging' },
            introDesc: {
                zh: '你需要在<strong class="text-blue-600">两种规则</strong>之间切换判断：',
                en: 'You need to switch between <strong class="text-blue-600">two rules</strong>:',
                nl: 'Je moet schakelen tussen <strong class="text-blue-600">twee regels</strong>:'
            },
            numberTask: { zh: '数字任务', en: 'Number Task', nl: 'Cijfertaak' },
            numberTaskLabel: { zh: '🔢 数字任务', en: '🔢 Number Task', nl: '🔢 Cijfertaak' },
            numberTaskDesc: {
                zh: '判断数字是<strong>奇数</strong>还是<strong>偶数</strong>',
                en: 'Judge if the number is <strong>odd</strong> or <strong>even</strong>',
                nl: 'Bepaal of het cijfer <strong>oneven</strong> of <strong>even</strong> is'
            },
            letterTask: { zh: '字母任务', en: 'Letter Task', nl: 'Lettertaak' },
            letterTaskLabel: { zh: '🔤 字母任务', en: '🔤 Letter Task', nl: '🔤 Lettertaak' },
            letterTaskDesc: {
                zh: '判断字母是<strong>元音</strong>还是<strong>辅音</strong>',
                en: 'Judge if the letter is a <strong>vowel</strong> or <strong>consonant</strong>',
                nl: 'Bepaal of de letter een <strong>klinker</strong> of <strong>medeklinker</strong> is'
            },
            colorHint: {
                zh: '注意<strong>框架颜色</strong>来确定当前规则：',
                en: 'Watch the <strong>border color</strong> to determine the current rule:',
                nl: 'Let op de <strong>randkleur</strong> om de huidige regel te bepalen:'
            },
            blueNumber: { zh: '蓝色=数字', en: 'Blue=Number', nl: 'Blauw=Cijfer' },
            greenLetter: { zh: '绿色=字母', en: 'Green=Letter', nl: 'Groen=Letter' },
            stayFocused: {
                zh: '⚡ 规则会随时切换，请保持注意力！',
                en: '⚡ Rules can switch at any time, stay focused!',
                nl: '⚡ Regels kunnen op elk moment wisselen, blijf gefocust!'
            },
            startChallenge: { zh: '开始挑战', en: 'Start Challenge', nl: 'Start Uitdaging' },
            numberInstruction: { zh: '奇数 or 偶数？', en: 'Odd or Even?', nl: 'Oneven of Even?' },
            letterInstruction: { zh: '元音 or 辅音？', en: 'Vowel or Consonant?', nl: 'Klinker of Medeklinker?' },
            odd: { zh: '奇数', en: 'Odd', nl: 'Oneven' },
            even: { zh: '偶数', en: 'Even', nl: 'Even' },
            vowel: { zh: '元音', en: 'Vowel', nl: 'Klinker' },
            consonant: { zh: '辅音', en: 'Consonant', nl: 'Medeklinker' },
            taskSwitchComplete: { zh: '任务切换完成', en: 'Task Switching Complete', nl: 'Taakwisseling Voltooid' },
            execCogFlex: {
                zh: '执行功能 · 认知灵活性',
                en: 'Executive Function · Cognitive Flexibility',
                nl: 'Executieve Functie · Cognitieve Flexibiliteit'
            },
            overallAccuracy: { zh: '总正确率', en: 'Overall Accuracy', nl: 'Totale Nauwkeurigheid' },
            avgResponseTime: { zh: '平均反应时', en: 'Avg Response Time', nl: 'Gem. Reactietijd' },
            switchCostAnalysis: { zh: '切换代价分析', en: 'Switch Cost Analysis', nl: 'Wisselkosten Analyse' },
            repeatCondition: { zh: '重复条件', en: 'Repeat', nl: 'Herhaling' },
            switchCondition: { zh: '切换条件', en: 'Switch', nl: 'Wisseling' },
            switchCostLabel: { zh: '切换代价', en: 'Switch Cost', nl: 'Wisselkosten' },
            footerHint: {
                zh: '注意框架颜色判断当前规则',
                en: 'Watch the border color to determine the current rule',
                nl: 'Let op de randkleur om de huidige regel te bepalen'
            },
            done: { zh: '完成', en: 'Done', nl: 'Voltooid' },
        };
        const lang = computed(() => config.value.lang || 'zh');
        const t = (key) => TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;

        const VOWELS = ['A', 'E', 'I', 'O', 'U'];
        const CONSONANTS = ['B', 'D', 'F', 'G', 'K', 'M', 'N', 'P', 'R', 'S', 'T'];
        const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

        const TASKS = {
            number: {
                nameKey: 'numberTask',
                instrKey: 'numberInstruction',
                color: 'blue',
                bgClass: 'bg-blue-50 border-blue-300',
                tagClass: 'bg-blue-100 text-blue-700',
                icon: 'hash'
            },
            letter: {
                nameKey: 'letterTask',
                instrKey: 'letterInstruction',
                color: 'green',
                bgClass: 'bg-green-50 border-green-300',
                tagClass: 'bg-green-100 text-green-700',
                icon: 'type'
            }
        };

        // ============================================================
        // 状态
        // ============================================================
        const phase = ref('intro');
        const currentTrialIndex = ref(-1);
        const trialList = ref([]);
        const currentTask = ref('number');     // 'number' | 'letter'
        const currentStimulus = ref('');
        const correctAnswerKey = ref('');       // 'left' | 'right'
        const showingBlank = ref(false);
        const responded = ref(false);
        const lastFeedback = ref(null);         // 'correct' | 'wrong' | null
        const trialStartTime = ref(0);

        const results = ref([]);
        let trialTimer = null;
        let blankTimer = null;
        let gameStartTime = 0;
        let isDestroyed = false;

        // ============================================================
        // 生成试次
        // ============================================================
        const generateTrials = () => {
            const { totalTrials, switchRatio } = config.value;
            const arr = [];
            let prevTask = Math.random() < 0.5 ? 'number' : 'letter';

            for (let i = 0; i < totalTrials; i++) {
                let task;
                if (i === 0) {
                    task = prevTask;
                } else {
                    task = Math.random() < switchRatio
                        ? (prevTask === 'number' ? 'letter' : 'number')
                        : prevTask;
                }
                const isSwitch = i > 0 && task !== prevTask;

                let stimulus, correctKey;
                if (task === 'number') {
                    const digit = DIGITS[Math.floor(Math.random() * DIGITS.length)];
                    stimulus = String(digit);
                    correctKey = digit % 2 === 1 ? 'left' : 'right'; // 奇=左, 偶=右
                } else {
                    const isVowel = Math.random() < 0.5;
                    const pool = isVowel ? VOWELS : CONSONANTS;
                    stimulus = pool[Math.floor(Math.random() * pool.length)];
                    correctKey = isVowel ? 'left' : 'right'; // 元音=左, 辅音=右
                }

                arr.push({ task, stimulus, correctKey, isSwitch });
                prevTask = task;
            }
            return arr;
        };

        // ============================================================
        // 游戏控制
        // ============================================================
        const startGame = () => {
            trialList.value = generateTrials();
            results.value = [];
            currentTrialIndex.value = -1;
            gameStartTime = performance.now();
            phase.value = 'playing';
            nextTrial();
        };

        const nextTrial = () => {
            if (isDestroyed) return;
            const nextIdx = currentTrialIndex.value + 1;

            if (currentTrialIndex.value >= 0 && !responded.value) {
                recordResponse(null);
            }

            if (nextIdx >= trialList.value.length) {
                endGame();
                return;
            }

            currentTrialIndex.value = nextIdx;
            const trial = trialList.value[nextIdx];
            currentTask.value = trial.task;
            currentStimulus.value = trial.stimulus;
            correctAnswerKey.value = trial.correctKey;
            showingBlank.value = false;
            responded.value = false;
            lastFeedback.value = null;
            trialStartTime.value = performance.now();

            trialTimer = setTimeout(() => {
                if (isDestroyed) return;
                showingBlank.value = true;
                blankTimer = setTimeout(() => {
                    if (isDestroyed) return;
                    nextTrial();
                }, config.value.interTrialInterval);
            }, config.value.stimulusDuration);
        };

        const handleResponse = (key) => {
            if (responded.value || phase.value !== 'playing' || showingBlank.value) return;
            responded.value = true;
            const correct = key === correctAnswerKey.value;
            lastFeedback.value = correct ? 'correct' : 'wrong';
            recordResponse(key);
        };

        const recordResponse = (key) => {
            const idx = currentTrialIndex.value;
            const trial = trialList.value[idx];
            const rt = key !== null ? Math.round(performance.now() - trialStartTime.value) : null;
            const correct = key !== null ? key === trial.correctKey : false;

            results.value.push({
                trial: idx,
                task: trial.task,
                stimulus: trial.stimulus,
                isSwitch: trial.isSwitch,
                correctKey: trial.correctKey,
                response: key,
                correct,
                rt
            });
        };

        const endGame = () => {
            if (!responded.value && currentTrialIndex.value >= 0) recordResponse(null);
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
        const switchAcc = computed(() => {
            const s = respondedResults.value.filter(r => r.isSwitch);
            if (s.length === 0) return 0;
            return Math.round((s.filter(r => r.correct).length / s.length) * 100);
        });
        const repeatAcc = computed(() => {
            const r = respondedResults.value.filter(r => !r.isSwitch);
            if (r.length === 0) return 0;
            return Math.round((r.filter(x => x.correct).length / r.length) * 100);
        });
        const avgRT = computed(() => {
            if (respondedResults.value.length === 0) return 0;
            return Math.round(respondedResults.value.reduce((s, r) => s + r.rt, 0) / respondedResults.value.length);
        });
        const switchRT = computed(() => {
            const s = respondedResults.value.filter(r => r.isSwitch);
            if (s.length === 0) return 0;
            return Math.round(s.reduce((sum, r) => sum + r.rt, 0) / s.length);
        });
        const repeatRT = computed(() => {
            const r = respondedResults.value.filter(r => !r.isSwitch);
            if (r.length === 0) return 0;
            return Math.round(r.reduce((sum, x) => sum + x.rt, 0) / r.length);
        });
        const switchCost = computed(() => switchRT.value - repeatRT.value);
        const progressPercent = computed(() => Math.round(((currentTrialIndex.value + 1) / config.value.totalTrials) * 100));

        // 当前任务配置
        const taskConfig = computed(() => TASKS[currentTask.value]);

        // 按钮标签
        const leftLabel = computed(() => currentTask.value === 'number' ? t('odd') : t('vowel'));
        const rightLabel = computed(() => currentTask.value === 'number' ? t('even') : t('consonant'));

        const finishGame = () => {
            clearTimeout(trialTimer);
            clearTimeout(blankTimer);
            emit('complete', {
                success: accuracy.value >= 60,
                totalTrials: config.value.totalTrials,
                accuracy: accuracy.value,
                switchAccuracy: switchAcc.value,
                repeatAccuracy: repeatAcc.value,
                avgResponseTime: avgRT.value,
                switchRT: switchRT.value,
                repeatRT: repeatRT.value,
                switchCost: switchCost.value,
                totalTime: Math.round(performance.now() - gameStartTime),
                trials: results.value
            });
        };

        const colorHintHtml = computed(() => {
            return t('colorHint') + ' <span class="text-blue-600 font-bold">' + t('blueNumber') + '</span> / <span class="text-green-600 font-bold">' + t('greenLetter') + '</span>';
        });

        onMounted(() => { if (window.lucide) window.lucide.createIcons(); });
        onUnmounted(() => { isDestroyed = true; clearTimeout(trialTimer); clearTimeout(blankTimer); });

        return {
            config, TASKS, phase, t, colorHintHtml,
            currentTrialIndex, currentTask, currentStimulus, showingBlank, responded,
            lastFeedback, taskConfig, leftLabel, rightLabel,
            accuracy, avgRT, switchAcc, repeatAcc, switchRT, repeatRT, switchCost, progressPercent,
            startGame, handleResponse, finishGame
        };
    },

    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-cyan-50 to-white">

        <!-- 顶部 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-cyan-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-cyan-100 p-3 rounded-xl">
                    <i data-lucide="shuffle" class="w-8 h-8 text-cyan-600"></i>
                </div>
                <div>
                    <span class="text-cyan-600 font-bold text-sm uppercase tracking-wider">{{ t('execFunctionTest') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ t('taskSwitching') }}</h2>
                </div>
            </div>
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-cyan-500 transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{{ t('trialPrefix') }} {{ currentTrialIndex + 1 }} / {{ config.totalTrials }} {{ t('trialSuffix') }}</span>
                    <span>{{ t('accuracyLabel') }}: {{ accuracy }}%</span>
                </div>
            </div>
        </div>

        <!-- 中间 -->
        <div class="flex-grow p-6 overflow-y-auto flex items-center justify-center">

            <!-- INTRO -->
            <div v-if="phase === 'intro'" class="text-center max-w-md">
                <div class="text-6xl mb-4">🔀</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('taskSwitchChallenge') }}</h3>
                <div class="bg-white rounded-2xl p-5 border border-cyan-200 shadow-sm text-left mb-6 space-y-3">
                    <p class="text-slate-600 leading-relaxed" v-html="t('introDesc')"></p>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-blue-50 rounded-xl p-3 border border-blue-200">
                            <p class="font-bold text-blue-700 text-sm mb-1">{{ t('numberTaskLabel') }}</p>
                            <p class="text-xs text-slate-600" v-html="t('numberTaskDesc')"></p>
                        </div>
                        <div class="bg-green-50 rounded-xl p-3 border border-green-200">
                            <p class="font-bold text-green-700 text-sm mb-1">{{ t('letterTaskLabel') }}</p>
                            <p class="text-xs text-slate-600" v-html="t('letterTaskDesc')"></p>
                        </div>
                    </div>
                    <p class="text-slate-600 text-sm" v-html="colorHintHtml"></p>
                    <p class="text-slate-500 text-sm">{{ t('stayFocused') }}</p>
                </div>
                <button @click="startGame"
                    class="bg-cyan-600 hover:bg-cyan-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#0e7490] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('startChallenge') }}
                </button>
            </div>

            <!-- PLAYING -->
            <div v-if="phase === 'playing'" class="text-center w-full max-w-md">

                <!-- 任务类型指示 -->
                <div class="mb-3">
                    <span class="inline-block px-4 py-1.5 rounded-full text-sm font-bold" :class="taskConfig.tagClass">
                        {{ t(taskConfig.nameKey) }} · {{ t(taskConfig.instrKey) }}
                    </span>
                </div>

                <!-- 刺激显示 -->
                <div class="w-44 h-44 mx-auto rounded-3xl flex items-center justify-center mb-6 transition-all duration-300 border-4"
                     :class="showingBlank
                        ? 'bg-slate-100 border-dashed border-slate-300'
                        : taskConfig.bgClass + ' shadow-lg'">
                    <span v-if="!showingBlank"
                          class="text-7xl font-black text-slate-800 select-none"
                          style="font-family: 'Courier New', monospace;">
                        {{ currentStimulus }}
                    </span>
                    <span v-else class="text-slate-400 text-lg">...</span>
                </div>

                <!-- 即时反馈小标记 -->
                <div v-if="lastFeedback" class="mb-3">
                    <span class="text-2xl">{{ lastFeedback === 'correct' ? '✓' : '✗' }}</span>
                </div>

                <!-- 响应按钮 -->
                <div class="flex gap-4 justify-center"
                     :class="{ 'opacity-30 pointer-events-none': showingBlank || responded }">
                    <button @click="handleResponse('left')"
                        class="flex-1 max-w-[180px] text-white rounded-xl font-black text-xl py-5
                               active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                        :class="currentTask === 'number'
                            ? 'bg-blue-500 hover:bg-blue-600 shadow-[0_4px_0_#1d4ed8]'
                            : 'bg-green-500 hover:bg-green-600 shadow-[0_4px_0_#15803d]'">
                        {{ leftLabel }}
                    </button>
                    <button @click="handleResponse('right')"
                        class="flex-1 max-w-[180px] text-white rounded-xl font-black text-xl py-5
                               active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                        :class="currentTask === 'number'
                            ? 'bg-blue-500 hover:bg-blue-600 shadow-[0_4px_0_#1d4ed8]'
                            : 'bg-green-500 hover:bg-green-600 shadow-[0_4px_0_#15803d]'">
                        {{ rightLabel }}
                    </button>
                </div>
            </div>

            <!-- FEEDBACK -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">🔀</div>
                <h3 class="text-2xl font-black text-slate-800 mb-1">{{ t('taskSwitchComplete') }}</h3>
                <p class="text-slate-500 mb-5">{{ t('execCogFlex') }}</p>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="bg-cyan-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-cyan-700">{{ accuracy }}%</div>
                            <div class="text-xs text-cyan-500 font-bold">{{ t('overallAccuracy') }}</div>
                        </div>
                        <div class="bg-blue-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-blue-700">{{ avgRT }}ms</div>
                            <div class="text-xs text-blue-500 font-bold">{{ t('avgResponseTime') }}</div>
                        </div>
                    </div>

                    <div class="bg-slate-50 rounded-xl p-4 space-y-2">
                        <p class="text-sm font-bold text-slate-600">{{ t('switchCostAnalysis') }}</p>
                        <div class="flex justify-between text-sm">
                            <span class="text-green-600">{{ t('repeatCondition') }}: {{ repeatAcc }}% / {{ repeatRT }}ms</span>
                            <span class="text-amber-600">{{ t('switchCondition') }}: {{ switchAcc }}% / {{ switchRT }}ms</span>
                        </div>
                        <div class="text-center">
                            <span class="text-lg font-black" :class="switchCost > 0 ? 'text-amber-600' : 'text-green-600'">
                                {{ t('switchCostLabel') }}: {{ switchCost > 0 ? '+' : '' }}{{ switchCost }}ms
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部 -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            <div v-if="phase === 'playing'" class="text-center text-slate-400 text-sm">
                {{ t('footerHint') }}
            </div>
            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('done') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.TaskSwitchGame = TaskSwitchGame;
