/**
 * 家务优先级排序游戏
 * 选择最应该先做的事情
 */
const PriorityGame = {
    name: 'PriorityGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, computed, onMounted } = Vue;
        
        const TEXTS = {
            headerLabel:        { zh: '优先级判断', en: 'Priority Judgment', nl: 'Prioriteitsbeoordeling' },
            urgent:             { zh: '紧急', en: 'Urgent', nl: 'Dringend' },
            recommendedFirst:   { zh: '建议优先处理', en: 'Recommended to handle first', nl: 'Aanbevolen om eerst te doen' },
            clickToSelect:      { zh: '点击选择你会先做的事情', en: 'Click to select what you would do first', nl: 'Klik om te kiezen wat je eerst zou doen' },
            goodChoice:         { zh: '很好的选择！', en: 'Great choice!', nl: 'Goede keuze!' },
            alsoChoice:         { zh: '也是一种选择', en: "That's also a choice", nl: 'Dat is ook een keuze' },
            responseTime:       { zh: '反应时间: {0}秒', en: 'Response time: {0}s', nl: 'Reactietijd: {0}s' },
            done:               { zh: '完成', en: 'Done', nl: 'Klaar' }
        };
        const lang = computed(() => (props.scenario?.lang) || 'zh');
        const t = (key, params = {}) => {
            let text = TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
            Object.entries(params).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, v); });
            return text;
        };
        const tr = (obj) => typeof obj === 'string' ? obj : (obj?.[lang.value] || obj?.en || '');

        const defaultScenario = {
            instruction: {
                zh: "你现在只有5分钟，以下事情该先做哪一个？",
                en: "You only have 5 minutes. Which should you do first?",
                nl: "Je hebt maar 5 minuten. Wat moet je eerst doen?"
            },
            context: {
                zh: "你正准备出门，突然发现...",
                en: "You're about to leave when you suddenly notice…",
                nl: "Je staat op het punt te vertrekken wanneer je plotseling merkt…"
            },
            tasks: [
                { 
                    id: 1, 
                    title: { zh: "垃圾袋破了", en: "The trash bag broke", nl: "De vuilniszak is gescheurd" },
                    description: { zh: "厨房地上有垃圾", en: "There's trash on the kitchen floor", nl: "Er ligt afval op de keukenvloer" },
                    icon: "trash-2",
                    urgency: "medium",
                    color: "bg-amber-100 text-amber-600"
                },
                { 
                    id: 2, 
                    title: { zh: "水壶在烧水", en: "The kettle is boiling", nl: "De waterkoker kookt" },
                    description: { zh: "已经快开了", en: "It's almost boiling over", nl: "Het kookt bijna over" },
                    icon: "flame",
                    urgency: "high",
                    color: "bg-red-100 text-red-600"
                },
                { 
                    id: 3, 
                    title: { zh: "门铃响了", en: "The doorbell rang", nl: "De deurbel gaat" },
                    description: { zh: "不知道是谁", en: "Don't know who it is", nl: "Je weet niet wie het is" },
                    icon: "bell-ring",
                    urgency: "medium",
                    color: "bg-blue-100 text-blue-600"
                }
            ],
            // 没有唯一正确答案，但记录选择
            recommendedId: 2,
            explanation: {
                zh: "水壶快开了需要立即处理，否则可能干烧危险",
                en: "The kettle is about to boil over and needs immediate attention to avoid a fire hazard",
                nl: "De waterkoker kookt bijna over en moet direct worden aangepakt om brandgevaar te voorkomen"
            }
        };
        
        const gameData = ref({ ...defaultScenario, ...(props.scenario || {}) });
        const phase = ref('playing');
        const selectedTask = ref(null);
        const isRecommended = ref(null);
        const responseTime = ref(0);
        let startTime = 0;
        
        onMounted(() => {
            startTime = performance.now();
            if (window.lucide) window.lucide.createIcons();
        });
        
        const selectTask = (task) => {
            responseTime.value = Math.round(performance.now() - startTime);
            selectedTask.value = task.id;
            isRecommended.value = (task.id === gameData.value.recommendedId);
            phase.value = 'feedback';
        };
        
        const finishGame = () => {
            emit('complete', {
                success: true, // 没有错误答案
                isRecommended: isRecommended.value,
                responseTime: responseTime.value,
                selectedTask: selectedTask.value
            });
        };
        
        return {
            gameData, phase, selectedTask, isRecommended, responseTime,
            selectTask, finishGame, t, tr
        };
    },
    
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-orange-50 to-white">
        <!-- 顶部说明 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-orange-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-orange-100 p-3 rounded-xl">
                    <i data-lucide="list-ordered" class="w-8 h-8 text-orange-600"></i>
                </div>
                <div>
                    <span class="text-orange-600 font-bold text-sm uppercase tracking-wider">{{ t('headerLabel') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ tr(gameData.instruction) }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 情境说明 -->
        <div class="px-6 pt-4">
            <div class="bg-slate-100 rounded-xl p-4 border border-slate-200">
                <p class="text-slate-700 font-bold text-lg">{{ tr(gameData.context) }}</p>
            </div>
        </div>
        
        <!-- 任务选择 -->
        <div class="flex-grow p-6 overflow-y-auto">
            <div class="space-y-4">
                <div v-for="task in gameData.tasks" :key="task.id"
                     @click="phase === 'playing' && selectTask(task)"
                     class="bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all"
                     :class="[
                         phase === 'playing' ? 'border-slate-200 hover:border-orange-400 hover:shadow-lg active:scale-[0.98]' : '',
                         selectedTask === task.id ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-100' : '',
                         phase === 'feedback' && task.id === gameData.recommendedId && selectedTask !== task.id ? 'border-green-300' : ''
                     ]">
                    <div class="flex items-center gap-4">
                        <div :class="[task.color, 'p-4 rounded-xl']">
                            <i :data-lucide="task.icon" class="w-8 h-8"></i>
                        </div>
                        <div class="flex-grow">
                            <h3 class="text-xl font-black text-slate-800">{{ tr(task.title) }}</h3>
                            <p class="text-slate-500 font-medium">{{ tr(task.description) }}</p>
                        </div>
                        <div v-if="task.urgency === 'high'" class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            {{ t('urgent') }}
                        </div>
                    </div>
                    
                    <div v-if="phase === 'feedback' && task.id === gameData.recommendedId" 
                         class="mt-3 text-green-600 font-bold flex items-center gap-2 pt-3 border-t border-slate-100">
                        <i data-lucide="lightbulb" class="w-5 h-5"></i> {{ t('recommendedFirst') }}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 底部 -->
        <div class="bg-white/95 backdrop-blur p-5 border-t border-slate-100 shrink-0">
            <div v-if="phase === 'playing'" class="text-center text-slate-500 font-medium">
                {{ t('clickToSelect') }}
            </div>
            
            <div v-if="phase === 'feedback'" class="text-center">
                <div class="mb-4">
                    <span class="text-3xl">{{ isRecommended ? '👍' : '🤔' }}</span>
                    <h3 class="text-xl font-black mt-2 text-slate-700">
                        {{ isRecommended ? t('goodChoice') : t('alsoChoice') }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ tr(gameData.explanation) }}</p>
                    <p class="text-slate-400 text-sm mt-1">{{ t('responseTime', {0: (responseTime / 1000).toFixed(1)}) }}</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('done') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.PriorityGame = PriorityGame;
