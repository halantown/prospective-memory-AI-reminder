/**
 * 小游戏组件模板
 * 
 * 使用方法:
 * 1. 复制此文件，重命名为 YourGame.js
 * 2. 修改组件名称和逻辑
 * 3. 在 main.html 中添加 <script src="js/components/YourGame.js"></script>
 * 4. 在 GAME_REGISTRY 中注册
 * 
 * 接口约定:
 * - props.scenario: 从地图配置传入的场景数据
 * - emit('complete', result): 游戏结束时调用，result 包含游戏结果
 */

const GameTemplate = {
    name: 'GameTemplate',
    
    // 接收的参数
    props: ['scenario'],
    
    // 触发的事件
    emits: ['complete'],
    
    setup(props, { emit }) {
        const { ref, computed, onMounted, watch } = Vue;
        
        // ============================================================
        // 状态定义
        // ============================================================
        
        // 游戏阶段: 'intro' | 'playing' | 'feedback'
        const phase = ref('intro');
        
        // 游戏数据 (从 props 获取或使用默认值)
        const gameData = ref(props.scenario || {
            // 默认测试数据
            title: '示例游戏',
            items: []
        });
        
        // 玩家状态
        const score = ref(0);
        const attempts = ref(0);
        const isCorrect = ref(null);
        const feedbackMessage = ref('');
        
        // 计时器 (如果需要)
        const timeLeft = ref(30);
        let timer = null;
        
        // ============================================================
        // 计算属性
        // ============================================================
        
        const canSubmit = computed(() => {
            // 定义提交条件
            return phase.value === 'playing';
        });
        
        const progressPercent = computed(() => {
            // 进度百分比 (用于进度条)
            return Math.min(100, (score.value / 3) * 100);
        });
        
        // ============================================================
        // 生命周期
        // ============================================================
        
        onMounted(() => {
            // 初始化动画、图标等
            if (window.lucide) window.lucide.createIcons();
            
            // 如果需要自动开始
            // startGame();
        });
        
        // ============================================================
        // 游戏逻辑
        // ============================================================
        
        const startGame = () => {
            phase.value = 'playing';
            score.value = 0;
            attempts.value = 0;
            
            // 启动计时器 (可选)
            // startTimer();
        };
        
        const startTimer = () => {
            timeLeft.value = 30;
            timer = setInterval(() => {
                timeLeft.value--;
                if (timeLeft.value <= 0) {
                    clearInterval(timer);
                    endGame(false);
                }
            }, 1000);
        };
        
        const stopTimer = () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        };
        
        const handleAction = (item) => {
            // 处理玩家操作
            attempts.value++;
            
            // 判断逻辑
            if (item.isCorrect) {
                score.value++;
                isCorrect.value = true;
                feedbackMessage.value = '正确！';
            } else {
                isCorrect.value = false;
                feedbackMessage.value = '再试一次';
            }
            
            // 检查是否结束
            if (score.value >= 3) {
                endGame(true);
            }
        };
        
        const endGame = (success) => {
            stopTimer();
            phase.value = 'feedback';
            isCorrect.value = success;
            feedbackMessage.value = success ? '太棒了！' : '下次加油！';
        };
        
        const retry = () => {
            phase.value = 'intro';
            isCorrect.value = null;
            feedbackMessage.value = '';
        };
        
        // ============================================================
        // 完成游戏 (必须调用)
        // ============================================================
        
        const finishGame = () => {
            stopTimer();
            
            // 返回游戏结果给主界面
            emit('complete', {
                success: isCorrect.value,
                score: score.value,
                attempts: attempts.value,
                timeSpent: 30 - timeLeft.value
            });
        };
        
        // ============================================================
        // 返回模板可用的数据和方法
        // ============================================================
        
        return {
            // 状态
            phase,
            gameData,
            score,
            attempts,
            isCorrect,
            feedbackMessage,
            timeLeft,
            
            // 计算属性
            canSubmit,
            progressPercent,
            
            // 方法
            startGame,
            handleAction,
            retry,
            finishGame
        };
    },
    
    // ============================================================
    // 模板
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-transparent">
        
        <!-- 顶部: 标题/说明 -->
        <div class="bg-white/80 backdrop-blur p-4 border-b border-slate-100 shrink-0 rounded-t-xl">
            <div class="flex items-center gap-3">
                <div class="bg-indigo-100 p-2 rounded-lg">
                    <i data-lucide="gamepad-2" class="w-5 h-5 text-indigo-600"></i>
                </div>
                <div>
                    <span class="text-indigo-600 font-bold uppercase text-xs tracking-wider">小游戏</span>
                    <h2 class="text-xl font-black text-slate-800">{{ gameData.title }}</h2>
                </div>
            </div>
            
            <!-- 进度条 (可选) -->
            <div v-if="phase === 'playing'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-500 transition-all duration-300" 
                         :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                    <span>得分: {{ score }}</span>
                    <span v-if="timeLeft">剩余: {{ timeLeft }}s</span>
                </div>
            </div>
        </div>
        
        <!-- 中间: 游戏区域 -->
        <div class="flex-grow p-6 overflow-y-auto">
            
            <!-- 介绍阶段 -->
            <div v-if="phase === 'intro'" class="h-full flex flex-col items-center justify-center text-center">
                <div class="text-6xl mb-4">🎮</div>
                <h3 class="text-2xl font-black text-slate-800 mb-2">准备好了吗？</h3>
                <p class="text-slate-500 mb-6">游戏说明文字...</p>
                <button @click="startGame" 
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-colors">
                    开始游戏
                </button>
            </div>
            
            <!-- 游戏阶段 -->
            <div v-if="phase === 'playing'" class="space-y-4">
                <!-- 游戏内容放这里 -->
                <div class="grid grid-cols-2 gap-4">
                    <button v-for="i in 4" :key="i"
                        @click="handleAction({ isCorrect: i === 1 })"
                        class="bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-indigo-400 
                               text-center font-bold text-lg transition-colors">
                        选项 {{ i }}
                    </button>
                </div>
            </div>
            
            <!-- 反馈阶段 -->
            <div v-if="phase === 'feedback'" class="h-full flex flex-col items-center justify-center text-center">
                <div class="text-6xl mb-4">{{ isCorrect ? '🎉' : '😅' }}</div>
                <h3 class="text-2xl font-black mb-2" :class="isCorrect ? 'text-green-600' : 'text-amber-600'">
                    {{ feedbackMessage }}
                </h3>
                <p class="text-slate-500 mb-6">得分: {{ score }} / 尝试: {{ attempts }}</p>
            </div>
            
        </div>
        
        <!-- 底部: 操作按钮 -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            
            <!-- 反馈阶段的按钮 -->
            <div v-if="phase === 'feedback'" class="flex gap-3">
                <button v-if="!isCorrect" @click="retry"
                    class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors">
                    重试
                </button>
                <button @click="finishGame"
                    class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-colors">
                    {{ isCorrect ? '完成' : '跳过' }}
                </button>
            </div>
            
            <!-- 游戏中的提示 -->
            <div v-if="phase === 'playing'" class="text-center text-slate-500 text-sm">
                点击选项进行选择
            </div>
            
        </div>
    </div>
    `
};

// 注册到全局
window.GameTemplate = GameTemplate;
