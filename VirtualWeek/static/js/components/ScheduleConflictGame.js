/**
 * 时间安排冲突判断游戏
 * 判断日程是否有时间冲突
 */
const ScheduleConflictGame = {
    name: 'ScheduleConflictGame',
    props: ['scenario'],
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, onMounted } = Vue;
        
        const defaultScenario = {
            instruction: "这是今天的安排，是否有时间冲突？",
            events: [
                { time: "09:00 - 10:30", title: "去银行办事", icon: "building-2", color: "bg-blue-100 text-blue-600" },
                { time: "10:00 - 11:00", title: "医院复查", icon: "heart-pulse", color: "bg-red-100 text-red-600" },
                { time: "14:00 - 15:00", title: "接孙子放学", icon: "baby", color: "bg-green-100 text-green-600" },
                { time: "16:00 - 17:00", title: "公园散步", icon: "trees", color: "bg-emerald-100 text-emerald-600" }
            ],
            hasConflict: true,
            conflictExplanation: "银行办事（09:00-10:30）和医院复查（10:00-11:00）时间重叠了"
        };
        
        const gameData = ref(props.scenario || defaultScenario);
        const phase = ref('playing');
        const selectedAnswer = ref(null);
        const isCorrect = ref(null);
        const responseTime = ref(0);
        let startTime = 0;
        
        onMounted(() => {
            startTime = performance.now();
            if (window.lucide) window.lucide.createIcons();
        });
        
        const submitAnswer = (hasConflict) => {
            responseTime.value = Math.round(performance.now() - startTime);
            selectedAnswer.value = hasConflict;
            isCorrect.value = (hasConflict === gameData.value.hasConflict);
            phase.value = 'feedback';
        };
        
        const finishGame = () => {
            emit('complete', {
                success: isCorrect.value,
                responseTime: responseTime.value,
                selectedAnswer: selectedAnswer.value,
                correctAnswer: gameData.value.hasConflict
            });
        };
        
        return {
            gameData, phase, selectedAnswer, isCorrect, responseTime,
            submitAnswer, finishGame
        };
    },
    
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-violet-50 to-white">
        <!-- 顶部说明 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-violet-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-violet-100 p-3 rounded-xl">
                    <i data-lucide="calendar-clock" class="w-8 h-8 text-violet-600"></i>
                </div>
                <div>
                    <span class="text-violet-600 font-bold text-sm uppercase tracking-wider">日程检查</span>
                    <h2 class="text-xl font-black text-slate-800">{{ gameData.instruction }}</h2>
                </div>
            </div>
        </div>
        
        <!-- 日程列表 -->
        <div class="flex-grow p-6 overflow-y-auto">
            <div class="max-w-lg mx-auto space-y-3">
                <div v-for="(event, idx) in gameData.events" :key="idx"
                     class="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm flex items-center gap-4">
                    <div :class="[event.color, 'p-3 rounded-xl']">
                        <i :data-lucide="event.icon" class="w-7 h-7"></i>
                    </div>
                    <div class="flex-grow">
                        <p class="font-black text-lg text-slate-800">{{ event.title }}</p>
                        <p class="text-slate-500 font-bold">{{ event.time }}</p>
                    </div>
                </div>
            </div>
            
            <!-- 时间轴可视化 -->
            <div class="max-w-lg mx-auto mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p class="text-sm font-bold text-slate-500 mb-3">📅 时间轴</p>
                <div class="relative h-16">
                    <!-- 时间刻度 -->
                    <div class="absolute inset-x-0 top-1/2 h-1 bg-slate-200 rounded"></div>
                    <div class="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-slate-400">8:00</div>
                    <div class="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-slate-400">18:00</div>
                    
                    <!-- 事件块 -->
                    <div v-for="(event, idx) in gameData.events" :key="'bar-'+idx"
                         class="absolute h-6 rounded-lg opacity-80"
                         :class="[
                             idx === 0 ? 'bg-blue-400' : '',
                             idx === 1 ? 'bg-red-400' : '',
                             idx === 2 ? 'bg-green-400' : '',
                             idx === 3 ? 'bg-emerald-400' : ''
                         ]"
                         :style="{
                             left: ((parseInt(event.time.split(':')[0]) - 8) / 10 * 100) + '%',
                             width: '15%',
                             top: (idx % 2 === 0 ? '5px' : '35px')
                         }">
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 底部按钮 -->
        <div class="bg-white/95 backdrop-blur p-5 border-t border-slate-100 shrink-0">
            <div v-if="phase === 'playing'" class="space-y-3">
                <p class="text-center text-slate-600 font-bold text-lg mb-4">这些安排有时间冲突吗？</p>
                <div class="flex gap-4">
                    <button @click="submitAnswer(false)" 
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="check" class="w-6 h-6"></i> 没有冲突
                    </button>
                    <button @click="submitAnswer(true)" 
                        class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xl py-4 
                               shadow-[0_4px_0_#b91c1c] active:shadow-none active:translate-y-[4px] transition-all
                               flex items-center justify-center gap-2">
                        <i data-lucide="x" class="w-6 h-6"></i> 有冲突
                    </button>
                </div>
            </div>
            
            <div v-if="phase === 'feedback'" class="text-center">
                <div class="mb-4">
                    <span class="text-3xl">{{ isCorrect ? '✅' : '❌' }}</span>
                    <h3 class="text-xl font-black mt-2" :class="isCorrect ? 'text-green-600' : 'text-red-600'">
                        {{ isCorrect ? '判断正确！' : '判断错误' }}
                    </h3>
                    <p class="text-slate-500 mt-2">{{ gameData.conflictExplanation }}</p>
                    <p class="text-slate-400 text-sm mt-1">反应时间: {{ (responseTime / 1000).toFixed(1) }}秒</p>
                </div>
                <button @click="finishGame" 
                    class="w-full bg-violet-600 hover:bg-violet-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    完成
                </button>
            </div>
        </div>
    </div>
    `
};

window.ScheduleConflictGame = ScheduleConflictGame;
