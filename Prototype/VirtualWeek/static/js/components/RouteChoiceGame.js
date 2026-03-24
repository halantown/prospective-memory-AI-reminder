/**
 * 路线选择游戏
 * 根据当前条件选择更合适的路线
 */
const RouteChoiceGame = {
    name: 'RouteChoiceGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, onMounted, computed } = Vue;

        const TEXTS = {
            routeSelection:    { zh: '路线选择',         en: 'Route Selection',           nl: 'Routekeuze' },
            currentConditions: { zh: '📋 当前情况：',    en: '📋 Current Conditions:',     nl: '📋 Huidige omstandigheden:' },
            route:             { zh: '路线',             en: 'Route',                      nl: 'Route' },
            recommended:       { zh: '推荐选择',         en: 'Recommended',                nl: 'Aanbevolen' },
            clickToSelect:     { zh: '点击选择一条路线', en: 'Click to select a route',    nl: 'Klik om een route te kiezen' },
            correct:           { zh: '选择正确！',       en: 'Correct!',                   nl: 'Juist!' },
            thinkAgain:        { zh: '可以再想想',       en: 'Think again',                nl: 'Denk nog eens na' },
            finish:            { zh: '完成',             en: 'Done',                       nl: 'Klaar' }
        };
        const lang = computed(() => (props.scenario?.lang) || 'zh');
        const t  = (key) => TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
        const tr = (obj) => typeof obj === 'string' ? obj : (obj?.[lang.value] || obj?.en || '');

        const defaultScenario = {
            instruction: {
                zh: "你要从家去超市，请选择更合适的路线",
                en: "You need to go from home to the supermarket. Please choose the more suitable route.",
                nl: "Je moet van huis naar de supermarkt. Kies de meest geschikte route."
            },
            conditions: [
                { icon: "cloud-rain", text: { zh: "正在下雨", en: "It's raining", nl: "Het regent" }, color: "text-blue-500" },
                { icon: "shopping-bag", text: { zh: "需要买很多东西", en: "Need to buy many items", nl: "Je moet veel boodschappen doen" }, color: "text-amber-500" }
            ],
            routes: [
                {
                    id: 'A',
                    name: { zh: "穿过公园", en: "Through the park", nl: "Door het park" },
                    description: { zh: "风景好，但是土路", en: "Nice scenery, but dirt road", nl: "Mooi uitzicht, maar onverharde weg" },
                    duration: { zh: "8分钟", en: "8 min", nl: "8 min" },
                    features: [
                        { zh: "🌳 有树荫", en: "🌳 Shady trees", nl: "🌳 Schaduwrijke bomen" },
                        { zh: "🚶 土路", en: "🚶 Dirt road", nl: "🚶 Onverharde weg" }
                    ],
                    isRecommended: false
                },
                {
                    id: 'B', 
                    name: { zh: "沿着大街走", en: "Along the main street", nl: "Langs de hoofdstraat" },
                    description: { zh: "有遮雨棚，路面平整", en: "Has rain shelter, smooth pavement", nl: "Heeft regenbescherming, glad wegdek" },
                    duration: { zh: "12分钟", en: "12 min", nl: "12 min" },
                    features: [
                        { zh: "🏪 有商店", en: "🏪 Shops nearby", nl: "🏪 Winkels in de buurt" },
                        { zh: "☔ 有遮挡", en: "☔ Rain cover", nl: "☔ Regenbescherming" },
                        { zh: "🛒 方便推车", en: "🛒 Cart-friendly", nl: "🛒 Wagentjevriendelijk" }
                    ],
                    isRecommended: true
                }
            ],
            explanation: {
                zh: "下雨天土路会很泥泞，而且买很多东西需要推车，大街更方便",
                en: "Dirt roads get muddy in the rain, and you need a cart for many items — the main street is more convenient.",
                nl: "Onverharde wegen worden modderig in de regen, en je hebt een wagentje nodig voor veel boodschappen — de hoofdstraat is handiger."
            }
        };
        
        const gameData = ref({ ...defaultScenario, ...(props.scenario || {}) });
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
            selectRoute, finishGame, t, tr
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
                    <span class="text-sky-600 font-bold text-sm uppercase tracking-wider">{{ t('routeSelection') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ tr(gameData.instruction) }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 当前条件 -->
        <div class="px-6 pt-4">
            <div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <p class="font-bold text-amber-800 mb-2">{{ t('currentConditions') }}</p>
                <div class="flex flex-wrap gap-3">
                    <div v-for="cond in gameData.conditions" :key="cond.text" 
                         class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-200">
                        <i :data-lucide="cond.icon" class="w-5 h-5" :class="cond.color"></i>
                        <span class="font-bold text-slate-700">{{ tr(cond.text) }}</span>
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
                            <span class="bg-sky-100 text-sky-700 font-black px-3 py-1 rounded-lg text-sm">{{ t('route') }} {{ route.id }}</span>
                            <h3 class="text-xl font-black text-slate-800 mt-2">{{ tr(route.name) }}</h3>
                            <p class="text-slate-500">{{ tr(route.description) }}</p>
                        </div>
                        <div class="text-right">
                            <span class="text-2xl font-black text-slate-700">{{ tr(route.duration) }}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <span v-for="f in route.features" :key="f" 
                              class="bg-slate-100 px-3 py-1 rounded-full text-sm font-medium text-slate-600">
                            {{ tr(f) }}
                        </span>
                    </div>
                    <div v-if="phase === 'feedback' && route.isRecommended" 
                         class="mt-3 text-green-600 font-bold flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-5 h-5"></i> {{ t('recommended') }}
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
                    <span class="text-3xl">{{ isCorrect ? '✅' : '🤔' }}</span>
                    <h3 class="text-xl font-black mt-2" :class="isCorrect ? 'text-green-600' : 'text-amber-600'">
                        {{ isCorrect ? t('correct') : t('thinkAgain') }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ tr(gameData.explanation) }}</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-sky-600 hover:bg-sky-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finish') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.RouteChoiceGame = RouteChoiceGame;
