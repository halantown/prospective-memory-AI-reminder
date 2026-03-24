// SupermarketGame.js
// 这是一个符合 Vue 3 组件规范的对象
const SupermarketGame = {
    name: 'SupermarketGame',
    props: ['scenario'], // 接收从主界面传来的场景数据
    emits: ['complete'], // 定义结束事件
    setup(props, { emit }) {
        const { ref, computed, onMounted } = Vue;
        
        // 内部状态
        const selectionMode = ref(false);
        const selectedItemId = ref(null);
        const result = ref(null);
        const feedbackMessage = ref('');
        
        // 数据准备 (内部默认值 + 外部场景数据合并)
        const defaultGameData = {
            context: "准备做一份水果沙拉招待朋友",
            items: [
                { id: 101, name: "红苹果", emoji: "🍎", isReasonable: true },
                { id: 102, name: "甜香蕉", emoji: "🍌", isReasonable: true },
                { id: 103, name: "大蒜头", emoji: "🧄", isReasonable: false },
            ]
        };
        const gameData = ref({ ...defaultGameData, ...(props.scenario || {}) });

        // i18n
        const TEXTS = {
            taskLabel:       { zh: '目标任务',             en: 'Objective',                    nl: 'Doel' },
            allReasonable:   { zh: '完全合理',             en: 'All reasonable',               nl: 'Allemaal logisch' },
            notReasonable:   { zh: '不太合理',             en: 'Something wrong',              nl: 'Iets klopt niet' },
            selectPrompt:    { zh: '请点击一个不合理的商品', en: 'Click an unreasonable item',    nl: 'Klik op een onlogisch item' },
            back:            { zh: '返回',                 en: 'Back',                         nl: 'Terug' },
            confirmBtn:      { zh: '确认这是不合理的',      en: 'Confirm unreasonable',          nl: 'Bevestig onlogisch' },
            correctTitle:    { zh: '✅ 判断正确！',         en: '✅ Correct!',                   nl: '✅ Juist!' },
            wrongTitle:      { zh: '🤔 再想一想...',        en: '🤔 Think again...',             nl: '🤔 Denk nog eens na...' },
            allLookGood:     { zh: '看起来确实都很合理！',   en: 'They all look reasonable!',     nl: 'Ze zien er allemaal logisch uit!' },
            somethingOdd:    { zh: '再仔细看看，好像混进了奇怪的东西？', en: 'Look again, something odd might be mixed in.', nl: 'Kijk nog eens, er zit misschien iets vreemds tussen.' },
            finishGame:      { zh: '完成任务',             en: 'Finish',                       nl: 'Voltooien' },
            retry:           { zh: '重试',                 en: 'Retry',                        nl: 'Opnieuw' },
        };
        const lang = computed(() => (props.scenario?.lang) || 'zh');
        const t = (key) => TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
        const tr = (obj) => typeof obj === 'string' ? obj : (obj?.[lang.value] || obj?.en || '');

        // 动画控制
        onMounted(() => {
            // 初始化动画状态
            gameData.value.items.forEach(i => i.isPop = false);
            setTimeout(() => {
                gameData.value.items.forEach(i => i.isPop = true);
            }, 100);
            
            // 刷新图标
            if(window.lucide) window.lucide.createIcons();
        });

        // 逻辑方法
        const chooseReasonable = () => {
            const hasUnreasonable = gameData.value.items.some(i => !i.isReasonable);
            if (!hasUnreasonable) {
                result.value = 'correct';
                feedbackMessage.value = t('allLookGood');
            } else {
                result.value = 'wrong';
                feedbackMessage.value = t('somethingOdd');
            }
        };

        const enterSelectionMode = () => { selectionMode.value = true; };

        const handleItemClick = (item) => {
            if (!selectionMode.value) return;
            selectedItemId.value = item.id;
        };

        const confirmUnreasonable = () => {
            if (!selectedItemId.value) return;
            const item = gameData.value.items.find(i => i.id === selectedItemId.value);
            if (!item.isReasonable) {
                result.value = 'correct';
                const ctx = tr(gameData.value.context);
                const name = tr(item.name);
                feedbackMessage.value = lang.value === 'nl'
                    ? `Klopt! Voor ${ctx} heb je "${name}" niet nodig.`
                    : lang.value === 'en'
                    ? `Correct! ${ctx} doesn't need "${name}".`
                    : `没错！${ctx} 不需要"${name}"。`;
            } else {
                result.value = 'wrong';
                const name = tr(item.name);
                feedbackMessage.value = lang.value === 'nl'
                    ? `"${name}" kan in dit scenario nuttig zijn.`
                    : lang.value === 'en'
                    ? `"${name}" could be useful in this scenario.`
                    : `"${name}" 在这个场景下是可能有用的。`;
            }
        };

        const cancelSelection = () => { selectionMode.value = false; selectedItemId.value = null; };
        const retry = () => { result.value = null; selectionMode.value = false; selectedItemId.value = null; };

        const finishGame = () => {
            // 触发完成事件，传回结果
            emit('complete', { success: true });
        };

        return {
            gameData, selectionMode, selectedItemId, result, feedbackMessage,
            chooseReasonable, enterSelectionMode, handleItemClick, 
            confirmUnreasonable, cancelSelection, retry, finishGame,
            t, tr
        };
    },
    template: `
    <div class="h-full flex flex-col relative bg-transparent">
        <!-- Task Context -->
        <div class="bg-white/80 p-4 border-b border-blue-100 shrink-0 relative z-10 backdrop-blur-md rounded-t-xl">
            <div class="flex items-start gap-3">
                <div class="bg-blue-100 p-2 rounded-lg">
                    <i data-lucide="clipboard-list" class="w-5 h-5 text-blue-600"></i>
                </div>
                <div>
                    <span class="text-blue-600 font-bold uppercase text-xs tracking-wider">{{ t('taskLabel') }}</span>
                    <h2 class="text-xl font-black text-slate-800 leading-tight">
                        {{ tr(gameData.context) }}
                    </h2>
                </div>
            </div>
        </div>

        <!-- Scrolling Game Area -->
        <div class="flex-grow p-6 overflow-y-auto relative z-10">
            <div class="grid grid-cols-3 gap-4 pb-24">
                <div v-for="(item, index) in gameData.items" :key="item.id" 
                    @click="handleItemClick(item)"
                    class="item-card bg-white/90 backdrop-blur p-3 rounded-xl border-2 shadow-sm flex flex-col items-center justify-center gap-2 relative cursor-pointer group h-32"
                    :class="[
                        selectionMode && selectedItemId === item.id ? 'selected border-red-500 ring-4 ring-red-100' : 'border-slate-200 hover:border-blue-400',
                        selectionMode ? 'hover:shadow-md' : '',
                        item.isPop ? 'pop-in' : ''
                    ]"
                    :style="{ animationDelay: index * 50 + 'ms' }"
                >
                    <div class="text-4xl mb-1 group-hover:scale-110 transition-transform">{{ item.emoji }}</div>
                    <span class="text-sm font-bold text-slate-800 text-center leading-tight">{{ tr(item.name) }}</span>
                    <div v-if="selectionMode && selectedItemId === item.id" class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-lg pop-in">
                        <i data-lucide="check" class="w-3 h-3"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Action Bar -->
        <div class="bg-white/95 p-4 border-t border-slate-100 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 backdrop-blur relative rounded-b-xl">
            
            <!-- Choices -->
            <div v-if="!selectionMode && !result" class="flex gap-4">
                <button @click="chooseReasonable" class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xl py-4 shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2">
                    <i data-lucide="check-circle-2" class="w-6 h-6"></i> {{ t('allReasonable') }}
                </button>
                <button @click="enterSelectionMode" class="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-xl py-4 shadow-[0_4px_0_#be123c] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2">
                    <i data-lucide="x-circle" class="w-6 h-6"></i> {{ t('notReasonable') }}
                </button>
            </div>

            <!-- Selection Confirm -->
            <div v-if="selectionMode && !result" class="flex flex-col gap-3">
                <div class="flex justify-between items-center px-1">
                    <span class="text-rose-600 font-bold flex items-center gap-2"><i data-lucide="alert-circle" class="w-4 h-4"></i> {{ t('selectPrompt') }}</span>
                    <button @click="cancelSelection" class="text-slate-400 text-xs font-bold underline">{{ t('back') }}</button>
                </div>
                <button @click="confirmUnreasonable" :disabled="!selectedItemId"
                    class="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 disabled:text-slate-400 disabled:shadow-none text-white rounded-xl font-black text-lg py-3 shadow-[0_4px_0_#be123c] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('confirmBtn') }}
                </button>
            </div>

            <!-- Feedback -->
            <div v-if="result" class="text-center py-1">
                <div v-if="result === 'correct'" class="flex flex-col items-center">
                    <h3 class="text-xl font-black text-green-600 mb-1">{{ t('correctTitle') }}</h3>
                    <p class="text-slate-500 text-sm font-medium mb-3">{{ feedbackMessage }}</p>
                    <button @click="finishGame" class="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform w-full">
                        {{ t('finishGame') }}
                    </button>
                </div>
                <div v-if="result === 'wrong'" class="flex flex-col items-center">
                    <h3 class="text-xl font-black text-amber-600 mb-1">{{ t('wrongTitle') }}</h3>
                    <p class="text-slate-500 text-sm font-medium mb-3">{{ feedbackMessage }}</p>
                    <button @click="retry" class="bg-slate-100 text-slate-600 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors w-full">
                        {{ t('retry') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
    `
};

// 挂载到全局对象上，以便主页面访问
window.SupermarketGame = SupermarketGame;