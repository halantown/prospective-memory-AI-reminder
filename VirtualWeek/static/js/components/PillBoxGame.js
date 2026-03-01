/**
 * 药盒异常检测游戏
 * 判断药盒配置是否有问题（剂量不对/重复/缺失）
 */
const PillBoxGame = {
    name: 'PillBoxGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, computed, onMounted } = Vue;
        
        // 默认场景数据
        const defaultScenario = {
            instruction: "这是今天的药盒配置，请判断是否有问题",
            pillBox: {
                morning: [
                    { name: "降压药", dose: "1片", color: "bg-red-400" },
                    { name: "维生素", dose: "1片", color: "bg-yellow-400" }
                ],
                noon: [
                    { name: "降压药", dose: "1片", color: "bg-red-400" }
                ],
                evening: [
                    { name: "降压药", dose: "2片", color: "bg-red-400" },  // 错误：剂量不对
                    { name: "维生素", dose: "1片", color: "bg-yellow-400" }
                ]
            },
            hasError: true,
            errorExplanation: "晚上的降压药剂量应该是1片，不是2片"
        };
        
        const gameData = ref({ ...defaultScenario, ...(props.scenario || {}) });

        const TEXTS = {
            pillBoxCheck: { zh: '药盒检查', en: 'Pill Box Check', nl: 'Pillendoos Controle' },
            morning: { zh: '早上', en: 'Morning', nl: 'Ochtend' },
            noon: { zh: '中午', en: 'Noon', nl: 'Middag' },
            evening: { zh: '晚上', en: 'Evening', nl: 'Avond' },
            none: { zh: '无', en: 'None', nl: 'Geen' },
            questionPrompt: { zh: '这个药盒配置有问题吗？', en: 'Is there a problem with this pill box?', nl: 'Is er een probleem met deze pillendoos?' },
            noProblem: { zh: '没问题', en: 'No Problem', nl: 'Geen Probleem' },
            hasProblem: { zh: '有问题', en: 'Has Problem', nl: 'Heeft Probleem' },
            correct: { zh: '判断正确！', en: 'Correct!', nl: 'Correct!' },
            incorrect: { zh: '判断错误', en: 'Incorrect', nl: 'Onjuist' },
            responseTime: { zh: '反应时间', en: 'Response time', nl: 'Reactietijd' },
            seconds: { zh: '秒', en: 's', nl: 's' },
            done: { zh: '完成', en: 'Done', nl: 'Klaar' }
        };
        const lang = computed(() => (props.scenario?.lang) || 'zh');
        const t = (key) => TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
        const tr = (obj) => typeof obj === 'string' ? obj : (obj?.[lang.value] || obj?.en || '');

        const phase = ref('playing');
        const selectedAnswer = ref(null);
        const isCorrect = ref(null);
        const responseTime = ref(0);
        let startTime = 0;
        
        onMounted(() => {
            startTime = performance.now();
            if (window.lucide) window.lucide.createIcons();
        });
        
        const submitAnswer = (hasError) => {
            responseTime.value = Math.round(performance.now() - startTime);
            selectedAnswer.value = hasError;
            isCorrect.value = (hasError === gameData.value.hasError);
            phase.value = 'feedback';
        };
        
        const finishGame = () => {
            emit('complete', {
                success: isCorrect.value,
                responseTime: responseTime.value,
                selectedAnswer: selectedAnswer.value,
                correctAnswer: gameData.value.hasError
            });
        };
        
        return {
            gameData, phase, selectedAnswer, isCorrect, responseTime,
            submitAnswer, finishGame, t, tr
        };
    },
    
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-teal-50 to-white">
        <!-- 顶部说明 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-teal-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-teal-100 p-3 rounded-xl">
                    <i data-lucide="pill" class="w-8 h-8 text-teal-600"></i>
                </div>
                <div>
                    <span class="text-teal-600 font-bold text-sm uppercase tracking-wider">{{ t('pillBoxCheck') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ tr(gameData.instruction) }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 药盒显示 -->
        <div class="flex-grow p-6 overflow-y-auto">
            <div class="max-w-lg mx-auto space-y-4">
                <!-- 早中晚三个格子 -->
                <div v-for="(pills, time) in gameData.pillBox" :key="time" 
                     class="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
                    <div class="flex items-center gap-3 mb-3">
                        <span class="text-2xl">{{ time === 'morning' ? '🌅' : time === 'noon' ? '☀️' : '🌙' }}</span>
                        <span class="font-black text-lg text-slate-700">
                            {{ t(time) }}
                        </span>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <div v-for="(pill, idx) in pills" :key="idx"
                             class="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                            <div :class="[pill.color, 'w-4 h-4 rounded-full']"></div>
                            <span class="font-bold text-slate-700">{{ tr(pill.name) }}</span>
                            <span class="text-slate-500 font-medium">{{ tr(pill.dose) }}</span>
                        </div>
                        <div v-if="pills.length === 0" class="text-slate-400 italic">{{ t('none') }}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 底部按钮 -->
        <div class="bg-white/95 backdrop-blur p-5 border-t border-slate-100 shrink-0">
            <!-- 选择阶段 -->
            <div v-if="phase === 'playing'" class="space-y-3">
                <p class="text-center text-slate-600 font-bold text-lg mb-4">{{ t('questionPrompt') }}</p>
                <div class="flex gap-4">
                    <button @click="submitAnswer(false)" 
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="check" class="w-6 h-6"></i> {{ t('noProblem') }}
                    </button>
                    <button @click="submitAnswer(true)" 
                        class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#b91c1c] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="x" class="w-6 h-6"></i> {{ t('hasProblem') }}
                    </button>
                </div>
            </div>
            
            <!-- 反馈阶段 -->
            <div v-if="phase === 'feedback'" class="text-center">
                <div class="mb-4">
                    <span v-if="isCorrect" class="text-3xl">✅</span>
                    <span v-else class="text-3xl">❌</span>
                    <h3 class="text-xl font-black mt-2" :class="isCorrect ? 'text-green-600' : 'text-red-600'">
                        {{ isCorrect ? t('correct') : t('incorrect') }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ tr(gameData.errorExplanation) }}</p>
                    <p class="text-slate-400 text-sm mt-1">{{ t('responseTime') }}: {{ (responseTime / 1000).toFixed(1) }}{{ t('seconds') }}</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('done') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.PillBoxGame = PillBoxGame;
