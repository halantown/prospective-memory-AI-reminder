/**
 * 照片异常检测游戏
 * 找出生活照片中不对劲的地方
 */
const PhotoSpotGame = {
    name: 'PhotoSpotGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, computed, onMounted } = Vue;
        
        const TEXTS = {
            sceneCheck:     { zh: '场景检查',               en: 'Scene Check',                 nl: 'Scènecontrole' },
            isThereAProblem:{ zh: '这个场景有问题吗？',     en: 'Is there a problem with this scene?', nl: 'Is er een probleem met deze scène?' },
            allNormal:      { zh: '一切正常',               en: 'All Normal',                  nl: 'Alles normaal' },
            hasProblem:     { zh: '有问题',                 en: 'Problem Found',               nl: 'Probleem gevonden' },
            tapProblem:     { zh: '👆 请点击有问题的地方',  en: '👆 Tap on the problem area',   nl: '👆 Tik op het probleemgebied' },
            goBack:         { zh: '返回',                   en: 'Back',                        nl: 'Terug' },
            confirmProblem: { zh: '确认这里有问题',         en: 'Confirm problem here',        nl: 'Bevestig probleem hier' },
            correctObs:     { zh: '观察正确！',             en: 'Correct observation!',        nl: 'Correcte observatie!' },
            incorrectObs:   { zh: '观察有误',               en: 'Incorrect observation',       nl: 'Onjuiste observatie' },
            responseTime:   { zh: '反应时间',               en: 'Response time',               nl: 'Reactietijd' },
            seconds:        { zh: '秒',                     en: 's',                           nl: 's' },
            done:           { zh: '完成',                   en: 'Done',                        nl: 'Klaar' },
        };
        const lang = computed(() => (props.scenario?.lang) || 'zh');
        const t  = (key) => TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
        const tr = (obj) => typeof obj === 'string' ? obj : (obj?.[lang.value] || obj?.en || '');
        
        const defaultScenario = {
            instruction: { zh: "这张生活场景里，有没有不对劲的地方？", en: "Is there anything wrong in this scene?", nl: "Is er iets mis in deze scène?" },
            scene: {
                title: { zh: "厨房场景", en: "Kitchen Scene", nl: "Keukenscène" },
                items: [
                    { id: 1, icon: "🚰", name: { zh: "水龙头", en: "Faucet", nl: "Kraan" }, status: { zh: "关着", en: "Off", nl: "Uit" }, isNormal: true },
                    { id: 2, icon: "🔥", name: { zh: "燃气灶", en: "Gas Stove", nl: "Gasfornuis" }, status: { zh: "开着火", en: "Flame on", nl: "Vlam aan" }, isNormal: false, problem: { zh: "没有锅却开着火", en: "Flame on but no pot", nl: "Vlam aan maar geen pan" } },
                    { id: 3, icon: "❄️", name: { zh: "冰箱门", en: "Fridge Door", nl: "Koelkastdeur" }, status: { zh: "关着", en: "Closed", nl: "Dicht" }, isNormal: true },
                    { id: 4, icon: "💡", name: { zh: "厨房灯", en: "Kitchen Light", nl: "Keukenlamp" }, status: { zh: "亮着", en: "On", nl: "Aan" }, isNormal: true },
                    { id: 5, icon: "🪟", name: { zh: "窗户", en: "Window", nl: "Raam" }, status: { zh: "开着", en: "Open", nl: "Open" }, isNormal: true }
                ]
            },
            hasAbnormality: true,
            explanation: { zh: "燃气灶开着火但没有锅，这很危险！", en: "The gas stove is on but there's no pot — this is dangerous!", nl: "Het gasfornuis staat aan maar er staat geen pan op — dit is gevaarlijk!" }
        };
        
        const gameData = ref({ ...defaultScenario, ...(props.scenario || {}) });
        const phase = ref('playing');
        const selectedAnswer = ref(null);
        const selectedItem = ref(null);
        const isCorrect = ref(null);
        const responseTime = ref(0);
        const selectionMode = ref(false);
        let startTime = 0;
        
        onMounted(() => {
            startTime = performance.now();
            if (window.lucide) window.lucide.createIcons();
        });
        
        const answerNormal = () => {
            responseTime.value = Math.round(performance.now() - startTime);
            selectedAnswer.value = false;
            isCorrect.value = !gameData.value.hasAbnormality;
            phase.value = 'feedback';
        };
        
        const enterSelectionMode = () => {
            selectionMode.value = true;
        };
        
        const selectItem = (item) => {
            if (!selectionMode.value) return;
            selectedItem.value = item.id;
        };
        
        const confirmSelection = () => {
            if (!selectedItem.value) return;
            responseTime.value = Math.round(performance.now() - startTime);
            selectedAnswer.value = true;
            const item = gameData.value.scene.items.find(i => i.id === selectedItem.value);
            isCorrect.value = item && !item.isNormal;
            phase.value = 'feedback';
        };
        
        const cancelSelection = () => {
            selectionMode.value = false;
            selectedItem.value = null;
        };
        
        const finishGame = () => {
            emit('complete', {
                success: isCorrect.value,
                responseTime: responseTime.value,
                foundAbnormality: selectedAnswer.value,
                selectedItem: selectedItem.value
            });
        };
        
        const getItemById = (id) => {
            return gameData.value.scene.items.find(i => i.id === id);
        };
        
        return {
            gameData, phase, selectedAnswer, selectedItem, isCorrect, responseTime, selectionMode,
            answerNormal, enterSelectionMode, selectItem, confirmSelection, cancelSelection, finishGame, getItemById,
            t, tr
        };
    },
    
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-rose-50 to-white">
        <!-- 顶部说明 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-rose-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-rose-100 p-3 rounded-xl">
                    <i data-lucide="scan-search" class="w-8 h-8 text-rose-600"></i>
                </div>
                <div>
                    <span class="text-rose-600 font-bold text-sm uppercase tracking-wider">{{ t('sceneCheck') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ tr(gameData.instruction) }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 场景显示 -->
        <div class="flex-grow p-6 overflow-y-auto">
            <div class="max-w-lg mx-auto">
                <div class="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
                    <h3 class="text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
                        <i data-lucide="home" class="w-5 h-5"></i>
                        {{ tr(gameData.scene.title) }}
                    </h3>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div v-for="item in gameData.scene.items" :key="item.id"
                             @click="selectItem(item)"
                             class="p-4 rounded-xl border-2 transition-all text-center"
                             :class="[
                                 selectionMode ? 'cursor-pointer hover:border-rose-400' : '',
                                 selectedItem === item.id ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-100' : 'border-slate-200 bg-slate-50',
                                 phase === 'feedback' && !item.isNormal ? 'border-red-500 bg-red-50' : ''
                             ]">
                            <div class="text-4xl mb-2">{{ item.icon }}</div>
                            <p class="font-bold text-slate-800">{{ tr(item.name) }}</p>
                            <p class="text-sm text-slate-500">{{ tr(item.status) }}</p>
                            
                            <div v-if="phase === 'feedback' && !item.isNormal" 
                                 class="mt-2 text-red-600 text-xs font-bold">
                                ⚠️ {{ tr(item.problem) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 底部按钮 -->
        <div class="bg-white/95 backdrop-blur p-5 border-t border-slate-100 shrink-0">
            <!-- 初始选择 -->
            <div v-if="phase === 'playing' && !selectionMode" class="space-y-3">
                <p class="text-center text-slate-600 font-bold text-lg mb-4">{{ t('isThereAProblem') }}</p>
                <div class="flex gap-4">
                    <button @click="answerNormal" 
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="check" class="w-6 h-6"></i> {{ t('allNormal') }}
                    </button>
                    <button @click="enterSelectionMode" 
                        class="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#be123c] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="search" class="w-6 h-6"></i> {{ t('hasProblem') }}
                    </button>
                </div>
            </div>
            
            <!-- 选择模式 -->
            <div v-if="phase === 'playing' && selectionMode" class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-rose-600 font-bold">{{ t('tapProblem') }}</span>
                    <button @click="cancelSelection" class="text-slate-400 text-sm font-bold underline">{{ t('goBack') }}</button>
                </div>
                <button @click="confirmSelection" :disabled="!selectedItem"
                    class="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white rounded-xl font-black text-lg py-4 
                           shadow-[0_4px_0_#be123c] disabled:shadow-none active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('confirmProblem') }}
                </button>
            </div>
            
            <!-- 反馈 -->
            <div v-if="phase === 'feedback'" class="text-center">
                <div class="mb-4">
                    <span class="text-3xl">{{ isCorrect ? '✅' : '❌' }}</span>
                    <h3 class="text-xl font-black mt-2" :class="isCorrect ? 'text-green-600' : 'text-red-600'">
                        {{ isCorrect ? t('correctObs') : t('incorrectObs') }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ tr(gameData.explanation) }}</p>
                    <p class="text-slate-400 text-sm mt-1">{{ t('responseTime') }}: {{ (responseTime / 1000).toFixed(1) }}{{ t('seconds') }}</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('done') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.PhotoSpotGame = PhotoSpotGame;
