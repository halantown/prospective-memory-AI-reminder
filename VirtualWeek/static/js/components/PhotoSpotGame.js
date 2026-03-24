/**
 * 照片异常检测游戏
 * 找出生活照片中不对劲的地方
 */
const PhotoSpotGame = {
    name: 'PhotoSpotGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, onMounted } = Vue;
        
        const defaultScenario = {
            instruction: "这张生活场景里，有没有不对劲的地方？",
            // 用 emoji 和文字描述模拟场景（实际可换成图片）
            scene: {
                title: "厨房场景",
                items: [
                    { id: 1, icon: "🚰", name: "水龙头", status: "关着", isNormal: true },
                    { id: 2, icon: "🔥", name: "燃气灶", status: "开着火", isNormal: false, problem: "没有锅却开着火" },
                    { id: 3, icon: "❄️", name: "冰箱门", status: "关着", isNormal: true },
                    { id: 4, icon: "💡", name: "厨房灯", status: "亮着", isNormal: true },
                    { id: 5, icon: "🪟", name: "窗户", status: "开着", isNormal: true }
                ]
            },
            hasAbnormality: true,
            explanation: "燃气灶开着火但没有锅，这很危险！"
        };
        
        const gameData = ref(props.scenario || defaultScenario);
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
            answerNormal, enterSelectionMode, selectItem, confirmSelection, cancelSelection, finishGame, getItemById
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
                    <span class="text-rose-600 font-bold text-sm uppercase tracking-wider">场景检查</span>
                    <h2 class="text-xl font-black text-slate-800">{{ gameData.instruction }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 场景显示 -->
        <div class="flex-grow p-6 overflow-y-auto">
            <div class="max-w-lg mx-auto">
                <div class="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
                    <h3 class="text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
                        <i data-lucide="home" class="w-5 h-5"></i>
                        {{ gameData.scene.title }}
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
                            <p class="font-bold text-slate-800">{{ item.name }}</p>
                            <p class="text-sm text-slate-500">{{ item.status }}</p>
                            
                            <div v-if="phase === 'feedback' && !item.isNormal" 
                                 class="mt-2 text-red-600 text-xs font-bold">
                                ⚠️ {{ item.problem }}
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
                <p class="text-center text-slate-600 font-bold text-lg mb-4">这个场景有问题吗？</p>
                <div class="flex gap-4">
                    <button @click="answerNormal" 
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="check" class="w-6 h-6"></i> 一切正常
                    </button>
                    <button @click="enterSelectionMode" 
                        class="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#be123c] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="search" class="w-6 h-6"></i> 有问题
                    </button>
                </div>
            </div>
            
            <!-- 选择模式 -->
            <div v-if="phase === 'playing' && selectionMode" class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-rose-600 font-bold">👆 请点击有问题的地方</span>
                    <button @click="cancelSelection" class="text-slate-400 text-sm font-bold underline">返回</button>
                </div>
                <button @click="confirmSelection" :disabled="!selectedItem"
                    class="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white rounded-xl font-black text-lg py-4 
                           shadow-[0_4px_0_#be123c] disabled:shadow-none active:shadow-none active:translate-y-[4px] transition-all">
                    确认这里有问题
                </button>
            </div>
            
            <!-- 反馈 -->
            <div v-if="phase === 'feedback'" class="text-center">
                <div class="mb-4">
                    <span class="text-3xl">{{ isCorrect ? '✅' : '❌' }}</span>
                    <h3 class="text-xl font-black mt-2" :class="isCorrect ? 'text-green-600' : 'text-red-600'">
                        {{ isCorrect ? '观察正确！' : '观察有误' }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ gameData.explanation }}</p>
                    <p class="text-slate-400 text-sm mt-1">反应时间: {{ (responseTime / 1000).toFixed(1) }}秒</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    完成
                </button>
            </div>
        </div>
    </div>
    `
};

window.PhotoSpotGame = PhotoSpotGame;
