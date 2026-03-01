/**
 * 图书整理游戏 (Library Sorting Game)
 * 高认知负荷：扮演图书管理员，根据多维度规则将书籍放入正确的书架
 *
 * 玩法：
 *   每轮给出一组书籍和若干书架（按类别/颜色/编号区间等规则）
 *   Phase A — 分类上架：根据当前规则将书拖到正确书架
 *   Phase B — 规则切换：规则变化（如从按类别改为按编号），同一批书需重新分类
 *
 * 认知负荷来源：
 *   - 工作记忆：记住当前规则 + 多本书的属性
 *   - 抑制控制：规则切换后抑制之前的分类习惯
 *   - 注意力分配：同时关注书的类别、颜色标签、编号
 *   - 时间压力：限时完成
 */
const LibrarySortGame = {
    name: 'LibrarySortGame',
    props: ['scenario'],
    emits: ['complete'],

    setup(props, { emit }) {
        const { ref, computed, onMounted, onUnmounted } = Vue;

        // ============================================================
        // 配置
        // ============================================================
        const defaultScenario = {
            totalRounds: 4,
            booksPerRound: 6,
            timePerRound: 30,         // seconds
            enableRuleSwitch: true,   // 是否启用规则切换（Phase B）
            difficulty: 'medium',     // easy | medium | hard
        };

        const config = ref({ ...defaultScenario, ...(props.scenario || {}) });

        // ============================================================
        // i18n
        // ============================================================
        const TEXTS = {
            headerLabel:     { zh: '图书管理员', en: 'Librarian', nl: 'Bibliothecaris' },
            headerTitle:     { zh: '图书整理', en: 'Library Sort', nl: 'Boeken sorteren' },
            roundCounter:    { zh: '第 {0}/{1} 轮', en: 'Round {0}/{1}', nl: 'Ronde {0}/{1}' },
            welcomeTitle:    { zh: '欢迎来到图书馆！', en: 'Welcome to the Library!', nl: 'Welkom in de bibliotheek!' },
            welcomeDesc:     { zh: '你是图书管理员，桌上有一堆书需要整理上架。', en: 'You are the librarian. There\'s a pile of books that need to be shelved.', nl: 'Je bent de bibliothecaris. Er ligt een stapel boeken die gesorteerd moeten worden.' },
            instrStep1Title: { zh: '📂 按规则分类', en: '📂 Sort by Rules', nl: '📂 Sorteer volgens regels' },
            instrStep1Desc:  { zh: '每本书有<strong>类别</strong>、<strong>颜色标签</strong>和<strong>编号</strong>三种属性。根据当前规则，将书放到正确的书架上。', en: 'Each book has three attributes: <strong>category</strong>, <strong>color tag</strong>, and <strong>number</strong>. Place books on the correct shelf based on the current rule.', nl: 'Elk boek heeft drie kenmerken: <strong>categorie</strong>, <strong>kleurlabel</strong> en <strong>nummer</strong>. Plaats boeken op de juiste plank volgens de huidige regel.' },
            instrStep2Title: { zh: '🔄 规则切换', en: '🔄 Rule Switch', nl: '🔄 Regelwissel' },
            instrStep2Desc:  { zh: '完成后<strong>规则会改变</strong>！同样的书，需要按<strong>新规则</strong>重新分类！', en: 'After finishing, <strong>the rule changes</strong>! The same books must be re-sorted by the <strong>new rule</strong>!', nl: 'Na afronding <strong>verandert de regel</strong>! Dezelfde boeken moeten opnieuw gesorteerd worden volgens de <strong>nieuwe regel</strong>!' },
            instrHint:       { zh: '仔细看每本书的<strong>类别 📖</strong>、<strong>颜色标签 🏷️</strong>、<strong>编号 🔢</strong>，然后放到正确书架上！', en: 'Look carefully at each book\'s <strong>category 📖</strong>, <strong>color tag 🏷️</strong>, <strong>number 🔢</strong>, then place it on the correct shelf!', nl: 'Let goed op de <strong>categorie 📖</strong>, het <strong>kleurlabel 🏷️</strong> en het <strong>nummer 🔢</strong> van elk boek en plaats het op de juiste plank!' },
            instrFooter:     { zh: '📍 共 {0} 轮 · 每轮 {1} 本书 · ⏱ 限时 {2} 秒', en: '📍 {0} rounds · {1} books per round · ⏱ {2} seconds', nl: '📍 {0} rondes · {1} boeken per ronde · ⏱ {2} seconden' },
            startBtn:        { zh: '开始整理！', en: 'Start Sorting!', nl: 'Begin met sorteren!' },
            ruleSwitched:    { zh: '⚡ 规则已切换！', en: '⚡ Rule switched!', nl: '⚡ Regel gewijzigd!' },
            booksUnit:       { zh: '本', en: 'books', nl: 'boeken' },
            booksToSort:     { zh: '📚 待整理的书 (点击选中, 再点击书架放入)', en: '📚 Books to sort (click to select, then click a shelf)', nl: '📚 Te sorteren boeken (klik om te selecteren, klik dan op een plank)' },
            remaining:       { zh: '剩余 {0} 本', en: '{0} remaining', nl: '{0} resterend' },
            roundComplete:   { zh: '第 {0} 轮完成！', en: 'Round {0} complete!', nl: 'Ronde {0} voltooid!' },
            viewResults:     { zh: '查看结果', en: 'View Results', nl: 'Bekijk resultaten' },
            nextRound:       { zh: '下一轮 →', en: 'Next Round →', nl: 'Volgende ronde →' },
            excellent:       { zh: '金牌管理员！', en: 'Gold Librarian!', nl: 'Gouden bibliothecaris!' },
            good:            { zh: '整理达人！', en: 'Sorting Expert!', nl: 'Sorteerexpert!' },
            needsPractice:   { zh: '继续练习！', en: 'Keep Practicing!', nl: 'Blijf oefenen!' },
            gameDiff:        { zh: '图书整理 · {0}', en: 'Library Sort · {0}', nl: 'Boeken sorteren · {0}' },
            diffEasy:        { zh: '简单', en: 'Easy', nl: 'Makkelijk' },
            diffMedium:      { zh: '中等', en: 'Medium', nl: 'Gemiddeld' },
            diffHard:        { zh: '困难', en: 'Hard', nl: 'Moeilijk' },
            overallAccuracy: { zh: '综合正确率', en: 'Overall Accuracy', nl: 'Totale nauwkeurigheid' },
            firstSort:       { zh: '首次分类', en: 'First Sort', nl: 'Eerste sortering' },
            afterSwitch:     { zh: '规则切换后', en: 'After Switch', nl: 'Na regelwissel' },
            roundN:          { zh: '第 {0} 轮', en: 'Round {0}', nl: 'Ronde {0}' },
            hintSelect:      { zh: '👆 点击一本书选中', en: '👆 Click a book to select', nl: '👆 Klik op een boek om te selecteren' },
            hintSelected:    { zh: '📖 「{0}」已选中 — 点击书架放入', en: '📖 "{0}" selected — click a shelf to place', nl: '📖 "{0}" geselecteerd — klik op een plank' },
            finishBtn:       { zh: '完成', en: 'Finish', nl: 'Voltooien' },
        };
        const lang = computed(() => config.value.lang || 'zh');
        const t = (key, ...args) => {
            let s = TEXTS[key]?.[lang.value] || TEXTS[key]?.en || key;
            args.forEach((a, i) => { s = s.replace(`{${i}}`, a); });
            return s;
        };
        const tr = (obj) => typeof obj === 'string' ? obj : (obj?.[lang.value] || obj?.en || '');

        // ============================================================
        // 书籍与书架数据
        // ============================================================
        const CATEGORIES = [
            { id: 'fiction',   label: { zh: '小说', en: 'Fiction', nl: 'Fictie' },       emoji: '📖', color: 'blue'   },
            { id: 'science',   label: { zh: '科学', en: 'Science', nl: 'Wetenschap' },   emoji: '🔬', color: 'green'  },
            { id: 'history',   label: { zh: '历史', en: 'History', nl: 'Geschiedenis' },  emoji: '🏛️', color: 'amber'  },
            { id: 'art',       label: { zh: '艺术', en: 'Art', nl: 'Kunst' },             emoji: '🎨', color: 'pink'   },
            { id: 'cooking',   label: { zh: '烹饪', en: 'Cooking', nl: 'Koken' },         emoji: '🍳', color: 'orange' },
            { id: 'travel',    label: { zh: '旅行', en: 'Travel', nl: 'Reizen' },         emoji: '✈️', color: 'cyan'   },
        ];

        const COLOR_LABELS = [
            { id: 'red',    label: { zh: '红标', en: 'Red', nl: 'Rood' },       css: 'bg-red-500',    border: 'border-red-400'    },
            { id: 'blue',   label: { zh: '蓝标', en: 'Blue', nl: 'Blauw' },     css: 'bg-blue-500',   border: 'border-blue-400'   },
            { id: 'green',  label: { zh: '绿标', en: 'Green', nl: 'Groen' },    css: 'bg-green-500',  border: 'border-green-400'  },
            { id: 'yellow', label: { zh: '黄标', en: 'Yellow', nl: 'Geel' },    css: 'bg-yellow-400', border: 'border-yellow-400' },
        ];

        const BOOK_TITLES = {
            fiction: {
                zh: ['百年孤独', '红楼梦', '挪威的森林', '小王子', '三体', '追风筝的人', '1984', '了不起的盖茨比'],
                en: ['One Hundred Years of Solitude', 'Dream of the Red Chamber', 'Norwegian Wood', 'The Little Prince', 'The Three-Body Problem', 'The Kite Runner', '1984', 'The Great Gatsby'],
                nl: ['Honderd jaar eenzaamheid', 'Het verhaal van de steen', 'Noorse bos', 'De kleine prins', 'Het drielichamenprobleem', 'De vliegeraar', '1984', 'De grote Gatsby'],
            },
            science: {
                zh: ['时间简史', '基因传', '宇宙的结构', '物种起源', '自私的基因', '量子力学导论', '混沌学'],
                en: ['A Brief History of Time', 'The Gene', 'The Fabric of the Cosmos', 'On the Origin of Species', 'The Selfish Gene', 'Intro to Quantum Mechanics', 'Chaos'],
                nl: ['Een korte geschiedenis van de tijd', 'Het gen', 'De structuur van de kosmos', 'Over het ontstaan van soorten', 'Het zelfzuchtige gen', 'Inleiding kwantummechanica', 'Chaos'],
            },
            history: {
                zh: ['人类简史', '万历十五年', '枪炮与钢铁', '罗马帝国衰亡史', '明朝那些事儿', '丝绸之路'],
                en: ['Sapiens', 'A Year of No Significance', 'Guns, Germs, and Steel', 'The Decline and Fall of the Roman Empire', 'Ming Dynasty Stories', 'The Silk Roads'],
                nl: ['Sapiens', 'Een jaar zonder betekenis', 'Wapens, ziektekiemen en staal', 'De ondergang van het Romeinse Rijk', 'Verhalen van de Ming', 'De zijderoutes'],
            },
            art: {
                zh: ['艺术的故事', '梵高传', '美的历程', '设计中的设计', '色彩论', '画的秘密'],
                en: ['The Story of Art', 'Lust for Life', 'The Path of Beauty', 'Designing Design', 'Theory of Colours', 'The Secret of Painting'],
                nl: ['Het verhaal van de kunst', 'Lust for Life', 'Het pad van schoonheid', 'Ontwerp van ontwerp', 'Kleurenleer', 'Het geheim van de schilderkunst'],
            },
            cooking: {
                zh: ['食物与厨艺', '盐糖脂', '中华料理百科', '法餐圣经', '面包学', '调味的科学'],
                en: ['On Food and Cooking', 'Salt Sugar Fat', 'Chinese Cuisine Encyclopedia', 'The French Culinary Bible', 'Bread Science', 'The Science of Seasoning'],
                nl: ['Over eten en koken', 'Zout suiker vet', 'Chinese keuken encyclopedie', 'De Franse keukenbijbel', 'Broodwetenschap', 'De wetenschap van kruiden'],
            },
            travel: {
                zh: ['在路上', '瓦尔登湖', '背包十年', '迷失东京', '丝绸之路纪行', '非洲十年'],
                en: ['On the Road', 'Walden', 'A Decade with a Backpack', 'Lost in Tokyo', 'Silk Road Journeys', 'A Decade in Africa'],
                nl: ['Onderweg', 'Walden', 'Tien jaar met een rugzak', 'Verdwaald in Tokio', 'Zijderoute reizen', 'Tien jaar in Afrika'],
            },
        };

        // 分类规则
        const RULES = {
            category: { id: 'category', label: { zh: '按类别分类', en: 'Sort by Category', nl: 'Sorteer op categorie' }, desc: { zh: '将书放到对应类别的书架上', en: 'Place books on the matching category shelf', nl: 'Plaats boeken op de plank van hun categorie' }, icon: '📂' },
            color:    { id: 'color',    label: { zh: '按颜色标签', en: 'Sort by Color Tag', nl: 'Sorteer op kleurlabel' },  desc: { zh: '将书放到对应颜色标签的书架上', en: 'Place books on the matching color tag shelf', nl: 'Plaats boeken op de plank van hun kleurlabel' }, icon: '🏷️' },
            number:   { id: 'number',   label: { zh: '按编号区间', en: 'Sort by Number Range', nl: 'Sorteer op nummerreeks' },  desc: { zh: '将书放到对应编号范围的书架上', en: 'Place books on the matching number range shelf', nl: 'Plaats boeken op de plank van hun nummerreeks' }, icon: '🔢' },
        };

        // ============================================================
        // 状态
        // ============================================================
        const phase = ref('intro');       // intro | sorting | switched | roundResult | feedback
        const currentRound = ref(0);
        const timeLeft = ref(0);
        let timer = null;
        let gameStartTime = 0;

        const currentRule = ref(null);     // 当前规则 object
        const switchedRule = ref(null);    // 切换后的规则（Phase B）
        const activeRule = ref(null);      // 当前生效的规则

        const books = ref([]);             // 当前这轮的书籍
        const shelves = ref([]);           // 当前的书架
        const selectedBook = ref(null);    // 当前选中的书

        // 结果
        const roundResults = ref([]);
        const currentPlacements = ref([]); // { bookId, shelfId, correct }

        // ============================================================
        // 生成书籍
        // ============================================================
        const generateBooks = (count) => {
            const diff = config.value.difficulty;
            // Choose categories based on difficulty
            const numCats = diff === 'easy' ? 3 : diff === 'medium' ? 4 : 5;
            const shuffledCats = [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, numCats);
            const numColors = diff === 'easy' ? 2 : diff === 'medium' ? 3 : 4;
            const usedColors = COLOR_LABELS.slice(0, numColors);

            const result = [];
            for (let i = 0; i < count; i++) {
                const cat = shuffledCats[i % shuffledCats.length];
                const titlesByLang = BOOK_TITLES[cat.id];
                const idx = Math.floor(Math.random() * titlesByLang.zh.length);
                const title = { zh: titlesByLang.zh[idx], en: titlesByLang.en[idx], nl: titlesByLang.nl[idx] };
                const colorLabel = usedColors[Math.floor(Math.random() * usedColors.length)];
                const bookNumber = Math.floor(Math.random() * 900) + 100; // 100-999

                result.push({
                    id: i,
                    title,
                    category: cat,
                    colorLabel,
                    number: bookNumber,
                    placed: false,
                    placedShelf: null,
                });
            }
            // Shuffle
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        };

        // ============================================================
        // 生成书架（根据规则）
        // ============================================================
        const generateShelves = (rule, bookList) => {
            if (rule.id === 'category') {
                const cats = [...new Set(bookList.map(b => b.category.id))];
                return cats.map(cid => {
                    const cat = CATEGORIES.find(c => c.id === cid);
                    return { id: cid, label: tr(cat.label), emoji: cat.emoji, colorCss: `bg-${cat.color}-100 border-${cat.color}-300 text-${cat.color}-700` };
                });
            }
            if (rule.id === 'color') {
                const colors = [...new Set(bookList.map(b => b.colorLabel.id))];
                return colors.map(cid => {
                    const cl = COLOR_LABELS.find(c => c.id === cid);
                    return { id: cid, label: tr(cl.label), emoji: '🏷️', colorCss: `${cl.css} text-white` };
                });
            }
            if (rule.id === 'number') {
                // Create ranges
                const ranges = [
                    { id: 'r1', min: 100, max: 399, label: '100-399', emoji: '1️⃣' },
                    { id: 'r2', min: 400, max: 699, label: '400-699', emoji: '2️⃣' },
                    { id: 'r3', min: 700, max: 999, label: '700-999', emoji: '3️⃣' },
                ];
                return ranges.map(r => ({
                    id: r.id, label: r.label, emoji: r.emoji,
                    colorCss: 'bg-slate-100 border-slate-300 text-slate-700',
                    min: r.min, max: r.max,
                }));
            }
            return [];
        };

        // 判断一本书应该放到哪个书架
        const getCorrectShelf = (book, rule, shelfList) => {
            if (rule.id === 'category') {
                return shelfList.find(s => s.id === book.category.id);
            }
            if (rule.id === 'color') {
                return shelfList.find(s => s.id === book.colorLabel.id);
            }
            if (rule.id === 'number') {
                return shelfList.find(s => book.number >= s.min && book.number <= s.max);
            }
            return null;
        };

        // ============================================================
        // 规则选择
        // ============================================================
        const pickRules = () => {
            const ruleKeys = Object.keys(RULES);
            // Shuffle
            const shuffled = [...ruleKeys].sort(() => Math.random() - 0.5);
            const first = RULES[shuffled[0]];
            const second = RULES[shuffled[1]];
            return { first, second };
        };

        // ============================================================
        // 游戏流程
        // ============================================================
        const startGame = () => {
            currentRound.value = 0;
            roundResults.value = [];
            gameStartTime = performance.now();
            startRound();
        };

        const startRound = () => {
            const { first, second } = pickRules();
            currentRule.value = first;
            switchedRule.value = second;
            activeRule.value = first;

            books.value = generateBooks(config.value.booksPerRound);
            shelves.value = generateShelves(first, books.value);
            currentPlacements.value = [];
            selectedBook.value = null;
            timeLeft.value = config.value.timePerRound;
            phase.value = 'sorting';

            startTimer();
        };

        const startTimer = () => {
            clearInterval(timer);
            timer = setInterval(() => {
                timeLeft.value--;
                if (timeLeft.value <= 0) {
                    clearInterval(timer);
                    onPhaseTimeout();
                }
            }, 1000);
        };

        const onPhaseTimeout = () => {
            if (phase.value === 'sorting') {
                // Auto-fail remaining unplaced books
                books.value.forEach(b => {
                    if (!b.placed) {
                        currentPlacements.value.push({ bookId: b.id, shelfId: null, correct: false });
                        b.placed = true;
                    }
                });
                if (config.value.enableRuleSwitch) {
                    startSwitchPhase();
                } else {
                    endRound();
                }
            } else if (phase.value === 'switched') {
                books.value.forEach(b => {
                    if (!b.placed) {
                        currentPlacements.value.push({ bookId: b.id, shelfId: null, correct: false });
                        b.placed = true;
                    }
                });
                endRound();
            }
        };

        const selectBook = (book) => {
            if (book.placed) return;
            selectedBook.value = book;
        };

        const placeOnShelf = (shelf) => {
            if (!selectedBook.value || selectedBook.value.placed) return;

            const book = selectedBook.value;
            const correctShelf = getCorrectShelf(book, activeRule.value, shelves.value);
            const isCorrect = correctShelf && correctShelf.id === shelf.id;

            book.placed = true;
            book.placedShelf = shelf.id;
            book.correct = isCorrect;

            currentPlacements.value.push({
                bookId: book.id,
                shelfId: shelf.id,
                correct: isCorrect,
                bookTitle: book.title,
            });

            selectedBook.value = null;

            // Check if all placed
            if (books.value.every(b => b.placed)) {
                clearInterval(timer);
                if (phase.value === 'sorting' && config.value.enableRuleSwitch) {
                    setTimeout(() => startSwitchPhase(), 800);
                } else {
                    setTimeout(() => endRound(), 800);
                }
            }
        };

        const startSwitchPhase = () => {
            // Reset placement for Phase B with new rule
            activeRule.value = switchedRule.value;
            books.value.forEach(b => { b.placed = false; b.placedShelf = null; b.correct = undefined; });
            shelves.value = generateShelves(switchedRule.value, books.value);
            selectedBook.value = null;
            timeLeft.value = config.value.timePerRound;
            phase.value = 'switched';
            startTimer();
        };

        const endRound = () => {
            clearInterval(timer);

            const phaseAPlacements = currentPlacements.value.filter((_, i) => i < config.value.booksPerRound);
            const phaseBPlacements = currentPlacements.value.filter((_, i) => i >= config.value.booksPerRound);
            const phaseACorrect = phaseAPlacements.filter(p => p.correct).length;
            const phaseBCorrect = phaseBPlacements.filter(p => p.correct).length;

            roundResults.value.push({
                round: currentRound.value + 1,
                ruleA: currentRule.value.label,
                ruleB: config.value.enableRuleSwitch ? switchedRule.value.label : null,
                phaseACorrect,
                phaseATotal: config.value.booksPerRound,
                phaseBCorrect,
                phaseBTotal: config.value.enableRuleSwitch ? config.value.booksPerRound : 0,
            });

            phase.value = 'roundResult';
        };

        const nextRound = () => {
            currentRound.value++;
            if (currentRound.value >= config.value.totalRounds) {
                phase.value = 'feedback';
            } else {
                currentPlacements.value = [];
                startRound();
            }
        };

        // ============================================================
        // 计算
        // ============================================================
        const unplacedBooks = computed(() => books.value.filter(b => !b.placed));

        const totalCorrectA = computed(() => roundResults.value.reduce((s, r) => s + r.phaseACorrect, 0));
        const totalPossibleA = computed(() => roundResults.value.reduce((s, r) => s + r.phaseATotal, 0));
        const totalCorrectB = computed(() => roundResults.value.reduce((s, r) => s + r.phaseBCorrect, 0));
        const totalPossibleB = computed(() => roundResults.value.reduce((s, r) => s + r.phaseBTotal, 0));

        const overallAccuracy = computed(() => {
            const total = totalPossibleA.value + totalPossibleB.value;
            if (total === 0) return 0;
            return Math.round(((totalCorrectA.value + totalCorrectB.value) / total) * 100);
        });

        const performanceLevel = computed(() => {
            if (overallAccuracy.value >= 80) return 'excellent';
            if (overallAccuracy.value >= 50) return 'good';
            return 'needsPractice';
        });

        const progressPercent = computed(() =>
            Math.round((currentRound.value / config.value.totalRounds) * 100)
        );

        const lastRound = computed(() =>
            roundResults.value.length > 0 ? roundResults.value[roundResults.value.length - 1] : null
        );

        // ============================================================
        // 完成
        // ============================================================
        const finishGame = () => {
            clearInterval(timer);
            emit('complete', {
                success: overallAccuracy.value >= 50,
                totalRounds: config.value.totalRounds,
                difficulty: config.value.difficulty,
                enableRuleSwitch: config.value.enableRuleSwitch,
                overallAccuracy: overallAccuracy.value,
                phaseA: { correct: totalCorrectA.value, total: totalPossibleA.value },
                phaseB: { correct: totalCorrectB.value, total: totalPossibleB.value },
                totalTime: Math.round(performance.now() - gameStartTime),
                rounds: roundResults.value,
            });
        };

        // ============================================================
        // 生命周期
        // ============================================================
        onMounted(() => { if (window.lucide) window.lucide.createIcons(); });
        onUnmounted(() => { clearInterval(timer); });

        return {
            config, phase, currentRound, timeLeft,
            currentRule, switchedRule, activeRule,
            books, shelves, selectedBook, unplacedBooks,
            roundResults, lastRound,
            totalCorrectA, totalPossibleA, totalCorrectB, totalPossibleB,
            overallAccuracy, performanceLevel, progressPercent,
            startGame, selectBook, placeOnShelf, nextRound, finishGame,
            t, tr, lang
        };
    },

    // ============================================================
    // 模板
    // ============================================================
    template: `
    <div class="h-full flex flex-col bg-gradient-to-b from-indigo-50 to-white">

        <!-- 顶部 -->
        <div class="bg-white/90 backdrop-blur p-5 border-b border-indigo-100 shrink-0">
            <div class="flex items-center gap-4">
                <div class="bg-indigo-100 p-3 rounded-xl">
                    <span class="text-3xl">📚</span>
                </div>
                <div>
                    <span class="text-indigo-600 font-bold text-sm uppercase tracking-wider">{{ t('headerLabel') }}</span>
                    <h2 class="text-xl font-black text-slate-800">{{ t('headerTitle') }}</h2>
                </div>
                <div v-if="phase !== 'intro' && phase !== 'feedback'" class="ml-auto flex items-center gap-3">
                    <span class="text-sm text-slate-500">{{ t('roundCounter', currentRound + 1, config.totalRounds) }}</span>
                    <span class="text-2xl font-black" :class="timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'">
                        {{ timeLeft }}s
                    </span>
                </div>
            </div>
            <div v-if="phase !== 'intro' && phase !== 'feedback'" class="mt-3">
                <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-500 transition-all duration-300" :style="{ width: progressPercent + '%' }"></div>
                </div>
            </div>
        </div>

        <!-- 中间 -->
        <div class="flex-grow overflow-y-auto flex items-center justify-center p-4">

            <!-- ====== INTRO ====== -->
            <div v-if="phase === 'intro'" class="text-center max-w-lg">
                <div class="text-6xl mb-4">🏛️</div>
                <h3 class="text-2xl font-black text-slate-800 mb-3">{{ t('welcomeTitle') }}</h3>
                <div class="bg-white rounded-2xl p-5 border border-indigo-200 shadow-sm text-left mb-6 space-y-4">
                    <p class="text-slate-600 leading-relaxed">
                        {{ t('welcomeDesc') }}
                    </p>
                    <div class="bg-indigo-50 rounded-xl p-4 space-y-3">
                        <div class="flex items-start gap-3">
                            <span class="bg-indigo-200 text-indigo-700 font-black rounded-full w-7 h-7 flex items-center justify-center text-sm shrink-0">1</span>
                            <div>
                                <p class="font-bold text-indigo-800">{{ t('instrStep1Title') }}</p>
                                <p class="text-sm text-slate-600" v-html="t('instrStep1Desc')"></p>
                            </div>
                        </div>
                        <div v-if="config.enableRuleSwitch" class="flex items-start gap-3">
                            <span class="bg-indigo-200 text-indigo-700 font-black rounded-full w-7 h-7 flex items-center justify-center text-sm shrink-0">2</span>
                            <div>
                                <p class="font-bold text-indigo-800">{{ t('instrStep2Title') }}</p>
                                <p class="text-sm text-slate-600" v-html="t('instrStep2Desc')"></p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-amber-50 rounded-xl p-3 flex items-center gap-2">
                        <span class="text-xl">💡</span>
                        <p class="text-sm text-amber-700" v-html="t('instrHint')"></p>
                    </div>
                    <p class="text-slate-500 text-sm">{{ t('instrFooter', config.totalRounds, config.booksPerRound, config.timePerRound) }}</p>
                </div>
                <button @click="startGame"
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-bold text-lg
                           shadow-[0_4px_0_#3730a3] active:shadow-none active:translate-y-[4px] transition-all">
                    {{ t('startBtn') }}
                </button>
            </div>

            <!-- ====== SORTING / SWITCHED ====== -->
            <div v-if="phase === 'sorting' || phase === 'switched'" class="w-full max-w-3xl">
                <!-- Rule banner -->
                <div class="rounded-xl p-3 mb-4 flex items-center gap-3 text-sm font-bold"
                     :class="phase === 'switched' ? 'bg-amber-100 border-2 border-amber-300 text-amber-800' : 'bg-indigo-100 border-2 border-indigo-200 text-indigo-800'">
                    <span class="text-xl">{{ activeRule.icon }}</span>
                    <div>
                        <div>{{ tr(activeRule.label) }}</div>
                        <div class="font-normal text-xs opacity-75">{{ tr(activeRule.desc) }}</div>
                    </div>
                    <span v-if="phase === 'switched'" class="ml-auto bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs animate-pulse">
                        {{ t('ruleSwitched') }}
                    </span>
                </div>

                <!-- Shelves -->
                <div class="grid gap-3 mb-5" :style="{ gridTemplateColumns: 'repeat(' + shelves.length + ', 1fr)' }">
                    <button v-for="shelf in shelves" :key="shelf.id"
                        @click="placeOnShelf(shelf)"
                        class="rounded-xl border-2 p-4 text-center transition-all min-h-[100px] flex flex-col items-center justify-center gap-1"
                        :class="[
                            selectedBook ? 'cursor-pointer hover:scale-[1.03] hover:shadow-lg ring-2 ring-indigo-300' : 'cursor-default opacity-70',
                            shelf.colorCss || 'bg-slate-100 border-slate-300 text-slate-700'
                        ]"
                        :disabled="!selectedBook">
                        <span class="text-2xl">{{ shelf.emoji }}</span>
                        <span class="font-bold text-sm">{{ shelf.label }}</span>
                        <!-- Show placed count -->
                        <span class="text-xs opacity-60">
                            {{ books.filter(b => b.placedShelf === shelf.id).length }} {{ t('booksUnit') }}
                        </span>
                    </button>
                </div>

                <!-- Books row -->
                <div class="bg-white rounded-2xl border border-slate-200 p-4">
                    <div class="text-xs text-slate-400 font-bold mb-3 flex items-center justify-between">
                        <span>{{ t('booksToSort') }}</span>
                        <span>{{ t('remaining', unplacedBooks.length) }}</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="book in books" :key="book.id"
                            @click="selectBook(book)"
                            class="relative rounded-xl border-2 px-3 py-2 transition-all text-left"
                            :class="[
                                book.placed
                                    ? (book.correct === true ? 'bg-green-50 border-green-300 opacity-50' : book.correct === false ? 'bg-red-50 border-red-300 opacity-50' : 'bg-slate-50 border-slate-200 opacity-30')
                                    : selectedBook && selectedBook.id === book.id
                                        ? 'bg-indigo-100 border-indigo-500 shadow-lg scale-105 ring-2 ring-indigo-300'
                                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow cursor-pointer',
                            ]"
                            :disabled="book.placed">
                            <!-- Color label dot -->
                            <span class="absolute top-1 right-1 w-3 h-3 rounded-full" :class="book.colorLabel.css"></span>
                            <div class="flex items-center gap-2">
                                <span class="text-lg">{{ book.category.emoji }}</span>
                                <div>
                                    <div class="font-bold text-xs text-slate-800 pr-3">{{ tr(book.title) }}</div>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <span class="text-[10px] text-slate-400">{{ tr(book.category.label) }}</span>
                                        <span class="text-[10px] px-1 rounded text-white" :class="book.colorLabel.css">{{ tr(book.colorLabel.label) }}</span>
                                        <span class="text-[10px] text-slate-400 font-mono">#{{ book.number }}</span>
                                    </div>
                                </div>
                            </div>
                            <!-- Placed indicator -->
                            <div v-if="book.placed" class="absolute inset-0 flex items-center justify-center rounded-xl">
                                <span class="text-2xl">{{ book.correct ? '✅' : '❌' }}</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <!-- ====== ROUND RESULT ====== -->
            <div v-if="phase === 'roundResult'" class="text-center max-w-md w-full">
                <div class="text-5xl mb-3">📚</div>
                <h3 class="text-xl font-black text-slate-800 mb-4">{{ t('roundComplete', currentRound + 1) }}</h3>

                <div class="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-3" v-if="lastRound">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-600">{{ tr(lastRound.ruleA) }}</span>
                        <span class="font-black text-lg" :class="lastRound.phaseACorrect === lastRound.phaseATotal ? 'text-green-600' : 'text-amber-600'">
                            {{ lastRound.phaseACorrect }} / {{ lastRound.phaseATotal }}
                        </span>
                    </div>
                    <div v-if="lastRound.ruleB" class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-600">🔄 {{ tr(lastRound.ruleB) }}</span>
                        <span class="font-black text-lg" :class="lastRound.phaseBCorrect === lastRound.phaseBTotal ? 'text-green-600' : 'text-amber-600'">
                            {{ lastRound.phaseBCorrect }} / {{ lastRound.phaseBTotal }}
                        </span>
                    </div>
                </div>

                <button @click="nextRound"
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold">
                    {{ currentRound + 1 >= config.totalRounds ? t('viewResults') : t('nextRound') }}
                </button>
            </div>

            <!-- ====== FEEDBACK ====== -->
            <div v-if="phase === 'feedback'" class="text-center max-w-md w-full">
                <div class="text-6xl mb-3">
                    {{ performanceLevel === 'excellent' ? '🏆' : performanceLevel === 'good' ? '📖' : '💪' }}
                </div>
                <h3 class="text-2xl font-black mb-1"
                    :class="performanceLevel === 'excellent' ? 'text-green-600'
                          : performanceLevel === 'good' ? 'text-blue-600' : 'text-indigo-600'">
                    {{ performanceLevel === 'excellent' ? t('excellent') : performanceLevel === 'good' ? t('good') : t('needsPractice') }}
                </h3>
                <p class="text-slate-500 mb-5">{{ t('gameDiff', config.difficulty === 'easy' ? t('diffEasy') : config.difficulty === 'medium' ? t('diffMedium') : t('diffHard')) }}</p>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
                    <div class="grid gap-4" :class="config.enableRuleSwitch ? 'grid-cols-3' : 'grid-cols-2'">
                        <div class="bg-indigo-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-indigo-700">{{ overallAccuracy }}%</div>
                            <div class="text-xs text-indigo-500 font-bold">{{ t('overallAccuracy') }}</div>
                        </div>
                        <div class="bg-green-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-green-700">{{ totalCorrectA }}/{{ totalPossibleA }}</div>
                            <div class="text-xs text-green-500 font-bold">{{ t('firstSort') }}</div>
                        </div>
                        <div v-if="config.enableRuleSwitch" class="bg-amber-50 rounded-xl p-3">
                            <div class="text-3xl font-black text-amber-700">{{ totalCorrectB }}/{{ totalPossibleB }}</div>
                            <div class="text-xs text-amber-500 font-bold">{{ t('afterSwitch') }}</div>
                        </div>
                    </div>

                    <!-- Per-round -->
                    <div class="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <div v-for="r in roundResults" :key="r.round" class="flex items-center justify-between text-sm">
                            <span class="text-slate-600">{{ t('roundN', r.round) }}</span>
                            <div class="flex items-center gap-3 text-xs">
                                <span :class="r.phaseACorrect === r.phaseATotal ? 'text-green-600' : 'text-amber-500'">
                                    {{ tr(r.ruleA) }}: {{ r.phaseACorrect }}/{{ r.phaseATotal }}
                                </span>
                                <span v-if="r.ruleB" :class="r.phaseBCorrect === r.phaseBTotal ? 'text-green-600' : 'text-amber-500'">
                                    {{ tr(r.ruleB) }}: {{ r.phaseBCorrect }}/{{ r.phaseBTotal }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部 -->
        <div class="bg-white/95 backdrop-blur p-4 border-t border-slate-100 shrink-0 rounded-b-xl">
            <div v-if="phase === 'sorting' || phase === 'switched'" class="text-center text-slate-400 text-sm">
                <span v-if="!selectedBook">{{ t('hintSelect') }}</span>
                <span v-else class="text-indigo-600 font-bold">{{ t('hintSelected', tr(selectedBook.title)) }}</span>
            </div>
            <div v-if="phase === 'feedback'">
                <button @click="finishGame"
                    class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                    {{ t('finishBtn') }}
                </button>
            </div>
        </div>
    </div>
    `
};

window.LibrarySortGame = LibrarySortGame;
