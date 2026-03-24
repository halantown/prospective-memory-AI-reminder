/**
 * 家务优先级排序游戏
 * 选择最应该先做的事情
 */
const PriorityGame = {
    name: 'PriorityGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, onMounted } = Vue;
        
        const defaultScenario = {
            instruction: "你现在只有5分钟，以下事情该先做哪一个？",
            context: "你正准备出门，突然发现...",
            tasks: [
                { 
                    id: 1, 
                    title: "垃圾袋破了", 
                    description: "厨房地上有垃圾",
                    icon: "trash-2",
                    urgency: "medium",
                    color: "bg-amber-100 text-amber-600"
                },
                { 
                    id: 2, 
                    title: "水壶在烧水", 
                    description: "已经快开了",
                    icon: "flame",
                    urgency: "high",
                    color: "bg-red-100 text-red-600"
                },
                { 
                    id: 3, 
                    title: "门铃响了", 
                    description: "不知道是谁",
                    icon: "bell-ring",
                    urgency: "medium",
                    color: "bg-blue-100 text-blue-600"
                }
            ],
            // 没有唯一正确答案，但记录选择
            recommendedId: 2,
            explanation: "水壶快开了需要立即处理，否则可能干烧危险"
        };
        
        const gameData = ref(props.scenario || defaultScenario);
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
            selectTask, finishGame
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
                    <span class="text-orange-600 font-bold text-sm uppercase tracking-wider">优先级判断</span>
                    <h2 class="text-xl font-black text-slate-800">{{ gameData.instruction }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 情境说明 -->
        <div class="px-6 pt-4">
            <div class="bg-slate-100 rounded-xl p-4 border border-slate-200">
                <p class="text-slate-700 font-bold text-lg">{{ gameData.context }}</p>
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
                            <h3 class="text-xl font-black text-slate-800">{{ task.title }}</h3>
                            <p class="text-slate-500 font-medium">{{ task.description }}</p>
                        </div>
                        <div v-if="task.urgency === 'high'" class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            紧急
                        </div>
                    </div>
                    
                    <div v-if="phase === 'feedback' && task.id === gameData.recommendedId" 
                         class="mt-3 text-green-600 font-bold flex items-center gap-2 pt-3 border-t border-slate-100">
                        <i data-lucide="lightbulb" class="w-5 h-5"></i> 建议优先处理
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 底部 -->
        <div class="bg-white/95 backdrop-blur p-5 border-t border-slate-100 shrink-0">
            <div v-if="phase === 'playing'" class="text-center text-slate-500 font-medium">
                点击选择你会先做的事情
            </div>
            
            <div v-if="phase === 'feedback'" class="text-center">
                <div class="mb-4">
                    <span class="text-3xl">{{ isRecommended ? '👍' : '🤔' }}</span>
                    <h3 class="text-xl font-black mt-2 text-slate-700">
                        {{ isRecommended ? '很好的选择！' : '也是一种选择' }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ gameData.explanation }}</p>
                    <p class="text-slate-400 text-sm mt-1">反应时间: {{ (responseTime / 1000).toFixed(1) }}秒</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    完成
                </button>
            </div>
        </div>
    </div>
    `
};

window.PriorityGame = PriorityGame;
