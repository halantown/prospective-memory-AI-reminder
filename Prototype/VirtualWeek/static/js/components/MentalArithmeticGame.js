/**
 * 心算连锁游戏 (Mental Arithmetic Chain)
 * 高认知负荷：连续心算，需要保持中间结果在工作记忆中
 * 
 * 流程：给出一个起始数字，然后连续执行加减乘运算
 * 玩家在最终选择正确答案
 */
const MentalArithmeticGame = {
    name: 'MentalArithmeticGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted } = Vue;

        const defaultScenario = {
            totalRounds: 5,
            difficulty: 'medium',   // 'easy' | 'medium' | 'hard'
            timePerRound: 15,       // 秒
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        const TEXTS = {
            headerTag:       { zh: '心算挑战',   en: 'Mental Math',              nl: 'Hoofdrekenen' },
            headerTitle:     { zh: '连锁运算',   en: 'Chain Calculation',        nl: 'Kettingberekening' },
            roundPrefix:     { zh: '第',         en: 'Question',                 nl: 'Vraag' },
            roundSuffix:     { zh: '题',         en: '',                         nl: '' },
            correctCount:    { zh: '正确:',      en: 'Correct:',                 nl: 'Correct:' },
            introTitle:      { zh: '心算连锁',   en: 'Mental Arithmetic Chain',  nl: 'Hoofdreken Ketting' },
            introDesc: {
                zh: '屏幕上会显示一个<strong class="text-amber-700">起始数字</strong>，然后依次出现<strong class="text-amber-700">运算步骤</strong>。请在心中计算，最后选出<strong class="text-amber-700">正确答案</strong>。',
                en: 'A <strong class="text-amber-700">starting number</strong> will appear on screen, followed by <strong class="text-amber-700">calculation steps</strong>. Calculate mentally and select the <strong class="text-amber-700">correct answer</strong>.',
                nl: 'Er verschijnt een <strong class="text-amber-700">startgetal</strong> op het scherm, gevolgd door <strong class="text-amber-700">rekenstappen</strong>. Reken in je hoofd en kies het <strong class="text-amber-700">juiste antwoord</strong>.'
            },
            exampleLabel:    { zh: '示例：',     en: 'Example:',                 nl: 'Voorbeeld:' },
            exampleAnswer: {
                zh: '答案: 8 + 5 = 13, 13 × 2 = <strong>26</strong>',
                en: 'Answer: 8 + 5 = 13, 13 × 2 = <strong>26</strong>',
                nl: 'Antwoord: 8 + 5 = 13, 13 × 2 = <strong>26</strong>'
            },
            timeLimitPrefix: { zh: '每题限时',   en: 'Time limit:',              nl: 'Tijdslimiet:' },
            timeLimitSuffix: { zh: '秒',         en: 'seconds',                  nl: 'seconden' },
            startButton:     { zh: '开始挑战',   en: 'Start Challenge',          nl: 'Start Uitdaging' },
            timeoutMsg:      { zh: '⏰ 时间到！答案是', en: '⏰ Time\'s up! Answer:', nl: '⏰ Tijd is om! Antwoord:' },
            excellent:       { zh: '计算高手！',  en: 'Math Master!',             nl: 'Rekenwonder!' },
            good:            { zh: '表现不错！',  en: 'Well Done!',               nl: 'Goed Gedaan!' },
            needsPractice:   { zh: '继续努力！',  en: 'Keep Practicing!',         nl: 'Blijf Oefenen!' },
            mentalChain:     { zh: '心算连锁',   en: 'Mental Arithmetic Chain',  nl: 'Hoofdreken Ketting' },
            easy:            { zh: '简单',       en: 'Easy',                     nl: 'Makkelijk' },
            medium:          { zh: '中等',       en: 'Medium',                   nl: 'Gemiddeld' },
            hard:            { zh: '困难',       en: 'Hard',                     nl: 'Moeilijk' },
            accuracyLabel:   { zh: '正确率',     en: 'Accuracy',                 nl: 'Nauwkeurigheid' },
            correctTotal:    { zh: '正确题数',   en: 'Correct Answers',          nl: 'Juiste Antwoorden' },
            footerHint:      { zh: '在心中依次运算，选择最终结果', en: 'Calculate step by step mentally, select the final result', nl: 'Reken stap voor stap in je hoofd, kies het eindresultaat' },
            finishButton:    { zh: '完成',       en: 'Finish',                   nl: 'Voltooien' },
        };
        const lang = computed(() => config.value.lang || 'zh');
        const t = (key) => TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;

        // ============================================================
        // 状态
        // ============================================================
        const phase = ref('intro');
        const currentRound = ref(0);
        const chainSteps = ref([]);       // 当前题的运算链
        const correctAnswer = ref(0);
        const options = ref([]);          // 选项
        const selectedAnswer = ref(null);
        const roundResult = ref(null);    // 'correct' | 'wrong' | 'timeout' | null
        const timeLeft = ref(0);
        let timer = null;
        let gameStartTime = 0;

        // 统计
        const roundResults = ref([]);
        const totalCorrect = ref(0);
        const totalTime = ref(0);

        // ============================================================
        // 题目生成
        // ============================================================
        const difficultyConfig = {
            easy:   { startRange: [2, 15],  ops: ['+', '-'],      operandRange: [1, 9],  chainLen: 2 },
            medium: { startRange: [5, 30],  ops: ['+', '-', '×'], operandRange: [2, 12], chainLen: 3 },
            hard:   { startRange: [10, 50], ops: ['+', '-', '×'], operandRange: [2, 15], chainLen: 4 }
        };

        const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        const generateRound = () => {
            const dc = difficultyConfig[config.value.difficulty] || difficultyConfig.medium;
            let value = randInt(dc.startRange[0], dc.startRange[1]);
            const steps = [{ display: String(value), value }];

            for (let i = 0; i < dc.chainLen; i++) {
                const op = dc.ops[randInt(0, dc.ops.length - 1)];
                let operand = randInt(dc.operandRange[0], dc.operandRange[1]);

                // 避免减法出现负数
                if (op === '-' && operand > value) operand = randInt(1, Math.max(1, value - 1));
                // 乘法限制范围
                if (op === '×') operand = randInt(2, 5);

                let newValue;
                if (op === '+') newValue = value + operand;
                else if (op === '-') newValue = value - operand;
                else newValue = value * operand;

                steps.push({ display: `${op} ${operand}`, value: newValue });
                value = newValue;
            }

            return { steps, answer: value };
        };

        const generateOptions = (correct) => {
            const opts = new Set([correct]);
            const offsets = [-3, -2, -1, 1, 2, 3, -5, 5, -10, 10];
            while (opts.size < 4) {
                const offset = offsets[randInt(0, offsets.length - 1)];
                opts.add(correct + offset);
            }
            return [...opts].sort(() => Math.random() - 0.5);
        };

        // ============================================================
        // 游戏流程
        // ============================================================
        const startGame = () => {
            phase.value = 'playing';
            currentRound.value = 0;
            roundResults.value = [];
            totalCorrect.value = 0;
            gameStartTime = performance.now();
            nextRound();
        };

        const nextRound = () => {
            if (currentRound.value >= config.value.totalRounds) {
                endGame();
                return;
            }
            const round = generateRound();
            chainSteps.value = round.steps;
            correctAnswer.value = round.answer;
            options.value = generateOptions(round.answer);
            selectedAnswer.value = null;
            roundResult.value = null;
            timeLeft.value = config.value.timePerRound;
            currentRound.value++;

            startTimer();
        };

        const startTimer = () => {
            clearInterval(timer);
            timer = setInterval(() => {
                timeLeft.value--;
                if (timeLeft.value <= 0) {
                    clearInterval(timer);
                    handleTimeout();
                }
            }, 1000);
        };

        const handleTimeout = () => {
            roundResult.value = 'timeout';
            roundResults.value.push({
                round: currentRound.value,
                steps: chainSteps.value.map(s => s.display).join(' '),
                correctAnswer: correctAnswer.value,
                selected: null,
                correct: false,
                rt: null
            });
            setTimeout(nextRound, 1200);
        };

        const selectOption = (opt) => {
            if (selectedAnswer.value !== null || roundResult.value) return;
            clearInterval(timer);
            selectedAnswer.value = opt;
            const correct = opt === correctAnswer.value;
            roundResult.value = correct ? 'correct' : 'wrong';
            if (correct) totalCorrect.value++;

            roundResults.value.push({
                round: currentRound.value,
                steps: chainSteps.value.map(s => s.display).join(' '),
                correctAnswer: correctAnswer.value,
                selected: opt,
                correct,
                rt: Math.round(performance.now() - gameStartTime)
            });

            setTimeout(nextRound, 1000);
        };

        const endGame = () => {
            clearInterval(timer);
            totalTime.value = Math.round(performance.now() - gameStartTime);
            phase.value = 'feedback';
        };

        // ============================================================
        // 计算属性
        // ============================================================
        const accuracy = computed(() => {
            if (config.value.totalRounds === 0) return 0;
            return Math.round((totalCorrect.value / config.value.totalRounds) * 100);
        });
        const progressPercent = computed(() => Math.round((currentRound.value / config.value.totalRounds) * 100));
        const performanceLevel = computed(() => {
            if (accuracy.value >= 80) return 'excellent';
            if (accuracy.value >= 50) return 'good';
            return 'needsPractice';
        });

        const finishGame = () => {
            clearInterval(timer);
            emit('complete', {
                success: accuracy.value >= 50,
                difficulty: config.value.difficulty,
                totalRounds: config.value.totalRounds,
                accuracy: accuracy.value,
                totalCorrect: totalCorrect.value,
                totalTime: totalTime.value,
                rounds: roundResults.value
            });
        };

        onMounted(() => { if (window.lucide) window.lucide.createIcons(); });
        onUnmounted(() => clearInterval(timer));

        return {
            config, phase, currentRound, chainSteps, correctAnswer, options,
            selectedAnswer, roundResult, timeLeft, totalCorrect,
            accuracy, progressPercent, performanceLevel,
            startGame, selectOption, finishGame, t
        };
    },

    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-amber-50 to-white">

        <!-- 顶部 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-amber-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-amber-100 p-3 rounded-xl">
                    <i data-lucide="calculator" class="w-8 h-8 text-amber-600"></i>
                </div>
                <div>
                    <span class="text-amber-600 font-bold text-sm uppercase tracking-wider">{{ t('headerTag') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ t('headerTitle') }}</h2>
                </div>
            </div>
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-amber-500 transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{{ t('roundPrefix') }} {{ currentRound }} / {{ config.totalRounds }} {{ t('roundSuffix') }}</span>
                    <span>{{ t('correctCount') }} {{ totalCorrect }}</span>
                </div>
            </div>
        </div>

        <!-- 中间 -->
        <div class="flex-grow p-6 overflow-y-auto flex items-center justify-center">

            <!-- INTRO -->
            <div v-if="phase === 'intro'" class="text-center max-w-md">
                <div class="text-6xl mb-4">🧮</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('introTitle') }}</h3>
                <div class="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm text-left mb-6 space-y-3">
                    <p class="text-slate-600 leading-relaxed" v-html="t('introDesc')"></p>
                    <div class="bg-amber-50 rounded-xl p-4">
                        <p class="text-sm font-bold text-amber-700 mb-2">{{ t('exampleLabel') }}</p>
                        <div class="flex items-center gap-2 text-lg font-mono flex-wrap">
                            <span class="bg-white px-3 py-1 rounded border font-bold">8</span>
                            <span class="text-amber-600">→</span>
                            <span class="bg-white px-3 py-1 rounded border">+ 5</span>
                            <span class="text-amber-600">→</span>
                            <span class="bg-white px-3 py-1 rounded border">× 2</span>
                            <span class="text-amber-600">→</span>
                            <span class="bg-green-100 px-3 py-1 rounded border-2 border-green-500 font-bold">= ?</span>
                        </div>
                        <p class="text-sm text-slate-500 mt-2" v-html="t('exampleAnswer')"></p>
                    </div>
                    <p class="text-slate-500 text-sm">⏱ {{ t('timeLimitPrefix') }} {{ config.timePerRound }} {{ t('timeLimitSuffix') }}</p>
                </div>
                <button @click="startGame"
                    class="bg-amber-600 hover:bg-amber-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#92400e] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('startButton') }}
                </button>
            </div>

            <!-- PLAYING -->
            <div v-if="phase === 'playing'" class="text-center w-full max-w-md">
                <!-- 倒计时 -->
                <div class="mb-4">
                    <span class="text-4xl font-black" :class="timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'">
                        {{ timeLeft }}s
                    </span>
                </div>

                <!-- 运算链 -->
                <div class="flex items-center justify-center gap-2 flex-wrap mb-8">
                    <template v-for="(step, idx) in chainSteps" :key="idx">
                        <span v-if="idx > 0" class="text-amber-400 text-xl">→</span>
                        <span class="bg-white px-4 py-2 rounded-xl border-2 text-xl font-mono font-bold"
                              :class="idx === 0 ? 'border-amber-400 text-amber-700' : 'border-slate-200 text-slate-700'">
                            {{ step.display }}
                        </span>
                    </template>
                    <span class="text-amber-400 text-xl">→</span>
                    <span class="bg-amber-100 px-4 py-2 rounded-xl border-2 border-amber-400 text-xl font-black text-amber-700">= ?</span>
                </div>

                <!-- 选项 -->
                <div class="grid grid-cols-2 gap-3">
                    <button v-for="opt in options" :key="opt" @click="selectOption(opt)"
                        class="py-4 rounded-xl font-black text-2xl border-2 transition-all"
                        :class="[
                            selectedAnswer === null ? 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-lg active:scale-95' : '',
                            selectedAnswer === opt && roundResult === 'correct' ? 'bg-green-100 border-green-500 text-green-700' : '',
                            selectedAnswer === opt && roundResult === 'wrong' ? 'bg-red-100 border-red-500 text-red-700' : '',
                            selectedAnswer !== null && opt === correctAnswer && selectedAnswer !== opt ? 'bg-green-50 border-green-300' : '',
                            selectedAnswer !== null && selectedAnswer !== opt && opt !== correctAnswer ? 'opacity-40' : ''
                        ]"
                        :disabled="selectedAnswer !== null">
                        {{ opt }}
                    </button>
                </div>

                <!-- 超时反馈 -->
                <div v-if="roundResult === 'timeout'" class="mt-4 text-red-500 font-bold text-lg animate-pulse">
                    {{ t('timeoutMsg') }} {{ correctAnswer }}
                </div>
            </div>

            <!-- FEEDBACK -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">
                    {{ performanceLevel === 'excellent' ? '🏆' : performanceLevel === 'good' ? '👍' : '💪' }}
                </div>
                <h3 class="text-2xl font-black mb-1"
                    :class="performanceLevel === 'excellent' ? 'text-green-600'
                          : performanceLevel === 'good' ? 'text-blue-600' : 'text-amber-600'">
                    {{ performanceLevel === 'excellent' ? t('excellent')
                     : performanceLevel === 'good' ? t('good') : t('needsPractice') }}
                </h3>
                <p class="text-slate-500 mb-5">{{ t('mentalChain') }} · {{ t(config.difficulty) }}</p>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-amber-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-amber-700">{{ accuracy }}%</div>
                            <div class="text-xs text-amber-500 font-bold">{{ t('accuracyLabel') }}</div>
                        </div>
                        <div class="bg-green-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-green-700">{{ totalCorrect }}/{{ config.totalRounds }}</div>
                            <div class="text-xs text-green-500 font-bold">{{ t('correctTotal') }}</div>
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
                    class="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finishButton') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.MentalArithmeticGame = MentalArithmeticGame;
