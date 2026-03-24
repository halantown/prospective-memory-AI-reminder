/**
 * Virtual Week i18n System
 * Internationalization support
 */

/**
 * I18n Manager
 * Handles loading and retrieving translations
 */
class I18nManager {
    constructor() {
        this.locales = {};
        this.currentLang = 'zh';
        this.loaded = false;
    }
    
    /**
     * Load all supported locales
     */
    async loadAll() {
        const langs = ['zh', 'en', 'nl'];
        try {
            const results = await Promise.all(
                langs.map(async (lang) => {
                    const res = await fetch(`/locales/${lang}.json`);
                    return { lang, data: await res.json() };
                })
            );
            results.forEach(({ lang, data }) => {
                this.locales[lang] = data;
            });
            this.loaded = true;
            console.log('Locales loaded:', Object.keys(this.locales));
        } catch (e) {
            console.error('Failed to load locales:', e);
        }
    }
    
    /**
     * Set current language
     */
    setLang(lang) {
        if (this.locales[lang]) {
            this.currentLang = lang;
            return true;
        }
        return false;
    }
    
    /**
     * Get translated text with fallback
     * @param {string} key - Dot-notation key (e.g., 'ui.day')
     * @param {object} params - Parameters for template replacement
     */
    getText(key, params = {}) {
        if (!this.locales[this.currentLang]) return key;
        
        const keys = key.split('.');
        let value = this.locales[this.currentLang];
        
        for (const k of keys) {
            value = value?.[k];
            if (!value) return key;
        }
        
        // Replace {param} placeholders
        if (typeof value === 'string') {
            return value.replace(/\{(\w+)\}/g, (match, param) => 
                params[param] !== undefined ? params[param] : match
            );
        }
        
        return value || key;
    }
    
    /**
     * Create Vue computed properties for i18n
     * Call this in Vue setup() with Vue's computed function
     */
    createComputedProps(getText) {
        return {
            // UI labels
            dayLabel: (day) => getText('ui.day', { day }),
            weekdayLabel: (day) => {
                const weekdays = ['ui.monday', 'ui.tuesday', 'ui.wednesday'];
                const key = weekdays[(day - 1) % 3] || 'ui.monday';
                return getText(key);
            },
            currentTimeLabel: () => getText('ui.currentTime'),
            realTimeLabel: () => getText('ui.realTime'),
            rollButton: () => getText('hub.roll'),
            continueButton: () => getText('common.clickContinue'),
            taskButton: () => getText('ui.taskBtn'),
            ruleHint: () => getText('ui.ruleHint'),
            eventPause: () => getText('ui.eventPause'),
            
            // Status messages
            waiting: () => getText('common.waiting'),
            pleaseWait: () => getText('common.loading'),
            readyToGo: () => getText('ui.readyToGo') || '准备出发',
            clickDice: () => getText('common.clickDice'),
            rolling: () => getText('ui.rolling') || '掷骰子中...',
            eventTriggered: () => getText('ui.eventTriggered') || '事件触发',
            pleaseHandle: () => getText('ui.pleaseHandle') || '请处理',
            taskComplete: () => getText('ui.taskComplete') || '任务完成',
            yourTurn: () => getText('common.yourTurn'),
            recorded: () => getText('common.recorded'),
            restoring: () => getText('common.restoring'),
            restoreFailed: () => getText('common.restoreFailed'),
            loading: () => getText('common.loading'),
            
            // Movement
            moveForwardSteps: (steps) => {
                const template = getText('ui.moveForwardSteps') || '向前移动 {steps} 步';
                return template.replace('{steps}', steps);
            },
            moveEnded: () => getText('ui.moveEnded') || '移动结束',
            waitContinue: () => getText('ui.waitContinue') || '等待继续',
            
            // Start card
            mondayMorning: () => getText('ui.mondayMorning') || '周一: 早安',
            readTasksAloud: () => getText('ui.readTasksAloud') || '请大声朗读以下任务',
            todaysTasks: () => getText('ui.todaysTasks') || '今日专属任务',
            recurringTasks: () => getText('ui.recurringTasks') || '常规重复任务',
            asthma11am: () => getText('tasks.asthma11am') || '11:00 AM 哮喘药',
            asthma9pm: () => getText('tasks.asthma9pm') || '9:00 PM 哮喘药',
            antibioticsBreakfast: () => getText('tasks.antibioticsBreakfast') || '早餐时 抗生素',
            antibioticsDinner: () => getText('tasks.antibioticsDinner') || '晚餐时 抗生素',
            lungTestInfo: () => getText('ui.lungTestInfo') || '真实时间 2:30 & 4:15 肺活量测试',
            startDay: () => getText('ui.startDay') || '开始这一天',
            
            // Event card
            pleaseChooseAction: () => getText('ui.pleaseChooseAction') || '请选择一个行动',
            req: () => getText('ui.req') || '需',
            understood: () => getText('common.understood') || '知道了',
            
            // Task buttons
            taskAsthma: () => getText('tasks.asthmaButton') || '哮喘药 (Asthma)',
            taskAntibiotics: () => getText('tasks.antibioticsButton') || '抗生素 (Antibiotics)',
            taskLungTest: () => getText('tasks.lungTestButton') || '肺活量测试 (Lung Test)',
            
            // Misc
            moving: () => getText('ui.moving') || '移动中...',
            checkTarget: () => getText('ui.checkTarget') || '检定目标',
            rollToCheck: () => getText('ui.rollToCheck') || '掷骰子判定',
            recordMemoryTask: () => getText('ui.recordMemoryTask') || '记录记忆任务',
            
            // Tutorial
            tutorialStartDay: () => getText('tutorial.startDay') || '早安！请大声朗读今天的任务，然后点击这里开始。',
            tutorialRollDice: () => getText('tutorial.rollDice') || '轮到您了！请点击这个骰子向前移动。',
            tutorialPleaseWait: () => getText('tutorial.pleaseWait') || '请稍候...'
        };
    }
}

// Export singleton
window.i18nManager = new I18nManager();
