/**
 * 做饭游戏 (Cooking Game)
 * 高认知负荷：在传送带上选取正确食材 + 按照菜谱顺序执行烹饪步骤
 *
 * 两阶段设计：
 *   Phase A: 传送带选食材 — 食材从右向左滚动，需在限时内选出菜谱需要的食材
 *   Phase B: 烹饪步骤   — 按正确顺序排列/选择烹饪步骤
 *
 * 认知负荷来源：
 *   - 工作记忆：记住菜谱所需食材 & 步骤
 *   - 抑制控制：忽略传送带上的干扰食材
 *   - 任务切换：食材选取 → 步骤排序
 *   - 时间压力：传送带持续滚动
 */
const CookingGame = {
    name: 'CookingGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted, watch, nextTick } = Vue;

        // ============================================================
        // 配置
        // ============================================================
        const defaultScenario = {
            totalRounds: 3,
            conveyorSpeed: 2800,       // ms per item scrolling across
            conveyorInterval: 1200,    // ms between new items appearing
            timePerRound: 30,          // seconds for ingredient phase
            stepTimeLimit: 20,         // seconds for cooking step phase
            difficulty: 'medium',      // 'easy' | 'medium' | 'hard'
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ============================================================
        // i18n
        // ============================================================
        const TEXTS = {
            headerLabel:      { zh: '烹饪挑战',   en: 'Cooking Challenge',  nl: 'Kookuitdaging' },
            headerTitle:      { zh: '大厨模拟器',  en: 'Chef Simulator',     nl: 'Chef Simulator' },
            dishCounter:      { zh: '第 {0}/{1} 道菜', en: 'Dish {0}/{1}', nl: 'Gerecht {0}/{1}' },
            welcomeTitle:     { zh: '欢迎来到厨房！', en: 'Welcome to the Kitchen!', nl: 'Welkom in de Keuken!' },
            introDesc:        { zh: '每一轮你需要完成一道菜，分为<strong class="text-orange-700">两个阶段</strong>：', en: 'Each round you complete a dish in <strong class="text-orange-700">two phases</strong>:', nl: 'Elke ronde maak je een gerecht in <strong class="text-orange-700">twee fasen</strong>:' },
            phase1Title:      { zh: '🛒 传送带选食材', en: '🛒 Pick Ingredients from Conveyor', nl: '🛒 Kies Ingrediënten van de Band' },
            phase1Desc:       { zh: '食材在传送带上滚动，记住菜谱需要的食材，<strong>点击</strong>拾取正确的，忽略干扰项！', en: 'Ingredients scroll on the conveyor. Remember what the recipe needs, <strong>click</strong> to pick the right ones, ignore distractors!', nl: 'Ingrediënten scrollen op de band. Onthoud wat het recept nodig heeft, <strong>klik</strong> om de juiste te pakken, negeer afleiders!' },
            phase2Title:      { zh: '📋 排列烹饪步骤', en: '📋 Arrange Cooking Steps', nl: '📋 Rangschik Kookstappen' },
            phase2Desc:       { zh: '步骤被打乱了顺序，按<strong>正确的烹饪顺序</strong>依次点击排列！', en: 'Steps are shuffled. Click in the <strong>correct cooking order</strong>!', nl: 'Stappen zijn door elkaar gehusseld. Klik in de <strong>juiste kookvolgorde</strong>!' },
            introFooter:      { zh: '📍 共 {0} 道菜 · ⏱ 每阶段限时', en: '📍 {0} dishes total · ⏱ Time limit per phase', nl: '📍 {0} gerechten totaal · ⏱ Tijdslimiet per fase' },
            startBtn:         { zh: '开始做饭！', en: 'Start Cooking!', nl: 'Begin met Koken!' },
            needIngredients:  { zh: '需要 {0} 种食材 · 还差', en: 'Need {0} ingredients ·', nl: '{0} ingrediënten nodig ·' },
            remainCount:      { zh: '{0} 种', en: '{0} left', nl: 'nog {0}' },
            conveyorLabel:    { zh: '◀ 传送带', en: '◀ Conveyor', nl: '◀ Lopende band' },
            selectedLabel:    { zh: '✅ 已选:', en: '✅ Picked:', nl: '✅ Gekozen:' },
            wrongLabel:       { zh: '❌ 错选:', en: '❌ Wrong:', nl: '❌ Fout:' },
            arrangeSteps:     { zh: '排列步骤', en: 'Arrange Steps', nl: 'Rangschik Stappen' },
            cookingInstr:     { zh: '按正确的烹饪顺序依次点击（点击已选步骤可取消）', en: 'Click in correct cooking order (click a selected step to undo)', nl: 'Klik in de juiste kookvolgorde (klik op een gekozen stap om ongedaan te maken)' },
            doneLabel:        { zh: '完成！', en: 'Done!', nl: 'Klaar!' },
            ingredientPickup: { zh: '🛒 食材拾取', en: '🛒 Ingredient Pickup', nl: '🛒 Ingrediënten Verzameld' },
            wrongPicks:       { zh: '错选了:', en: 'Wrong picks:', nl: 'Fout gekozen:' },
            missedPicks:      { zh: '漏选了:', en: 'Missed:', nl: 'Gemist:' },
            stepOrdering:     { zh: '📋 步骤排序', en: '📋 Step Order', nl: '📋 Stapvolgorde' },
            correctResult:    { zh: '✅ 正确', en: '✅ Correct', nl: '✅ Correct' },
            wrongResult:      { zh: '❌ 错误', en: '❌ Wrong', nl: '❌ Fout' },
            correctOrder:     { zh: '正确顺序：', en: 'Correct order:', nl: 'Juiste volgorde:' },
            viewResults:      { zh: '查看结果', en: 'View Results', nl: 'Bekijk Resultaten' },
            nextDish:         { zh: '下一道菜 →', en: 'Next Dish →', nl: 'Volgend Gerecht →' },
            excellent:        { zh: '星级大厨！', en: 'Star Chef!', nl: 'Sterrenchef!' },
            good:             { zh: '做得不错！', en: 'Well Done!', nl: 'Goed Gedaan!' },
            needsPractice:    { zh: '还需练习！', en: 'Needs Practice!', nl: 'Meer Oefening Nodig!' },
            challengeDiff:    { zh: '烹饪挑战 · {0}', en: 'Cooking Challenge · {0}', nl: 'Kookuitdaging · {0}' },
            diffEasy:         { zh: '简单', en: 'Easy', nl: 'Makkelijk' },
            diffMedium:       { zh: '中等', en: 'Medium', nl: 'Gemiddeld' },
            diffHard:         { zh: '困难', en: 'Hard', nl: 'Moeilijk' },
            overallScore:     { zh: '综合得分', en: 'Overall Score', nl: 'Totaalscore' },
            ingredientCorrect:{ zh: '食材正确', en: 'Ingredients Correct', nl: 'Ingrediënten Correct' },
            stepsCorrectLabel:{ zh: '步骤正确', en: 'Steps Correct', nl: 'Stappen Correct' },
            conveyorHint:     { zh: '点击传送带上的食材拾取 · 只拿菜谱需要的！', en: 'Click ingredients on the conveyor · Only pick what the recipe needs!', nl: 'Klik op ingrediënten op de band · Pak alleen wat het recept nodig heeft!' },
            cookingHint:      { zh: '按正确顺序依次点击步骤', en: 'Click steps in the correct order', nl: 'Klik stappen in de juiste volgorde' },
            finishBtn:        { zh: '完成', en: 'Finish', nl: 'Voltooien' },
        };
        const lang = computed(() => config.value.lang || 'zh');
        const t = (key, ...args) => {
            let s = TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
            args.forEach((a, i) => { s = s.replace(`{${i}}`, a); });
            return s;
        };
        const tr = (obj) => typeof obj === 'string' ? obj : (obj?.[lang.value] || obj?.en || '');
        const trJoin = (arr) => arr.map(x => tr(x)).join(', ');

        // ============================================================
        // 菜谱库
        // ============================================================
        const RECIPES = {
            easy: [
                {
                    name: {zh:'水果沙拉', en:'Fruit Salad', nl:'Fruitsalade'}, emoji: '🥗',
                    ingredients: [
                        {zh:'🍎 苹果', en:'🍎 Apple', nl:'🍎 Appel'},
                        {zh:'🍌 香蕉', en:'🍌 Banana', nl:'🍌 Banaan'},
                        {zh:'🍇 葡萄', en:'🍇 Grape', nl:'🍇 Druif'},
                        {zh:'🍓 草莓', en:'🍓 Strawberry', nl:'🍓 Aardbei'},
                    ],
                    distractors: [
                        {zh:'🧄 大蒜', en:'🧄 Garlic', nl:'🧄 Knoflook'},
                        {zh:'🌶️ 辣椒', en:'🌶️ Chili', nl:'🌶️ Chilipeper'},
                        {zh:'🧅 洋葱', en:'🧅 Onion', nl:'🧅 Ui'},
                        {zh:'🥩 牛排', en:'🥩 Steak', nl:'🥩 Biefstuk'},
                        {zh:'🐟 鲜鱼', en:'🐟 Fish', nl:'🐟 Vis'},
                        {zh:'🧈 黄油', en:'🧈 Butter', nl:'🧈 Boter'},
                    ],
                    steps: [
                        {zh:'洗净水果', en:'Wash the fruit', nl:'Was het fruit'},
                        {zh:'切成小块', en:'Cut into pieces', nl:'Snijd in stukjes'},
                        {zh:'加入酸奶', en:'Add yogurt', nl:'Voeg yoghurt toe'},
                        {zh:'搅拌均匀', en:'Mix well', nl:'Roer goed door'},
                    ]
                },
                {
                    name: {zh:'煎蛋三明治', en:'Fried Egg Sandwich', nl:'Gebakken Ei Sandwich'}, emoji: '🥪',
                    ingredients: [
                        {zh:'🥚 鸡蛋', en:'🥚 Egg', nl:'🥚 Ei'},
                        {zh:'🍞 面包', en:'🍞 Bread', nl:'🍞 Brood'},
                        {zh:'🧈 黄油', en:'🧈 Butter', nl:'🧈 Boter'},
                        {zh:'🧀 奶酪', en:'🧀 Cheese', nl:'🧀 Kaas'},
                    ],
                    distractors: [
                        {zh:'🍇 葡萄', en:'🍇 Grape', nl:'🍇 Druif'},
                        {zh:'🍫 巧克力', en:'🍫 Chocolate', nl:'🍫 Chocolade'},
                        {zh:'🌽 玉米', en:'🌽 Corn', nl:'🌽 Maïs'},
                        {zh:'🥦 西兰花', en:'🥦 Broccoli', nl:'🥦 Broccoli'},
                        {zh:'🍋 柠檬', en:'🍋 Lemon', nl:'🍋 Citroen'},
                        {zh:'🧄 大蒜', en:'🧄 Garlic', nl:'🧄 Knoflook'},
                    ],
                    steps: [
                        {zh:'在平底锅中融化黄油', en:'Melt butter in the pan', nl:'Smelt boter in de pan'},
                        {zh:'打入鸡蛋煎至凝固', en:'Fry the egg until set', nl:'Bak het ei tot het gestold is'},
                        {zh:'在面包上铺一片奶酪', en:'Place cheese on the bread', nl:'Leg kaas op het brood'},
                        {zh:'把煎蛋放到奶酪上盖好', en:'Put the egg on top and close', nl:'Leg het ei erop en sluit af'},
                    ]
                },
            ],
            medium: [
                {
                    name: {zh:'番茄意面', en:'Tomato Pasta', nl:'Tomatenpasta'}, emoji: '🍝',
                    ingredients: [
                        {zh:'🍝 意面', en:'🍝 Pasta', nl:'🍝 Pasta'},
                        {zh:'🍅 番茄', en:'🍅 Tomato', nl:'🍅 Tomaat'},
                        {zh:'🧄 大蒜', en:'🧄 Garlic', nl:'🧄 Knoflook'},
                        {zh:'🧅 洋葱', en:'🧅 Onion', nl:'🧅 Ui'},
                        {zh:'🧀 帕玛森', en:'🧀 Parmesan', nl:'🧀 Parmezaan'},
                    ],
                    distractors: [
                        {zh:'🍌 香蕉', en:'🍌 Banana', nl:'🍌 Banaan'},
                        {zh:'🥥 椰子', en:'🥥 Coconut', nl:'🥥 Kokosnoot'},
                        {zh:'🍫 巧克力', en:'🍫 Chocolate', nl:'🍫 Chocolade'},
                        {zh:'🌽 玉米', en:'🌽 Corn', nl:'🌽 Maïs'},
                        {zh:'🍇 葡萄', en:'🍇 Grape', nl:'🍇 Druif'},
                        {zh:'🥩 牛排', en:'🥩 Steak', nl:'🥩 Biefstuk'},
                        {zh:'🍋 柠檬', en:'🍋 Lemon', nl:'🍋 Citroen'},
                    ],
                    steps: [
                        {zh:'烧开水煮意面', en:'Boil water and cook pasta', nl:'Kook water en kook de pasta'},
                        {zh:'切碎大蒜和洋葱', en:'Chop garlic and onion', nl:'Hak knoflook en ui'},
                        {zh:'热锅炒香蒜和洋葱', en:'Sauté garlic and onion', nl:'Bak knoflook en ui aan'},
                        {zh:'加入番茄煮成酱', en:'Add tomato and make sauce', nl:'Voeg tomaat toe en maak saus'},
                        {zh:'意面拌入酱中', en:'Toss pasta in sauce', nl:'Meng de pasta door de saus'},
                        {zh:'撒上帕玛森', en:'Sprinkle Parmesan', nl:'Strooi Parmezaan erover'},
                    ]
                },
                {
                    name: {zh:'日式味噌汤', en:'Japanese Miso Soup', nl:'Japanse Misosoep'}, emoji: '🍜',
                    ingredients: [
                        {zh:'🫘 味噌', en:'🫘 Miso', nl:'🫘 Miso'},
                        {zh:'🧈 豆腐', en:'🧈 Tofu', nl:'🧈 Tofu'},
                        {zh:'🧅 葱花', en:'🧅 Scallion', nl:'🧅 Lente-ui'},
                        {zh:'🍄 蘑菇', en:'🍄 Mushroom', nl:'🍄 Champignon'},
                        {zh:'🫧 昆布', en:'🫧 Kombu', nl:'🫧 Kombu'},
                    ],
                    distractors: [
                        {zh:'🍝 意面', en:'🍝 Pasta', nl:'🍝 Pasta'},
                        {zh:'🧀 奶酪', en:'🧀 Cheese', nl:'🧀 Kaas'},
                        {zh:'🍞 面包', en:'🍞 Bread', nl:'🍞 Brood'},
                        {zh:'🌶️ 辣椒', en:'🌶️ Chili', nl:'🌶️ Chilipeper'},
                        {zh:'🍎 苹果', en:'🍎 Apple', nl:'🍎 Appel'},
                        {zh:'🐟 鲜鱼', en:'🐟 Fish', nl:'🐟 Vis'},
                        {zh:'🥩 牛排', en:'🥩 Steak', nl:'🥩 Biefstuk'},
                    ],
                    steps: [
                        {zh:'昆布冷水泡发', en:'Soak kombu in cold water', nl:'Week kombu in koud water'},
                        {zh:'煮沸后取出昆布', en:'Boil and remove kombu', nl:'Kook en verwijder kombu'},
                        {zh:'加入豆腐和蘑菇', en:'Add tofu and mushroom', nl:'Voeg tofu en champignon toe'},
                        {zh:'小火溶化味噌', en:'Dissolve miso on low heat', nl:'Los miso op op laag vuur'},
                        {zh:'撒上葱花', en:'Sprinkle scallion', nl:'Strooi lente-ui erover'},
                        {zh:'关火上桌', en:'Turn off heat and serve', nl:'Zet het vuur uit en serveer'},
                    ]
                },
                {
                    name: {zh:'蔬菜炒饭', en:'Vegetable Fried Rice', nl:'Groente Gebakken Rijst'}, emoji: '🍳',
                    ingredients: [
                        {zh:'🍚 米饭', en:'🍚 Rice', nl:'🍚 Rijst'},
                        {zh:'🥚 鸡蛋', en:'🥚 Egg', nl:'🥚 Ei'},
                        {zh:'🥕 胡萝卜', en:'🥕 Carrot', nl:'🥕 Wortel'},
                        {zh:'🌽 玉米', en:'🌽 Corn', nl:'🌽 Maïs'},
                        {zh:'🧅 葱花', en:'🧅 Scallion', nl:'🧅 Lente-ui'},
                    ],
                    distractors: [
                        {zh:'🍫 巧克力', en:'🍫 Chocolate', nl:'🍫 Chocolade'},
                        {zh:'🍇 葡萄', en:'🍇 Grape', nl:'🍇 Druif'},
                        {zh:'🧀 奶酪', en:'🧀 Cheese', nl:'🧀 Kaas'},
                        {zh:'🍋 柠檬', en:'🍋 Lemon', nl:'🍋 Citroen'},
                        {zh:'🍌 香蕉', en:'🍌 Banana', nl:'🍌 Banaan'},
                        {zh:'🥥 椰子', en:'🥥 Coconut', nl:'🥥 Kokosnoot'},
                        {zh:'🍝 意面', en:'🍝 Pasta', nl:'🍝 Pasta'},
                    ],
                    steps: [
                        {zh:'打散鸡蛋', en:'Beat the eggs', nl:'Klop de eieren'},
                        {zh:'热锅炒蛋盛出', en:'Scramble eggs and set aside', nl:'Bak de eieren en zet apart'},
                        {zh:'炒胡萝卜和玉米', en:'Stir-fry carrot and corn', nl:'Roerbak wortel en maïs'},
                        {zh:'加入米饭翻炒', en:'Add rice and stir-fry', nl:'Voeg rijst toe en roerbak'},
                        {zh:'倒入鸡蛋拌匀', en:'Mix in the eggs', nl:'Meng de eieren erdoor'},
                        {zh:'撒葱花出锅', en:'Garnish with scallion and serve', nl:'Garneer met lente-ui en serveer'},
                    ]
                },
            ],
            hard: [
                {
                    name: {zh:'红烧肉', en:'Red Braised Pork', nl:'Rood Gestoofd Varkensvlees'}, emoji: '🥘',
                    ingredients: [
                        {zh:'🥩 五花肉', en:'🥩 Pork Belly', nl:'🥩 Buikspek'},
                        {zh:'🧄 大蒜', en:'🧄 Garlic', nl:'🧄 Knoflook'},
                        {zh:'🫚 生姜', en:'🫚 Ginger', nl:'🫚 Gember'},
                        {zh:'🧅 葱段', en:'🧅 Scallion', nl:'🧅 Lente-ui'},
                        {zh:'⭐ 八角', en:'⭐ Star Anise', nl:'⭐ Steranijs'},
                        {zh:'🫘 酱油', en:'🫘 Soy Sauce', nl:'🫘 Sojasaus'},
                    ],
                    distractors: [
                        {zh:'🍌 香蕉', en:'🍌 Banana', nl:'🍌 Banaan'},
                        {zh:'🧀 奶酪', en:'🧀 Cheese', nl:'🧀 Kaas'},
                        {zh:'🥥 椰子', en:'🥥 Coconut', nl:'🥥 Kokosnoot'},
                        {zh:'🍋 柠檬', en:'🍋 Lemon', nl:'🍋 Citroen'},
                        {zh:'🥦 西兰花', en:'🥦 Broccoli', nl:'🥦 Broccoli'},
                        {zh:'🍇 葡萄', en:'🍇 Grape', nl:'🍇 Druif'},
                        {zh:'🍝 意面', en:'🍝 Pasta', nl:'🍝 Pasta'},
                        {zh:'🍫 巧克力', en:'🍫 Chocolate', nl:'🍫 Chocolade'},
                    ],
                    steps: [
                        {zh:'五花肉切块焯水', en:'Cut pork and blanch', nl:'Snijd buikspek en blancheer'},
                        {zh:'锅中炒糖色', en:'Caramelize sugar in wok', nl:'Karamelliseer suiker in de wok'},
                        {zh:'放入肉块翻炒上色', en:'Stir-fry pork until browned', nl:'Roerbak het vlees tot het bruin is'},
                        {zh:'加姜蒜葱八角爆香', en:'Add ginger, garlic, scallion, star anise', nl:'Voeg gember, knoflook, ui en steranijs toe'},
                        {zh:'加酱油和开水没过肉', en:'Add soy sauce and water to cover', nl:'Voeg sojasaus en water toe'},
                        {zh:'大火烧开转小火炖1小时', en:'Bring to boil then simmer 1 hour', nl:'Breng aan de kook en sudder 1 uur'},
                        {zh:'大火收汁', en:'Reduce sauce on high heat', nl:'Reduceer de saus op hoog vuur'},
                    ]
                },
                {
                    name: {zh:'泰式绿咖喱', en:'Thai Green Curry', nl:'Thaise Groene Curry'}, emoji: '🍛',
                    ingredients: [
                        {zh:'🍗 鸡肉', en:'🍗 Chicken', nl:'🍗 Kip'},
                        {zh:'🥥 椰奶', en:'🥥 Coconut Milk', nl:'🥥 Kokosmelk'},
                        {zh:'🌶️ 青咖喱酱', en:'🌶️ Green Curry Paste', nl:'🌶️ Groene Currypasta'},
                        {zh:'🍆 茄子', en:'🍆 Eggplant', nl:'🍆 Aubergine'},
                        {zh:'🫑 青椒', en:'🫑 Green Pepper', nl:'🫑 Groene Paprika'},
                        {zh:'🌿 罗勒', en:'🌿 Basil', nl:'🌿 Basilicum'},
                    ],
                    distractors: [
                        {zh:'🍝 意面', en:'🍝 Pasta', nl:'🍝 Pasta'},
                        {zh:'🧀 帕玛森', en:'🧀 Parmesan', nl:'🧀 Parmezaan'},
                        {zh:'🍎 苹果', en:'🍎 Apple', nl:'🍎 Appel'},
                        {zh:'🍞 面包', en:'🍞 Bread', nl:'🍞 Brood'},
                        {zh:'🧈 黄油', en:'🧈 Butter', nl:'🧈 Boter'},
                        {zh:'🍫 巧克力', en:'🍫 Chocolate', nl:'🍫 Chocolade'},
                        {zh:'🥕 胡萝卜', en:'🥕 Carrot', nl:'🥕 Wortel'},
                        {zh:'🍚 米饭', en:'🍚 Rice', nl:'🍚 Rijst'},
                    ],
                    steps: [
                        {zh:'热锅加入部分椰奶', en:'Heat wok and add some coconut milk', nl:'Verwarm wok en voeg wat kokosmelk toe'},
                        {zh:'炒香青咖喱酱', en:'Fry green curry paste', nl:'Bak de groene currypasta'},
                        {zh:'放入鸡肉翻炒变色', en:'Stir-fry chicken until colored', nl:'Roerbak de kip tot ze kleurt'},
                        {zh:'倒入剩余椰奶', en:'Add remaining coconut milk', nl:'Voeg de rest van de kokosmelk toe'},
                        {zh:'加入茄子和青椒煮软', en:'Add eggplant and pepper until soft', nl:'Voeg aubergine en paprika toe tot ze zacht zijn'},
                        {zh:'最后加罗勒叶关火', en:'Add basil and turn off heat', nl:'Voeg basilicum toe en zet het vuur uit'},
                    ]
                },
            ]
        };

        // ============================================================
        // 状态
        // ============================================================
        const phase = ref('intro');           // intro | conveyor | cooking | roundResult | feedback
        const currentRound = ref(0);
        const currentRecipe = ref(null);
        const timeLeft = ref(0);
        let timer = null;
        let conveyorTimer = null;
        let gameStartTime = 0;

        // 传送带状态
        const conveyorItems = ref([]);        // { id, name, emoji, needed, x }
        const selectedIngredients = ref([]);   // 已选的食材名
        const missedIngredients = ref([]);     // 漏选的需要食材
        const wrongSelections = ref([]);       // 错选的干扰食材
        let conveyorItemId = 0;
        let spawnTimer = null;

        // 烹饪步骤状态
        const shuffledSteps = ref([]);        // 乱序的步骤
        const userStepOrder = ref([]);        // 用户排列的顺序
        const stepResult = ref(null);         // null | 'correct' | 'wrong'

        // 每轮结果
        const roundResults = ref([]);

        // ============================================================
        // 菜谱选择
        // ============================================================
        const getRecipesPool = () => {
            const d = config.value.difficulty;
            if (d === 'easy') return [...RECIPES.easy];
            if (d === 'hard') return [...RECIPES.easy, ...RECIPES.medium, ...RECIPES.hard];
            return [...RECIPES.easy, ...RECIPES.medium]; // medium
        };

        const pickRecipe = () => {
            const pool = getRecipesPool();
            // Avoid repeat
            const used = roundResults.value.map(r => r.recipeName);
            const available = pool.filter(r => !used.includes(r.name));
            const list = available.length > 0 ? available : pool;
            return list[Math.floor(Math.random() * list.length)];
        };

        // ============================================================
        // 传送带阶段
        // ============================================================
        const startConveyorPhase = () => {
            currentRecipe.value = pickRecipe();
            selectedIngredients.value = [];
            missedIngredients.value = [];
            wrongSelections.value = [];
            conveyorItems.value = [];
            conveyorItemId = 0;
            timeLeft.value = config.value.timePerRound;
            phase.value = 'conveyor';

            // Build item pool: needed items + distractors
            const needed = currentRecipe.value.ingredients.map(i => ({ name: i, needed: true }));
            const distractors = currentRecipe.value.distractors.map(i => ({ name: i, needed: false }));
            const pool = [...needed, ...distractors];

            // Ensure each needed item appears at least once, rest random
            const totalItems = Math.max(needed.length * 2, 12);
            const schedule = [...needed];
            while (schedule.length < totalItems) {
                schedule.push(pool[Math.floor(Math.random() * pool.length)]);
            }
            // Shuffle
            for (let i = schedule.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
            }

            let spawnIndex = 0;
            const spawnItem = () => {
                if (phase.value !== 'conveyor' || spawnIndex >= schedule.length) return;
                const item = schedule[spawnIndex++];
                const nameStr = tr(item.name);
                const parts = nameStr.split(' ');
                conveyorItems.value.push({
                    id: conveyorItemId++,
                    name: item.name,
                    emoji: parts[0],
                    label: parts.slice(1).join(' '),
                    needed: item.needed,
                    selected: false,
                    missed: false,
                    x: 100 // start off screen right (%)
                });
                // Schedule next
                if (spawnIndex < schedule.length) {
                    spawnTimer = setTimeout(spawnItem, config.value.conveyorInterval);
                }
            };

            // Start spawning
            spawnTimer = setTimeout(spawnItem, 500);

            // Move items left — use conveyorSpeed (ms to cross full width)
            let lastFrameTime = 0;
            const moveItems = (timestamp) => {
                if (phase.value !== 'conveyor') return;
                if (!lastFrameTime) lastFrameTime = timestamp;
                const dt = timestamp - lastFrameTime;
                lastFrameTime = timestamp;

                // pixels-per-ms: 115% total travel (100% visible + 15% off-screen)
                // conveyorSpeed = ms to cross, so speed = 115 / conveyorSpeed per ms
                const speed = 115 / config.value.conveyorSpeed; // %/ms
                const dx = speed * dt;

                conveyorItems.value.forEach(item => {
                    if (!item.selected) {
                        item.x -= dx;
                    }
                });
                // Check missed (off screen left)
                conveyorItems.value = conveyorItems.value.filter(item => {
                    if (item.x < -15 && !item.selected) {
                        if (item.needed && !selectedIngredients.value.includes(item.name)) {
                            // Only count as missed if we haven't already picked this ingredient
                            if (!missedIngredients.value.includes(item.name) && !selectedIngredients.value.includes(item.name)) {
                                missedIngredients.value.push(item.name);
                            }
                        }
                        return false;
                    }
                    return true;
                });
                conveyorTimer = requestAnimationFrame(moveItems);
            };
            conveyorTimer = requestAnimationFrame(moveItems);

            // Timer
            timer = setInterval(() => {
                timeLeft.value--;
                if (timeLeft.value <= 0) {
                    endConveyorPhase();
                }
            }, 1000);
        };

        const selectConveyorItem = (item) => {
            if (phase.value !== 'conveyor' || item.selected) return;
            item.selected = true;

            if (item.needed) {
                if (!selectedIngredients.value.includes(item.name)) {
                    selectedIngredients.value.push(item.name);
                }
                // Check if all collected
                const allNeeded = currentRecipe.value.ingredients;
                if (allNeeded.every(n => selectedIngredients.value.includes(n))) {
                    setTimeout(() => endConveyorPhase(), 600);
                }
            } else {
                wrongSelections.value.push(item.name);
            }
        };

        const endConveyorPhase = () => {
            clearInterval(timer);
            clearTimeout(spawnTimer);
            cancelAnimationFrame(conveyorTimer);

            // Check for any ingredients on belt that weren't collected
            const allNeeded = currentRecipe.value.ingredients;
            allNeeded.forEach(n => {
                if (!selectedIngredients.value.includes(n) && !missedIngredients.value.includes(n)) {
                    missedIngredients.value.push(n);
                }
            });

            startCookingPhase();
        };

        // ============================================================
        // 烹饪步骤阶段
        // ============================================================
        const startCookingPhase = () => {
            const steps = [...currentRecipe.value.steps];
            // Shuffle
            const shuffled = [...steps];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            shuffledSteps.value = shuffled;
            userStepOrder.value = [];
            stepResult.value = null;
            timeLeft.value = config.value.stepTimeLimit;
            phase.value = 'cooking';

            timer = setInterval(() => {
                timeLeft.value--;
                if (timeLeft.value <= 0) {
                    clearInterval(timer);
                    checkStepOrder();
                }
            }, 1000);
        };

        const selectStep = (step) => {
            if (stepResult.value !== null) return;
            if (userStepOrder.value.includes(step)) {
                // Deselect: remove this and all after it
                const idx = userStepOrder.value.indexOf(step);
                userStepOrder.value = userStepOrder.value.slice(0, idx);
            } else {
                userStepOrder.value.push(step);
                if (userStepOrder.value.length === shuffledSteps.value.length) {
                    clearInterval(timer);
                    setTimeout(() => checkStepOrder(), 300);
                }
            }
        };

        const stepOrderIndex = (step) => {
            const idx = userStepOrder.value.indexOf(step);
            return idx >= 0 ? idx + 1 : null;
        };

        const checkStepOrder = () => {
            const correct = currentRecipe.value.steps;
            const isCorrect = userStepOrder.value.length === correct.length &&
                userStepOrder.value.every((s, i) => s === correct[i]);
            stepResult.value = isCorrect ? 'correct' : 'wrong';

            // Record round result
            const ingredientScore = selectedIngredients.value.filter(
                n => currentRecipe.value.ingredients.includes(n)
            ).length;
            const ingredientTotal = currentRecipe.value.ingredients.length;

            roundResults.value.push({
                recipeName: currentRecipe.value.name,
                ingredientScore,
                ingredientTotal,
                wrongSelections: wrongSelections.value.length,
                missedIngredients: missedIngredients.value.length,
                stepsCorrect: isCorrect,
                stepsOrderedCount: userStepOrder.value.length,
                stepsTotal: correct.length
            });

            phase.value = 'roundResult';
        };

        const nextRound = () => {
            currentRound.value++;
            if (currentRound.value >= config.value.totalRounds) {
                phase.value = 'feedback';
            } else {
                startConveyorPhase();
            }
        };

        // ============================================================
        // 游戏流程
        // ============================================================
        const startGame = () => {
            currentRound.value = 0;
            roundResults.value = [];
            gameStartTime = performance.now();
            startConveyorPhase();
        };

        // ============================================================
        // 统计
        // ============================================================
        const totalIngredientScore = computed(() =>
            roundResults.value.reduce((s, r) => s + r.ingredientScore, 0)
        );
        const totalIngredientMax = computed(() =>
            roundResults.value.reduce((s, r) => s + r.ingredientTotal, 0)
        );
        const totalStepsCorrect = computed(() =>
            roundResults.value.filter(r => r.stepsCorrect).length
        );
        const overallAccuracy = computed(() => {
            if (roundResults.value.length === 0) return 0;
            const ingPct = totalIngredientMax.value > 0
                ? totalIngredientScore.value / totalIngredientMax.value : 0;
            const stepPct = totalStepsCorrect.value / roundResults.value.length;
            return Math.round(((ingPct + stepPct) / 2) * 100);
        });
        const performanceLevel = computed(() => {
            if (overallAccuracy.value >= 80) return 'excellent';
            if (overallAccuracy.value >= 50) return 'good';
            return 'needsPractice';
        });
        const progressPercent = computed(() =>
            Math.round(((currentRound.value) / config.value.totalRounds) * 100)
        );

        // For conveyor display: how many still needed
        const neededRemaining = computed(() => {
            if (!currentRecipe.value) return 0;
            return currentRecipe.value.ingredients.filter(
                n => !selectedIngredients.value.includes(n)
            ).length;
        });

        // ============================================================
        // 完成
        // ============================================================
        const finishGame = () => {
            clearInterval(timer);
            clearTimeout(spawnTimer);
            cancelAnimationFrame(conveyorTimer);
            emit('complete', {
                success: overallAccuracy.value >= 50,
                totalRounds: config.value.totalRounds,
                difficulty: config.value.difficulty,
                overallAccuracy: overallAccuracy.value,
                totalIngredientScore: totalIngredientScore.value,
                totalIngredientMax: totalIngredientMax.value,
                totalStepsCorrect: totalStepsCorrect.value,
                totalTime: Math.round(performance.now() - gameStartTime),
                rounds: roundResults.value.map(r => ({ ...r, recipeName: tr(r.recipeName) }))
            });
        };

        // ============================================================
        // 生命周期
        // ============================================================
        onMounted(() => {
            if (window.lucide) window.lucide.createIcons();
        });
        onUnmounted(() => {
            clearInterval(timer);
            clearTimeout(spawnTimer);
            cancelAnimationFrame(conveyorTimer);
        });

        return {
            config, phase, currentRound, currentRecipe, timeLeft,
            conveyorItems, selectedIngredients, missedIngredients, wrongSelections,
            shuffledSteps, userStepOrder, stepResult,
            roundResults,
            neededRemaining,
            totalIngredientScore, totalIngredientMax, totalStepsCorrect,
            overallAccuracy, performanceLevel, progressPercent,
            startGame, selectConveyorItem,
            selectStep, stepOrderIndex, nextRound, finishGame,
            t, tr, trJoin
        };
    },

    // ============================================================
    // 模板
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-orange-50 to-white">

        <!-- 顶部 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-orange-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-orange-100 p-3 rounded-xl">
                    <span class="text-3xl">🍳</span>
                </div>
                <div>
                    <span class="text-orange-600 font-bold text-sm uppercase tracking-wider">{{ t('headerLabel') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ t('headerTitle') }}</h2>
                </div>
                <div v-if="phase !== 'intro' && phase !== 'feedback'" class="ml-auto flex items-center gap-3">
                    <span class="text-sm text-slate-500">{{ t('dishCounter', currentRound + 1, config.totalRounds) }}</span>
                    <span class="text-2xl font-black" :class="timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'">
                        {{ timeLeft }}s
                    </span>
                </div>
            </div>
            <div v-if="phase !== 'intro' && phase !== 'feedback'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-orange-500 transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
                </div>
            </div>
        </div>

        <!-- 中间 -->
        <div class="flex-grow overflow-y-auto flex items-center justify-center p-4">

            <!-- ====== INTRO ====== -->
            <div v-if="phase === 'intro'" class="text-center max-w-lg">
                <div class="text-6xl mb-4">👨‍🍳</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('welcomeTitle') }}</h3>
                <div class="bg-white rounded-2xl p-5 border border-orange-200 shadow-sm text-left mb-6 space-y-4">
                    <p class="text-slate-600 leading-relaxed" v-html="t('introDesc')"></p>
                    <div class="bg-orange-50 rounded-xl p-4 space-y-3">
                        <div class="flex items-start gap-3">
                            <span class="bg-orange-200 text-orange-700 font-black rounded-full w-7 h-7 flex items-center justify-center text-sm shrink-0">1</span>
                            <div>
                                <p class="font-bold text-orange-800">{{ t('phase1Title') }}</p>
                                <p class="text-sm text-slate-600" v-html="t('phase1Desc')"></p>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <span class="bg-orange-200 text-orange-700 font-black rounded-full w-7 h-7 flex items-center justify-center text-sm shrink-0">2</span>
                            <div>
                                <p class="font-bold text-orange-800">{{ t('phase2Title') }}</p>
                                <p class="text-sm text-slate-600" v-html="t('phase2Desc')"></p>
                            </div>
                        </div>
                    </div>
                    <p class="text-slate-500 text-sm">{{ t('introFooter', config.totalRounds) }}</p>
                </div>
                <button @click="startGame"
                    class="bg-orange-600 hover:bg-orange-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#9a3412] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('startBtn') }}
                </button>
            </div>

            <!-- ====== CONVEYOR PHASE ====== -->
            <div v-if="phase === 'conveyor'" class="w-full max-w-2xl">
                <!-- Recipe Card -->
                <div class="bg-white rounded-2xl border-2 border-orange-200 p-4 mb-4 flex items-center gap-4">
                    <span class="text-4xl">{{ currentRecipe.emoji }}</span>
                    <div class="flex-1">
                        <h3 class="font-black text-lg text-slate-800">{{ tr(currentRecipe.name) }}</h3>
                        <p class="text-sm text-slate-500">{{ t('needIngredients', currentRecipe.ingredients.length) }} <strong class="text-orange-600">{{ t('remainCount', neededRemaining) }}</strong></p>
                    </div>
                    <div class="flex flex-wrap gap-1">
                        <span v-for="ing in currentRecipe.ingredients" :key="ing"
                              class="text-xs px-2 py-1 rounded-full font-bold"
                              :class="selectedIngredients.includes(ing) ? 'bg-green-100 text-green-700 line-through' : 'bg-orange-100 text-orange-700'">
                            {{ tr(ing) }}
                        </span>
                    </div>
                </div>

                <!-- Conveyor Belt -->
                <div class="relative bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-2xl h-32 overflow-hidden border-2 border-slate-300 mb-4">
                    <!-- Belt lines -->
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full h-1 bg-slate-300 opacity-50"></div>
                    </div>
                    <div class="absolute top-2 left-2 text-xs text-slate-400 font-bold">{{ t('conveyorLabel') }}</div>

                    <!-- Items on belt -->
                    <div v-for="item in conveyorItems" :key="item.id"
                         class="absolute top-1/2 -translate-y-1/2 cursor-pointer select-none transition-transform"
                         :style="{ left: item.x + '%' }"
                         :class="item.selected ? 'scale-0 opacity-0' : 'hover:scale-110'"
                         @click="selectConveyorItem(item)">
                        <div class="bg-white rounded-xl shadow-md border-2 px-3 py-2 flex flex-col items-center min-w-[64px]"
                             :class="item.selected ? (item.needed ? 'border-green-400' : 'border-red-400') : 'border-slate-200 hover:border-orange-400'">
                            <span class="text-2xl">{{ item.emoji }}</span>
                            <span class="text-[10px] font-bold text-slate-600 mt-0.5 whitespace-nowrap">{{ item.label }}</span>
                        </div>
                    </div>
                </div>

                <!-- Selection status -->
                <div class="flex items-center gap-4 text-sm">
                    <div class="flex items-center gap-1 text-green-600">
                        <span class="font-bold">{{ t('selectedLabel') }} {{ selectedIngredients.length }}</span>
                    </div>
                    <div v-if="wrongSelections.length > 0" class="flex items-center gap-1 text-red-500">
                        <span class="font-bold">{{ t('wrongLabel') }} {{ wrongSelections.length }}</span>
                    </div>
                </div>
            </div>

            <!-- ====== COOKING STEPS PHASE ====== -->
            <div v-if="phase === 'cooking'" class="w-full max-w-lg">
                <div class="text-center mb-4">
                    <span class="text-3xl">{{ currentRecipe.emoji }}</span>
                    <h3 class="font-black text-lg text-slate-800">{{ tr(currentRecipe.name) }} — {{ t('arrangeSteps') }}</h3>
                    <p class="text-sm text-slate-500">{{ t('cookingInstr') }}</p>
                </div>

                <div class="space-y-2">
                    <button v-for="(step, idx) in shuffledSteps" :key="step"
                        @click="selectStep(step)"
                        class="w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all flex items-center gap-3"
                        :class="[
                            userStepOrder.includes(step)
                                ? 'bg-orange-100 border-orange-400 text-orange-800'
                                : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-700',
                        ]"
                        :disabled="stepResult !== null">
                        <span v-if="stepOrderIndex(step)"
                              class="bg-orange-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0">
                            {{ stepOrderIndex(step) }}
                        </span>
                        <span v-else class="w-7 h-7 rounded-full border-2 border-slate-300 shrink-0"></span>
                        <span>{{ tr(step) }}</span>
                    </button>
                </div>
            </div>

            <!-- ====== ROUND RESULT ====== -->
            <div v-if="phase === 'roundResult'" class="text-center max-w-md w-full">
                <span class="text-5xl">{{ currentRecipe.emoji }}</span>
                <h3 class="text-xl font-black text-slate-800 mt-2 mb-4">{{ tr(currentRecipe.name) }} — {{ t('doneLabel') }}</h3>

                <div class="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-4">
                    <!-- Ingredients -->
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-600">{{ t('ingredientPickup') }}</span>
                        <span class="font-black text-lg"
                              :class="missedIngredients.length === 0 && wrongSelections.length === 0 ? 'text-green-600' : 'text-amber-600'">
                            {{ selectedIngredients.filter(n => currentRecipe.ingredients.includes(n)).length }} / {{ currentRecipe.ingredients.length }}
                        </span>
                    </div>
                    <div v-if="wrongSelections.length > 0" class="text-xs text-red-500">
                        {{ t('wrongPicks') }} {{ trJoin(wrongSelections) }}
                    </div>
                    <div v-if="missedIngredients.length > 0" class="text-xs text-amber-500">
                        {{ t('missedPicks') }} {{ trJoin(missedIngredients) }}
                    </div>

                    <!-- Steps -->
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-600">{{ t('stepOrdering') }}</span>
                        <span class="font-black text-lg" :class="stepResult === 'correct' ? 'text-green-600' : 'text-red-500'">
                            {{ stepResult === 'correct' ? t('correctResult') : t('wrongResult') }}
                        </span>
                    </div>
                    <div v-if="stepResult === 'wrong'" class="text-xs text-slate-500">
                        <p class="font-bold mb-1">{{ t('correctOrder') }}</p>
                        <ol class="list-decimal list-inside space-y-0.5">
                            <li v-for="(s, i) in currentRecipe.steps" :key="i">{{ tr(s) }}</li>
                        </ol>
                    </div>
                </div>

                <button @click="nextRound"
                    class="btn bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl font-bold text-base">
                    {{ currentRound + 1 >= config.totalRounds ? t('viewResults') : t('nextDish') }}
                </button>
            </div>

            <!-- ====== FEEDBACK ====== -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">
                    {{ performanceLevel === 'excellent' ? '👨‍🍳' : performanceLevel === 'good' ? '🍽️' : '🔥' }}
                </div>
                <h3 class="text-2xl font-black mb-1"
                    :class="performanceLevel === 'excellent' ? 'text-green-600'
                          : performanceLevel === 'good' ? 'text-blue-600' : 'text-orange-600'">
                    {{ performanceLevel === 'excellent' ? t('excellent') : performanceLevel === 'good' ? t('good') : t('needsPractice') }}
                </h3>
                <p class="text-slate-500 mb-5">{{ t('challengeDiff', config.difficulty === 'easy' ? t('diffEasy') : config.difficulty === 'medium' ? t('diffMedium') : t('diffHard')) }}</p>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-orange-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-orange-700">{{ overallAccuracy }}%</div>
                            <div class="text-xs text-orange-500 font-bold">{{ t('overallScore') }}</div>
                        </div>
                        <div class="bg-green-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-green-700">{{ totalIngredientScore }}/{{ totalIngredientMax }}</div>
                            <div class="text-xs text-green-500 font-bold">{{ t('ingredientCorrect') }}</div>
                        </div>
                        <div class="bg-blue-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-blue-700">{{ totalStepsCorrect }}/{{ config.totalRounds }}</div>
                            <div class="text-xs text-blue-500 font-bold">{{ t('stepsCorrectLabel') }}</div>
                        </div>
                    </div>

                    <!-- Per-round breakdown -->
                    <div class="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <div v-for="(r, i) in roundResults" :key="i" class="flex items-center justify-between text-sm">
                            <span class="text-slate-600">{{ tr(r.recipeName) }}</span>
                            <div class="flex items-center gap-3 text-xs">
                                <span :class="r.ingredientScore === r.ingredientTotal ? 'text-green-600' : 'text-amber-500'">
                                    🛒 {{ r.ingredientScore }}/{{ r.ingredientTotal }}
                                </span>
                                <span :class="r.stepsCorrect ? 'text-green-600' : 'text-red-500'">
                                    📋 {{ r.stepsCorrect ? '✓' : '✗' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部 -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            <div v-if="phase === 'conveyor'" class="text-center text-slate-400 text-sm">
                {{ t('conveyorHint') }}
            </div>
            <div v-if="phase === 'cooking'" class="text-center text-slate-400 text-sm">
                {{ t('cookingHint') }}
            </div>
            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finishBtn') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.CookingGame = CookingGame;
