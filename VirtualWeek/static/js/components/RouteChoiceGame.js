/**
 * 路线选择游戏
 * 根据当前条件选择更合适的路线
 */
const RouteChoiceGame = {
    name: 'RouteChoiceGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, onMounted } = Vue;
        
        const defaultScenario = {
            instruction: "你要从家去超市，请选择更合适的路线",
            conditions: [
                { icon: "cloud-rain", text: "正在下雨", color: "text-blue-500" },
                { icon: "shopping-bag", text: "需要买很多东西", color: "text-amber-500" }
            ],
            routes: [
                {
                    id: 'A',
                    name: "穿过公园",
                    description: "风景好，但是土路",
                    duration: "8分钟",
                    features: ["🌳 有树荫", "🚶 土路"],
                    isRecommended: false
                },
                {
                    id: 'B', 
                    name: "沿着大街走",
                    description: "有遮雨棚，路面平整",
                    duration: "12分钟",
                    features: ["🏪 有商店", "☔ 有遮挡", "🛒 方便推车"],
                    isRecommended: true
                }
            ],
            explanation: "下雨天土路会很泥泞，而且买很多东西需要推车，大街更方便"
        };
        
        const gameData = ref(props.scenario || defaultScenario);
        const phase = ref('playing');
        const selectedRoute = ref(null);
        const isCorrect = ref(null);
        const responseTime = ref(0);
        let startTime = 0;
        
        onMounted(() => {
            startTime = performance.now();
            if (window.lucide) window.lucide.createIcons();
        });
        
        const selectRoute = (route) => {
            responseTime.value = Math.round(performance.now() - startTime);
            selectedRoute.value = route.id;
            isCorrect.value = route.isRecommended;
            phase.value = 'feedback';
        };
        
        const finishGame = () => {
            emit('complete', {
                success: isCorrect.value,
                responseTime: responseTime.value,
                selectedRoute: selectedRoute.value
            });
        };
        
        return {
            gameData, phase, selectedRoute, isCorrect, responseTime,
            selectRoute, finishGame
        };
    },
    
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-sky-50 to-white">
        <!-- 顶部说明 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-sky-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-sky-100 p-3 rounded-xl">
                    <i data-lucide="map" class="w-8 h-8 text-sky-600"></i>
                </div>
                <div>
                    <span class="text-sky-600 font-bold text-sm uppercase tracking-wider">路线选择</span>
                    <h2 class="text-xl font-black text-slate-800">{{ gameData.instruction }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 当前条件 -->
        <div class="px-6 pt-4">
            <div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <p class="font-bold text-amber-800 mb-2">📋 当前情况：</p>
                <div class="flex flex-wrap gap-3">
                    <div v-for="cond in gameData.conditions" :key="cond.text" 
                         class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-200">
                        <i :data-lucide="cond.icon" class="w-5 h-5" :class="cond.color"></i>
                        <span class="font-bold text-slate-700">{{ cond.text }}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 路线选择 -->
        <div class="flex-grow p-6 overflow-y-auto">
            <div class="space-y-4">
                <div v-for="route in gameData.routes" :key="route.id"
                     @click="phase === 'playing' && selectRoute(route)"
                     class="bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all"
                     :class="[
                         phase === 'playing' ? 'border-slate-200 hover:border-sky-400 hover:shadow-lg' : '',
                         selectedRoute === route.id ? (isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : '',
                         phase === 'feedback' && route.isRecommended && selectedRoute !== route.id ? 'border-green-300 bg-green-50' : ''
                     ]">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="bg-sky-100 text-sky-700 font-black px-3 py-1 rounded-lg text-sm">路线 {{ route.id }}</span>
                            <h3 class="text-xl font-black text-slate-800 mt-2">{{ route.name }}</h3>
                            <p class="text-slate-500">{{ route.description }}</p>
                        </div>
                        <div class="text-right">
                            <span class="text-2xl font-black text-slate-700">{{ route.duration }}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <span v-for="f in route.features" :key="f" 
                              class="bg-slate-100 px-3 py-1 rounded-full text-sm font-medium text-slate-600">
                            {{ f }}
                        </span>
                    </div>
                    <div v-if="phase === 'feedback' && route.isRecommended" 
                         class="mt-3 text-green-600 font-bold flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-5 h-5"></i> 推荐选择
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 底部 -->
        <div class="bg-white/95 backdrop-blur p-5 border-t border-slate-100 shrink-0">
            <div v-if="phase === 'playing'" class="text-center text-slate-500 font-medium">
                点击选择一条路线
            </div>
            
            <div v-if="phase === 'feedback'" class="text-center">
                <div class="mb-4">
                    <span class="text-3xl">{{ isCorrect ? '✅' : '🤔' }}</span>
                    <h3 class="text-xl font-black mt-2" :class="isCorrect ? 'text-green-600' : 'text-amber-600'">
                        {{ isCorrect ? '选择正确！' : '可以再想想' }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ gameData.explanation }}</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-sky-600 hover:bg-sky-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    完成
                </button>
            </div>
        </div>
    </div>
    `
};

window.RouteChoiceGame = RouteChoiceGame;
