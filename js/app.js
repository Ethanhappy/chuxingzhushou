/**
 * ============================================
 * 郑州周末出行助手 v2.0 - 主应用逻辑
 * 核心：Multi-Agent架构 + 统一评价反馈系统
 * ============================================
 */

class ZhengzhouPlanner {
    constructor() {
        // 服务实例
        this.apiService = new ApiService();
        this.mapService = new MapService();
        this.llmService = new LLMService(this.apiService);

        // ★ Multi-Agent核心 ★
        this.coordinator = new AgentCoordinator(this.apiService);

        // ★ 评价器 ★
        this.evaluator = new EvaluatorService();

        // 应用状态
        this.currentScenario = null;
        this.currentMode = 'default';
        this.currentPlan = null;
        this.agentData = null;     // Agent采集的原始数据
        this.evaluation = null;    // 评价结果

        // UI元素
        this.elements = {};

        this.init();
    }

    // ==================== 初始化 ====================
    init() {
        this.cacheElements();
        this.bindEvents();
        this.mapService.init('map');
        this.loadSavedConfig();
        this.checkAPIs();

        // Agent协调器UI回调
        this.coordinator.onAgentUpdate = (event, data) => {
            if (event === 'agent_update') {
                this.updateAgentPanelItem(data);
            }
        };
    }

    cacheElements() {
        const ids = [
            'scenarioGrid', 'modeToggle', 'btnGenerate', 'btnConfig', 'btnCloseModal',
            'btnSaveConfig', 'configModal', 'loadingOverlay', 'loadingText',
            'weatherBar', 'weatherMain', 'weatherSource', 'mapContainer',
            'mapLegend', 'planContainer', 'planTitle', 'planMeta', 'timeline',
            'emptyState', 'apiStatus', 'toastContainer',
            'configAmapKey', 'configQWeatherKey', 'configLlmUrl', 'configLlmKey', 'configLlmModel',
            // Multi-Agent
            'agentPanelSection', 'agentPanel',
            // 评价
            'evaluationContainer', 'evalModeBadge', 'evalOverall',
            'evalScoreCircle', 'evalStars', 'evalFeedback',
            'evalDimensions', 'evalHighlights', 'evalSuggestions',
            // 用户输入
            'userInputSection', 'userCustomInput', 'charCount',
            'quickTags', 'userInputBadge',
        ];
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    bindEvents() {
        // 场景选择
        this.elements.scenarioGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.scenario-card');
            if (card) this.selectScenario(card.dataset.scenario);
        });

        // 模式切换
        this.elements.modeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.mode-btn');
            if (btn) this.selectMode(btn.dataset.mode);
        });

        // 生成计划
        this.elements.btnGenerate.addEventListener('click', () => this.generatePlan());

        // 配置弹窗
        this.elements.btnConfig.addEventListener('click', () => this.openConfigModal());
        this.elements.btnCloseModal.addEventListener('click', () => this.closeConfigModal());
        this.elements.configModal.addEventListener('click', (e) => {
            if (e.target === this.elements.configModal) this.closeConfigModal();
        });
        this.elements.btnSaveConfig.addEventListener('click', () => this.saveConfig());

        // 模型预设按钮
        document.getElementById('modelPresets')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.preset-btn');
            if (btn) this.applyModelPreset(btn.dataset.provider);
        });

        // 用户输入 - 字符计数
        this.elements.userCustomInput.addEventListener('input', () => this.updateCharCount());

        // 用户输入 - 快捷标签点击
        this.elements.quickTags.addEventListener('click', (e) => {
            const tag = e.target.closest('.quick-tag');
            if (tag) this.toggleQuickTag(tag);
        });

        // 点击行程高亮地图
        this.elements.timeline.addEventListener('click', (e) => {
            const item = e.target.closest('.timeline-item');
            if (item && item.dataset.markerIndex !== undefined) {
                this.mapService.highlightMarker(parseInt(item.dataset.markerIndex));
            }
        });

        // API状态
        this.apiService.onStatusChange = (api, status) => this.updateAPIStatusUI(api, status);
    }

    // ==================== 场景与模式 ====================
    selectScenario(scenario) {
        this.currentScenario = scenario;
        document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
        const card = document.querySelector(`.scenario-card[data-scenario="${scenario}"]`);
        if (card) card.classList.add('active');
    }

    selectMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
        if (btn) btn.classList.add('active');

        const inputWrapper = this.elements.userInputSection?.querySelector('.user-input-wrapper');
        const badge = this.elements.userInputBadge;

        if (mode === 'llm') {
            // LLM模式：强调输入的重要性
            if (inputWrapper) inputWrapper.classList.add('llm-active');
            if (badge) {
                badge.textContent = 'AI推荐';
                badge.classList.add('required');
            }
            this.elements.userCustomInput.placeholder = '🤖 AI模式已激活！描述你的偏好，大模型为你量身定制...\n\n例如：\n• 我想去有历史文化感的地方，不要太累\n• 预算控制在500元以内，喜欢小众景点\n• 带3岁小孩，需要亲子友好路线\n• 想去登封少林寺，顺便吃地道烩面';

            if (this.apiService.getStatus('llm') === 'offline') {
                this.showToast('请先配置AI大模型API密钥，或使用默认模式', 'info');
            }
        } else {
            // 默认模式：输入作为补充偏好
            if (inputWrapper) inputWrapper.classList.remove('llm-active');
            if (badge) {
                badge.textContent = '可选';
                badge.classList.remove('required');
            }
            this.elements.userCustomInput.placeholder = '输入你的偏好（可选），帮你从精选路线中匹配最合适的方案...\n\n例如：\n• 想去少林寺方向\n• 想吃遍郑州美食\n• 只要市区内的景点';
        }
    }

    // ==================== ★ 核心：生成计划（Multi-Agent流程）★ ====================
    async generatePlan() {
        if (!this.currentScenario) {
            this.showToast('请先选择出行场景', 'warning');
            return;
        }

        // 重置UI
        this.elements.emptyState.style.display = 'none';
        this.elements.planContainer.style.display = 'none';
        this.elements.evaluationContainer.style.display = 'none';
        this.elements.weatherBar.style.display = 'none';
        this.elements.agentPanelSection.style.display = 'block';

        this.showLoading('🤖 启动Multi-Agent系统...');

        try {
            // ========== 阶段1：并行Agent数据采集 ==========
            this.updateLoadingText('🔍 4个Agent并行采集数据中...');
            this.initAgentPanel();

            // 构建Agent上下文
            const agentContext = this._buildAgentContext();

            // ★ 核心：协调器并行执行所有Agent
            this.updateLoadingText('🌤️ 天气Agent + 🏛️ 景点Agent + 🚗 交通Agent + ⭐ 口碑Agent 并行执行...');
            this.agentData = await this.coordinator.executeAll(agentContext);

            // 显示Agent采集结果摘要
            this.showToast(
                `✅ ${this.agentData.meta.completedCount}/${this.agentData.meta.agentCount} 个Agent执行完成，` +
                `采集${this.agentData.meta.totalSources}个数据源`,
                'success'
            );

            // ========== 阶段2：生成计划 ==========
            this.updateLoadingText('📋 正在生成行程计划...');
            let plan;

            // ★ 提取用户自定义输入
            const userInput = this.getUserInput();

            if (this.currentMode === 'default') {
                plan = ZhengzhouData.getPlan(this.currentScenario);
                if (plan) {
                    // 用Agent数据增强默认计划
                    plan = this._enrichPlanWithAgentData(plan);
                    // 用用户输入关键字微调计划标题和描述
                    if (userInput) {
                        plan = this._applyUserPrefsToPlan(plan, userInput);
                    }
                }
            } else {
                // LLM模式：把用户输入传给大模型
                this.updateLoadingText('🧠 AI大模型智能规划中...');
                if (this.apiService.getStatus('llm') !== 'online') {
                    const result = await this.llmService.checkLLM();
                    if (!result.available) {
                        this.hideLoading();
                        this.showToast(`AI大模型不可用: ${result.error || '请检查配置'}`, 'error');
                        return;
                    }
                }

                const weatherInfo = this.agentData?.weather?.forecasts || [];
                if (userInput) {
                    this.updateLoadingText('🧠 AI正在理解你的个性化需求...');
                }
                plan = await this.llmService.generatePlan(this.currentScenario, weatherInfo, userInput);
                this.updateLoadingText('🗺️ 正在匹配地理坐标...');
                plan = await this.llmService.enrichPlanWithCoords(plan);
            }

            // ========== 阶段3：★ 统一评价 ☆ ==========
            this.updateLoadingText('⭐ 多维度评价分析中...');
            const evalMode = (this.currentMode === 'llm' && APP_CONFIG.apiKeys.llmKey) ? 'llm' : 'default';
            this.evaluation = await this.evaluator.evaluate(plan, this.currentScenario, this.agentData, evalMode);

            // ========== 渲染UI ==========
            // 天气
            this.renderWeather(this.agentData?.weather?.forecasts || []);

            // Agent数据摘要（交通建议等）
            this.renderAgentInsights();

            // 行程计划
            this.renderPlan(plan);

            // 地图
            this.mapService.refresh();
            this.renderMap(plan);

            // ★ 评价结果 ☆
            this.renderEvaluation();

            // 隐藏加载
            this.hideLoading();

            // 滚动到计划区域
            this.elements.planContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

            const starsText = this.evaluation?.stars ? ` ${this.evaluation.starDisplay}` : '';
            this.showToast(`🎉 计划生成完成！综合评分${starsText}`, 'success');

        } catch (err) {
            this.hideLoading();
            console.error('生成失败:', err);

            if (this.currentMode === 'llm') {
                this.showToast(`AI生成失败: ${err.message}，已自动切换到默认模式`, 'error');
                this.currentMode = 'default';
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('.mode-btn[data-mode="default"]')?.classList.add('active');
                await this.generatePlan();
                return;
            }

            this.showToast(`生成计划失败: ${err.message}`, 'error');
            this.elements.emptyState.style.display = 'flex';
        }
    }

    /**
     * 构建Agent执行上下文
     */
    _buildAgentContext() {
        // 提取已有位置信息（预设数据）
        const locations = [];
        if (this.currentScenario && ZhengzhouData) {
            const coords = ZhengzhouData.getAllCoords(this.currentScenario);
            coords.forEach(c => locations.push(c));
        }

        return {
            scenario: this.currentScenario,
            locations: locations,
            city: '郑州',
            mode: this.currentMode,
        };
    }

    /**
     * 用Agent数据增强默认计划
     */
    _enrichPlanWithAgentData(plan) {
        if (!this.agentData) return plan;

        // 添加天气预警到提示
        const warnings = this.agentData.weather?.warnings || [];
        const weatherRec = this.agentData.weather?.recommendation || '';

        // 添加交通建议到第一天
        const trafficAdvice = this.agentData.traffic?.advice || '';

        if (plan.days && plan.days.length > 0 && plan.days[0].items?.length > 0) {
            if (warnings.length > 0) {
                plan.days[0].items[0].tip = (plan.days[0].items[0].tip || '') +
                    `\n🌤️ ${warnings.join(' ')}`;
            }
            if (trafficAdvice) {
                const lastItem = plan.days[0].items[plan.days[0].items.length - 1];
                if (lastItem) {
                    lastItem.tip = (lastItem.tip || '') + `\n${trafficAdvice}`;
                }
            }
        }

        return plan;
    }

    // ==================== ★ 用户自定义输入处理 ★ ====================

    /**
     * 获取用户输入的内容（合并快捷标签和手动输入）
     */
    getUserInput() {
        // 收集激活的快捷标签文本
        const activeTags = this.elements.quickTags.querySelectorAll('.quick-tag.active');
        const tagTexts = Array.from(activeTags).map(t => t.dataset.text).filter(Boolean);

        // 手动输入的文本
        const manualText = (this.elements.userCustomInput.value || '').trim();

        // 合并（去重）
        const parts = [];
        if (tagTexts.length > 0) parts.push(tagTexts.join('；'));
        if (manualText) parts.push(manualText);

        return parts.join('；');
    }

    /**
     * 更新字符计数
     */
    updateCharCount() {
        const len = this.elements.userCustomInput.value.length;
        const countEl = this.elements.charCount;
        countEl.textContent = `${len}/500`;

        countEl.classList.remove('warning', 'over');
        if (len >= 450) countEl.classList.add('warning');
        if (len >= 500) countEl.classList.add('over');
    }

    /**
     * 切换快捷标签
     */
    toggleQuickTag(tag) {
        tag.classList.toggle('active');
    }

    /**
     * 解析用户需求约束
     * @returns {{ dayCount: number|null, tightBudget: boolean, student: boolean, groupSize: number|null, interests: string[] }}
     */
    _parseUserConstraints(userInput) {
        if (!userInput) return { dayCount: null, tightBudget: false, student: false, groupSize: null, interests: [] };

        const input = userInput.toLowerCase();
        const constraints = {
            dayCount: null,
            tightBudget: false,
            student: false,
            groupSize: null,
            interests: [],
        };

        // ---- 天数检测 ----
        if (/半天|半日|当天/.test(input)) {
            constraints.dayCount = 1;  // 半天也算一日游
        } else if (/一天|一日|1天|当天/.test(input)) {
            constraints.dayCount = 1;
        } else if (/两天|两日|2天/.test(input)) {
            constraints.dayCount = 2;
        } else if (/三天|三日|3天/.test(input)) {
            constraints.dayCount = 3;
        }

        // ---- 预算检测 ----
        if (/钱少|省钱|穷游|预算有限|便宜|没钱|省钱攻略|性价比/.test(input)) {
            constraints.tightBudget = true;
        }

        // ---- 身份检测 ----
        if (/大学|学生|在校/.test(input)) {
            constraints.student = true;
            constraints.tightBudget = true;  // 学生默认预算紧张
        }
        // ---- 人数检测 ----
        const groupMatch = input.match(/(\d+|[一两三四五六七八九十])个?人/);
        if (groupMatch) {
            const numMap = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
            constraints.groupSize = numMap[groupMatch[1]] || parseInt(groupMatch[1]) || null;
        }

        // ---- 兴趣检测（关键词映射表，便于持续扩展同义词）----
        const interestKeywords = {
            '亲子':     ['小孩', '孩子', '亲子', '宝宝', '娃', '儿童', '带娃', '幼儿'],
            '老年友好': ['老人', '爸妈', '父母', '长辈', '老年', '爷爷', '奶奶', '带老人'],
            '历史文化': ['历史', '文化', '古迹', '少林', '博物', '古都', '文物', '遗址', '国学', '寺庙', '古建', '底蕴'],
            '美食':     ['美食', '吃', '小吃', '地道', '烩面', '胡辣汤', '大餐', '餐厅', '夜市', '烧烤', '火锅', '探店', '吃货', '嘴馋'],
            '自然风光': ['自然', '风景', '户外', '山水', '爬山', '公园', '湖', '踏青', '徒步', '露营', '赏花', '绿地', '氧吧'],
            '轻松休闲': ['轻松', '休闲', '不累', '放松', '慢节奏', '躺平', '发呆', '佛系', '悠闲', '随便逛'],
            '网红打卡': ['网红', '打卡', '拍照', '出片', '拍摄', 'ins', '机位', '照片', '拍大片'],
            '探险刺激': ['刺激', '酷', '挑战', '冒险', '过山车', '密室', '游乐', '蹦极', '心跳'],
            '二次元':   ['二次元', '死宅', '宅', '动漫', '漫展', 'cos', 'coser', '手办', '谷子', '漫画', 'acg', '番剧', '御宅', '痛包', '谷店', '同人', '追番'],
            '购物':     ['购物', '逛街', '商场', '买买买', '血拼', 'shopping', '商圈', '奥莱'],
            '夜生活':   ['夜生活', '酒吧', '清吧', '蹦迪', 'livehouse', '夜店', '夜景', '越夜', '小酌'],
            '文艺':     ['文艺', '小众', '艺术', '文创', '展览', '画展', '书店', '咖啡', '下午茶', '安静', '独处', '一个人静静', '氛围感'],
            '运动':     ['运动', '健身', '骑行', '跑步', '打球', '游泳', '滑板', '滑雪', '徒步'],
            '演出':     ['演出', '音乐会', '演唱会', '话剧', '剧场', '音乐节', '看剧'],
        };
        for (const [interest, keywords] of Object.entries(interestKeywords)) {
            if (keywords.some(kw => input.includes(kw)) && !constraints.interests.includes(interest)) {
                constraints.interests.push(interest);
            }
        }

        // ---- 身份/职业兜底（覆盖各行各业长尾人群，无需逐个穷举地点）----
        // 识别到身份词 → 映射到人群特征（预算/兴趣），复用现有匹配逻辑选出合适地点
        const identityMap = [
            // —— 体力 / 蓝领 / 服务行业 ——
            { test: ['工人', '打工', '打工人', '蓝领', '车间', '厂里', '流水线', '农民工', '务农', '农民', '种地', '实在', '接地气', '过日子', '省钱过日子', '过好日子'], set: { tightBudget: true, interests: ['轻松休闲', '美食'] } },
            { test: ['外卖', '快递', '网约车', '服务员', '保姆', '保洁', '保安', '收银', '后厨', '打工妹', '打工仔'], set: { tightBudget: true, interests: ['美食', '轻松休闲'] } },
            // —— 追星 / 二次元 / 文艺 / 摄影 ——
            { test: ['追星', '粉丝', '爱豆', 'idol', '演唱会', '追番', '看剧', '追星女孩', '追星族'], set: { interests: ['演出', '二次元'] } },
            { test: ['二次元', '动漫', '漫展', 'cos', 'coser', '谷子', 'jk', '汉服', '古风', '国风', '同人'], set: { interests: ['二次元', '文艺'] } },
            { test: ['文艺青年', '读书', '写作', '画家', '音乐人', '诗人', '摄影', '拍照', '出片', '旅拍', '小红书', '博主'], set: { interests: ['文艺', '网红打卡'] } },
            // —— 白领 / 专业 / 技术 ——
            { test: ['医生', '护士', '医护', '老师', '教师', '公务员', '事业单位', '体制内'], set: { interests: ['轻松休闲', '历史文化'] } },
            { test: ['程序员', 'it', '码农', '工程师', '技术宅', '科研', '研究生', '博士', '搞研发'], set: { interests: ['二次元', '轻松休闲'] } },
            { test: ['白领', '上班族', '社畜', '加班', '想放松', '疗愈', '解压', '压力大', '累'], set: { interests: ['轻松休闲', '美食'] } },
            { test: ['老板', '老板娘', '商务', '出差', '经理', '高管', '创业', '谈生意', '应酬'], set: { interests: ['购物', '美食'] } },
            // —— 吃货 ——
            { test: ['吃货', '吃遍', '美食家', '探店', '嘴馋', '会吃', '吃好'], set: { interests: ['美食'] } },
            // —— 学生 ——
            { test: ['学生', '大学生', '考研', '考研党', '高中生', '上学', '校园', '社团'], set: { student: true, interests: ['美食', '轻松休闲'] } },
            // —— 运动 / 户外 ——
            { test: ['运动', '健身', '跑步', '骑行', '篮球', '游泳', '瑜伽', '普拉提', '马拉松'], set: { interests: ['运动', '自然风光'] } },
            { test: ['驴友', '户外', '徒步', '登山', '露营', '自驾', '爬山', '骑行党'], set: { interests: ['自然风光', '运动'] } },
            // —— 亲子 / 老年 ——
            { test: ['亲子', '带娃', '宝妈', '奶爸', '儿童', '遛娃', '宝贝', '全家'], set: { interests: ['亲子'] } },
            { test: ['老年', '退休', '大爷', '大妈', '爷爷奶奶', '银发', '养老', '上年纪'], set: { interests: ['老年友好'] } },
            // —— 情侣 / 夜生活 ——
            { test: ['情侣', '约会', '对象', '男朋友', '女朋友', '脱单', '求婚', '纪念日'], set: { interests: ['文艺', '网红打卡'] } },
            { test: ['夜猫子', '年轻人', '潮人', '蹦迪', '酒吧', '夜生活', '通宵', '浪'], set: { interests: ['夜生活', '购物'] } },
            // —— 历史文化 ——
            { test: ['历史', '文博', '考古', '文物', '历史爱好者', '博物馆迷', '古建'], set: { interests: ['历史文化'] } },
        ];
        for (const { test, set } of identityMap) {
            if (test.some(kw => input.includes(kw))) {
                if (set.tightBudget) constraints.tightBudget = true;
                if (set.student) constraints.student = true;
                (set.interests || []).forEach(i => {
                    if (!constraints.interests.includes(i)) constraints.interests.push(i);
                });
            }
        }

        return constraints;
    }

    /**
     * 判断景点是否预算友好
     */
    _isBudgetFriendly(place) {
        if (!place) return true;
        const priceStr = (place.price || '').toLowerCase();
        // 免费
        if (priceStr.startsWith('免费')) return true;
        // 提取价格数字
        const priceMatch = priceStr.match(/(\d+)/);
        if (priceMatch) {
            const price = parseInt(priceMatch[1]);
            return price <= 30;  // 30元以下算预算友好
        }
        return true;  // 没标价的保留
    }

    /**
     * 根据识别到的兴趣，从全部地点库中筛选真正匹配的真实去处
     * 优先用兴趣全名精确匹配地点 tag；匹配不到再用核心词兜底
     */
    _getInterestPlaces(constraints) {
        const INTEREST_MATCH = {
            '二次元':   ['二次元', '谷店', '潮玩', '动漫'],
            '历史文化': ['历史', '文化', '古迹', '博物馆', '遗址', '古建'],
            '美食':     ['美食', '小吃', '早餐', '老字号', '夜市'],
            '自然风光': ['自然', '山水', '公园', '户外', '湖', '登山'],
            '轻松休闲': ['休闲', '轻松', '放松', '公园'],
            '网红打卡': ['打卡', '网红', '拍照', '出片'],
            '探险刺激': ['刺激', '探险', '高空', '过山车', '游乐'],
            '购物':     ['购物', '商场', '商圈', '潮玩'],
            '夜生活':   ['夜生活', '夜市', '酒吧', '夜景'],
            '文艺':     ['文艺', '文创', '展览', '艺术', '书店', '咖啡'],
            '运动':     ['运动', '健身', '骑行', '徒步', '跑步', '体育', '登山'],
            '演出':     ['演出', '音乐会', '剧场', '话剧', '音乐节'],
            '商务':     ['商务', '市中心', 'CBD', '商圈', '晚餐', '购物'],
            '亲子':     ['亲子', '儿童', '动物园', '海洋'],
            '老年友好': ['休闲', '公园', '文化'],
        };

        const result = [];
        const seen = new Set();
        for (const interest of constraints.interests) {
            const kw = interest.toLowerCase();
            // 1) 兴趣全名精确匹配地点 tag
            let cands = Object.values(ZhengzhouData.places).filter(p =>
                (p.tags || []).join(',').toLowerCase().includes(kw)
            );
            // 2) 全名匹配不到，用核心词兜底
            if (!cands.length) {
                const cores = (INTEREST_MATCH[interest] || []).map(c => c.toLowerCase());
                cands = Object.values(ZhengzhouData.places).filter(p => {
                    const tagStr = (p.tags || []).join(',').toLowerCase();
                    return cores.some(c => tagStr.includes(c));
                });
            }
            cands.forEach(p => {
                if (!seen.has(p.id)) { result.push(p); seen.add(p.id); }
            });
        }
        return result.slice(0, 2);
    }

    /**
     * 将兴趣对应的真实地点注入行程（默认两日游场景生效）
     * 一日游已在合并分支处理，这里对单日行程跳过以避免重复
     */
    _injectInterestPlaces(plan, constraints) {
        if (!constraints.interests || !constraints.interests.length) return;
        if (!plan.days || plan.days.length < 2) return;

        const injectPlaces = this._getInterestPlaces(constraints);
        if (!injectPlaces.length) return;

        // 排除行程中已存在的地点
        const usedIds = new Set();
        plan.days.forEach(d => d.items?.forEach(i => { if (i.placeId) usedIds.add(i.placeId); }));

        const lastDay = plan.days[plan.days.length - 1];
        const extra = injectPlaces
            .filter(p => !usedIds.has(p.id))
            .map((p, i) => ({
                placeId: p.id,
                place: p,
                time: '灵活安排',
                tip: `🎯 根据你的「${constraints.interests.join('/')}」兴趣推荐：${p.name}`,
                order: (lastDay.items?.length || 0) + i + 1,
            }));
        if (!extra.length) return;

        // 追加到最后一天（不删除原有精华景点）
        lastDay.items = [...(lastDay.items || []), ...extra];
    }

    /**
     * 将用户偏好关键字应用到默认计划（真实解析约束条件）
     */
    _applyUserPrefsToPlan(plan, userInput) {
        const constraints = this._parseUserConstraints(userInput);
        const input = userInput.toLowerCase();

        // ===== 1. 处理天数约束 =====
        if (constraints.dayCount === 1 && plan.days && plan.days.length >= 2) {
            // 合并两天为一日游：第一天为主，叠加兴趣偏好与预算友好的补充地点
            const day1Items = [...(plan.days[0].items || [])];
            const day2Items = plan.days[1]?.items || [];

            let extra = [];

            // 预算紧张：从第二天优先选免费的
            if (constraints.tightBudget) {
                extra = day2Items
                    .filter(item => this._isBudgetFriendly(item.place))
                    .slice(0, 2);
            }

            // 兴趣偏好：从全部地点库筛选真正匹配兴趣的真实去处
            if (constraints.interests.length > 0) {
                const interestPlaces = this._getInterestPlaces(constraints);
                const extraIds = new Set(extra.map(i => i.placeId));
                interestPlaces.forEach(p => {
                    if (!extraIds.has(p.id) && extra.length < 2) {
                        extra.push({
                            placeId: p.id, place: p, time: '灵活安排',
                            tip: `🎯 根据你的兴趣推荐：${p.name}`, order: 100,
                        });
                        extraIds.add(p.id);
                    }
                });
            }

            // 仍不足则用第二天预算友好地点补齐
            if (extra.length < 2) {
                day2Items
                    .filter(item => this._isBudgetFriendly(item.place) &&
                        !extra.some(e => e.placeId === item.placeId))
                    .forEach(item => { if (extra.length < 2) extra.push(item); });
            }

            const mergedItems = [...day1Items, ...extra].slice(0, 6);
            plan.days = [{
                day: 1,
                label: '一日游 · 精华路线',
                items: mergedItems,
            }];

            // ★ 同步替换标题和描述中的"两日/周末"为一日游
            // 先去掉"两天一夜"（保留 · 分隔符），再替换"周末"
            plan.title = plan.title?.replace(/两天一夜/g, '').replace(/\s*·\s*·/g, ' ·').replace(/\s*·\s*$/g, '').replace(/周末/g, '一日游');
            plan.description = plan.description?.replace(/两天/g, '').replace(/两日/g, '').replace(/周末/g, '一日');
        }

        // ===== 2. 预算过滤 =====
        if (constraints.tightBudget) {
            plan.title = plan.title?.replace(/^[^\w\u4e00-\u9fff]*/, '');
            plan.title = '💰 ' + (plan.title || '');
            plan.description = '省钱攻略·' + (plan.description || '');

            // 标注每个地点的价格/预算提示
            plan.days?.forEach(day => {
                day.items?.forEach(item => {
                    const place = item.place;
                    const price = place?.price || '';
                    if (!this._isBudgetFriendly(place)) {
                        // 贵的地点加提示
                        if (item.tip) item.tip = '⚠️ 此处消费较高，可选择外围游览或使用学生优惠\n' + item.tip;
                        else item.tip = '⚠️ 此处消费较高，可选择外围游览或使用学生优惠';
                    } else if (price.startsWith('免费')) {
                        if (item.tip) item.tip = '✅ 免费景点，学生党福音！\n' + item.tip;
                        else item.tip = '✅ 免费景点，学生党福音！';
                    } else {
                        if (item.tip) item.tip += '\n💡 学生证/团购可能有优惠';
                        else item.tip = '💡 学生证/团购可能有优惠';
                    }
                });

                // 过滤：如果一天内全是贵的地点，保留最核心的2个
                if (constraints.dayCount === null || constraints.dayCount >= 2) {
                    const expensiveItems = day.items.filter(item => !this._isBudgetFriendly(item.place));
                    const cheapItems = day.items.filter(item => this._isBudgetFriendly(item.place));
                    if (expensiveItems.length > 2 && cheapItems.length > 0) {
                        day.items = [...cheapItems, ...expensiveItems.slice(0, 2)];
                    }
                }
            });
        }

        // ===== 3. 学生身份标记 =====
        if (constraints.student) {
            // 不覆盖之前的emoji（如💰），直接前置追加
            plan.title = '🎓 ' + (plan.title || '');
            plan.description = '学生党专属·' + (plan.description || '');
            plan.days?.forEach(day => {
                day.items?.forEach(item => {
                    if (item.tip) item.tip += '\n🎓 凭学生证享半价优惠！';
                    else item.tip = '🎓 凭学生证享半价优惠！';
                });
            });
        }

        // ===== 3.5 兴趣 → 真实地点注入（默认两日游也生效）=====
        this._injectInterestPlaces(plan, constraints);

        // ===== 4. 兴趣偏好识别与反馈 =====
        if (constraints.interests.includes('轻松休闲')) {
            plan.title = '😌 ' + plan.title;
        }
        // 兴趣 → 郑州本地补充建议（本地库暂无对应地点时以贴士形式呈现，确保偏好被"看见"）
        const interestTips = {
            '历史文化': { prefix: '文化深度', tip: '🏯 历史文化控推荐：河南博物院、郑州商城遗址、二七纪念塔' },
            '美食':     { prefix: '美食打卡', tip: '🍜 吃货必打卡：方中山胡辣汤、萧记三鲜烩面、健康路夜市' },
            '二次元':   { prefix: '二次元同好', tip: '🎮 二次元聚集地：正弘城 / 大卫城 / 熙地港（谷店·痛包·漫展），二砂文创园常有同人活动' },
            '购物':     { prefix: '逛街血拼', tip: '🛍️ 购物推荐：二七德化步行街、正弘城、大卫城、丹尼斯' },
            '夜生活':   { prefix: '越夜越精彩', tip: '🌃 夜生活推荐：如意湖畔夜景、中原福塔观夜景、酒吧街小酌' },
            '文艺':     { prefix: '文艺小众', tip: '🎨 文艺打卡：二砂文创园、油化厂创意园、独立书店与咖啡馆' },
            '运动':     { prefix: '活力运动', tip: '🏃 运动推荐：龙子湖 / 如意湖环湖骑行、郑州奥体中心' },
            '演出':     { prefix: '现场Live', tip: '🎵 演出推荐：河南艺术中心、各大 Livehouse 留意演出排期' },
            '网红打卡': { prefix: '出片圣地', tip: '📸 出片机位：如意湖CBD大玉米、二砂文创园、龙子湖' },
            '探险刺激': { prefix: '心跳加速', tip: '🎢 刺激推荐：方特欢乐世界、中原福塔玻璃栈道' },
        };
        const appliedTips = [];
        constraints.interests.forEach(interest => {
            const info = interestTips[interest];
            if (info) {
                plan.description = info.prefix + '·' + (plan.description?.replace(/^[^\w\u4e00-\u9fff]*/, '') || '');
                appliedTips.push(info.tip);
            }
        });
        // 将识别到的兴趣建议汇总到第一天首个地点的贴士，让"识别结果"直观可见
        if (appliedTips.length > 0 && plan.days?.[0]?.items?.[0]) {
            const firstItem = plan.days[0].items[0];
            const extra = appliedTips.join('\n');
            firstItem.tip = firstItem.tip ? extra + '\n' + firstItem.tip : extra;
        }

        // ===== 5. 人数提示 =====
        if (constraints.groupSize) {
            plan.days?.forEach(day => {
                day.items?.forEach(item => {
                    if (constraints.groupSize >= 3) {
                        if (item.tip) item.tip += `\n👥 ${constraints.groupSize}人出行，建议打车分摊更划算`;
                        else item.tip = `👥 ${constraints.groupSize}人出行，建议打车分摊更划算`;
                    }
                });
            });
        }

        return plan;
    }

    // ==================== ★ Multi-Agent UI面板 ☆ ====================
    initAgentPanel() {
        const agents = this.coordinator.getAgentStatuses();
        const isOffline = this.currentMode === 'default';
        // 离线模式：顶部说明
        const offlineBanner = isOffline
            ? `<div style="padding:6px 12px; margin-bottom:10px; background:#fffbe6; border-radius:8px; font-size:0.74rem; color:#92400e; display:flex; align-items:center; gap:8px;">
                <span>📦</span> <span>离线模式 · 使用本地数据 &amp; 规则引擎，无需API密钥</span>
              </div>`
            : '';
        let html = offlineBanner;
        agents.forEach(agent => {
            html += `
                <div class="agent-item working" data-agent="${agent.type}">
                    <span class="agent-icon">${agent.icon}</span>
                    <div class="agent-info">
                        <div class="agent-name">${agent.name}</div>
                        <div class="agent-status-text">启动中...</div>
                    </div>
                    <div class="agent-progress">
                        <div class="agent-progress-bar" style="width:0%"></div>
                    </div>
                </div>
            `;
        });
        this.elements.agentPanel.innerHTML = html;
    }

    updateAgentPanelItem(summary) {
        const item = this.elements.agentPanel.querySelector(`[data-agent="${summary.type}"]`);
        if (!item) return;

        // 更新状态类
        item.classList.remove('working', 'done', 'error');
        item.classList.add(summary.status);

        // 更新状态文本
        const statusText = item.querySelector('.agent-status-text');
        const progressBar = item.querySelector('.agent-progress-bar');

        if (summary.status === 'done') {
            const isOffline = this.currentMode === 'default';
            // 离线模式：显示"本地数据"而非"API数据源"
            const sourceLabel = isOffline ? '本地数据' : `${summary.sources.length}个数据源`;
            const sourceIcon = isOffline ? '📦' : '🔗';
            statusText.textContent = `完成 · ${sourceIcon} ${sourceLabel} · ${summary.duration}ms`;
            progressBar.style.width = '100%';
            progressBar.classList.add('done');
        } else if (summary.status === 'error') {
            statusText.textContent = `失败: ${summary.error}`;
            progressBar.style.width = '100%';
            progressBar.classList.add('error');
        } else {
            statusText.textContent = '采集中...';
            progressBar.style.width = '60%';
        }
    }

    /**
     * 渲染Agent采集的额外信息（交通建议等）
     */
    renderAgentInsights() {
        if (!this.agentData) return;

        const trafficAdvice = this.agentData.traffic?.advice || '';
        const reviewSummary = this.agentData.reviews?.summary || '';
        const crowdData = this.agentData.reviews?.crowdPredictions || [];

        // 在行程计划头部添加Agent洞察
        let insightHTML = '';
        if (trafficAdvice) {
            insightHTML += `<span class="meta-item" style="color:var(--accent);"><i class="fa-solid fa-car-side"></i> ${trafficAdvice}</span>`;
        }
        if (reviewSummary) {
            insightHTML += `<span class="meta-item"><i class="fa-solid fa-comment-dots"></i> ${reviewSummary.substring(0, 30)}...</span>`;
        }

        // 追加到planMeta
        if (insightHTML && this.elements.planMeta) {
            const existingMeta = this.elements.planMeta.innerHTML || '';
            this.elements.planMeta.innerHTML = existingMeta + insightHTML;
        }
    }

    // ==================== ★ 评价结果渲染 ☆ ====================
    renderEvaluation() {
        if (!this.evaluation) return;

        const evalDiv = this.elements.evaluationContainer;
        evalDiv.style.display = 'block';

        // 评价模式标记
        const modeBadge = this.elements.evalModeBadge;
        if (this.evaluation.mode === 'llm') {
            modeBadge.textContent = '🤖 AI大模型评价';
            modeBadge.className = 'eval-mode-badge llm';
        } else {
            modeBadge.textContent = '📊 规则引擎评价';
            modeBadge.className = 'eval-mode-badge';
        }

        // 分数圆圈
        this.elements.evalScoreCircle.innerHTML = `
            <div class="eval-score-number">${this.evaluation.overall}</div>
            <div class="eval-score-label">综合分</div>
        `;

        // 星级
        this.elements.evalStars.textContent = this.evaluation.starDisplay;

        // 反馈文字
        this.elements.evalFeedback.textContent = this.evaluation.feedback || '';

        // 六维度评分
        this.renderDimensions();

        // 亮点
        this.renderList(this.elements.evalHighlights, this.evaluation.highlights || [], '✨');

        // 建议
        this.renderList(this.elements.evalSuggestions, this.evaluation.suggestions || [], '💡');

        // 滚动到评价区域
        setTimeout(() => evalDiv.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }

    renderDimensions() {
        const dims = this.evaluation.dimensions || {};
        const defs = this.evaluator.dimensions;

        let html = '';
        defs.forEach(dim => {
            const data = dims[dim.key] || {};
            const score = data.score || 0;
            const comment = data.comment || '';
            const level = score >= 85 ? 'high' : score >= 65 ? 'medium' : 'low';

            html += `
                <div class="eval-dim-item">
                    <div class="eval-dim-header">
                        <span class="eval-dim-name">
                            <span>${dim.icon}</span> ${dim.name}
                        </span>
                        <span class="eval-dim-score ${level}">${score}</span>
                    </div>
                    <div class="eval-dim-bar">
                        <div class="eval-dim-fill ${level}" style="width:${score}%"></div>
                    </div>
                    <div class="eval-dim-comment">${comment}</div>
                </div>
            `;
        });

        this.elements.evalDimensions.innerHTML = html;
    }

    renderList(container, items, prefix) {
        if (!items || items.length === 0) {
            container.innerHTML = '<li style="color:var(--text-muted);">暂无数据</li>';
            return;
        }
        container.innerHTML = items.map(item => `<li>${prefix} ${item}</li>`).join('');
    }

    // ==================== 行程计划渲染 ====================
    renderPlan(plan) {
        if (!plan) return;

        this.currentPlan = plan;
        // 保存原始计划副本（用于重置排序）
        this._originalPlan = JSON.parse(JSON.stringify(plan));
        this.elements.planContainer.style.display = 'block';

        const scenarioInfo = APP_CONFIG.scenarios[this.currentScenario];
        this.elements.planTitle.textContent = plan.title || (scenarioInfo?.name + ' · 周末计划');

        // 检查是否有用户自定义输入
        const userInput = this.getUserInput();
        const userTag = userInput
            ? `<span class="meta-item" style="color:var(--primary);"><i class="fa-solid fa-comment-dots"></i> 已采纳自定义偏好</span>`
            : '';

        const dayCount = plan.days?.length || 2;
        const dayLabel = dayCount === 1 ? '一日游' : dayCount === 2 ? '周六 - 周日' : `${dayCount}天行程`;

        this.elements.planMeta.innerHTML = `
            <span class="meta-item"><i class="fa-solid fa-calendar-days"></i> ${dayLabel}</span>
            <span class="meta-item"><i class="fa-solid fa-user-group"></i> ${scenarioInfo?.name || ''}</span>
            <span class="meta-item"><i class="fa-solid fa-map-pin"></i> ${this.countLocations(plan)} 个地点</span>
            <span class="meta-item"><i class="fa-solid fa-brain"></i> ${this.currentMode === 'llm' ? 'AI智能规划' : '精选推荐'}</span>
            ${userTag}
            ${plan.description ? `<span class="meta-item"><i class="fa-solid fa-quote-right"></i> ${plan.description}</span>` : ''}
        `;

        // ★ 拖拽提示工具栏
        let timelineHTML = `
            <div class="order-toolbar">
                <div class="order-hint">
                    <i class="fa-solid fa-grip-vertical"></i>
                    <span>拖拽 <strong>☰</strong> 手柄调整顺序，支持跨天换位，时间自动重算</span>
                </div>
                <button class="btn-reset-order" id="btnResetOrder" title="恢复原始排序">
                    <i class="fa-solid fa-rotate-left"></i> 重置排序
                </button>
            </div>
        `;

        plan.days.forEach((day, dayIdx) => {
            const dayColor = day.day === 1 ? 'var(--primary)' : day.day === 3 ? '#10b981' : 'var(--accent)';
            timelineHTML += `
                <div class="day-header" style="margin:20px 0 10px; padding-left:8px; font-size:0.95rem; font-weight:700; color:var(--text-primary);">
                    <span style="background:${dayColor}; color:white; padding:4px 14px; border-radius:20px; font-size:0.82rem;">
                        ${day.label}
                    </span>
                </div>
            `;

            day.items.forEach((item, idx) => {
                const place = item.place;
                const tags = place?.tags || item.tags || [];
                const globalIndex = this.getGlobalIndex(plan, dayIdx, idx);
                const isEvening = this._isEveningItem(item);
                const eveningClass = isEvening ? ' evening-item' : '';
                const eveningBadge = isEvening ? '<span class="evening-badge" title="晚间活动"><i class="fa-solid fa-moon"></i> 晚间</span>' : '';

                timelineHTML += `
                    <div class="timeline-item${eveningClass}" data-sortable
                         data-day-index="${dayIdx}"
                         data-item-index="${idx}"
                         data-marker-index="${globalIndex}"
                         data-evening="${isEvening}">
                        <div class="drag-handle" title="拖拽调整顺序">
                            <i class="fa-solid fa-grip-vertical"></i>
                        </div>
                        <div class="timeline-dot ${day.day === 2 ? 'day2' : ''}" style="${day.day === 3 ? 'box-shadow: 0 0 0 3px #10b981; background: #10b981;' : ''}"></div>
                        <div class="timeline-time">
                            <span class="day-badge" style="background:${dayColor}">第${day.day}天</span>
                            ${eveningBadge}
                            ${item.time || ''}
                        </div>
                        <h3>${idx + 1}. ${place?.name || item.name || ''}</h3>
                        ${place?.address || item.address ? `<div class="location-address"><i class="fa-solid fa-location-dot"></i> ${place?.address || item.address}</div>` : ''}
                        <div class="description">${place?.description || item.description || ''}</div>
                        ${item.tip ? `<div style="margin-top:8px; padding:6px 10px; background:#fffbeb; border-radius:6px; font-size:0.78rem; color:#92400e;"><i class="fa-solid fa-lightbulb"></i> ${item.tip.replace(/\n/g, '<br>')}</div>` : ''}
                        ${tags.length > 0 ? `<div class="tags">${tags.map(t => `<span class="tag primary">${t}</span>`).join('')}</div>` : ''}
                    </div>
                `;
            });
        });

        this.elements.timeline.innerHTML = timelineHTML;

        // ★ 绑定拖拽事件 + 重置按钮
        this._initDragAndDrop();
        const btnReset = this.elements.timeline.querySelector('#btnResetOrder');
        if (btnReset) {
            btnReset.addEventListener('click', () => this._resetOrder());
        }
    }

    // ==================== 地图 ====================
    renderMap(plan) {
        if (!plan) return;
        this.mapService.showPlanOnMap({ days: plan.days });

        // ★ 图例改为按地点显示，每个地点独立编号+名称
        const markerColors = APP_CONFIG.markerColors;
        let legendHTML = '<div style="font-weight:600; margin-bottom:6px; font-size:0.8rem;">📌 图例（编号=地图标记）</div>';
        let globalIdx = 0;
        plan.days?.forEach((day) => {
            day.items?.forEach((item) => {
                const name = item.place?.name || item.name || '未知';
                const color = markerColors[globalIdx % markerColors.length];
                legendHTML += `<div class="legend-item">
                    <div class="legend-dot" style="background:${color}">${globalIdx + 1}</div>
                    <span>${name.substring(0, 8)}</span>
                </div>`;
                globalIdx++;
            });
        });
        this.elements.mapLegend.style.display = 'block';
        this.elements.mapLegend.innerHTML = legendHTML;
    }

    // ==================== 拖拽排序（Pointer Events 实现） ====================
    /**
     * 初始化行程拖拽排序 - 使用 pointer 事件实现自定义拖拽
     */
    _initDragAndDrop() {
        const timeline = this.elements.timeline;
        const items = timeline.querySelectorAll('.timeline-item[data-sortable]');

        let dragSource = null;
        let dragDayIdx = -1;
        let dragItemIdx = -1;
        let ghost = null;
        let startY = 0;
        let moveStarted = false;

        items.forEach(item => {
            const handle = item.querySelector('.drag-handle');
            if (!handle) return;

            // ===== 手柄 pointerdown：开始拖拽 =====
            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                dragSource = item;
                dragDayIdx = parseInt(item.dataset.dayIndex);
                dragItemIdx = parseInt(item.dataset.itemIndex);
                startY = e.clientY;
                moveStarted = false;

                // 创建幽灵元素（跟随鼠标的半透明克隆）
                const sourceRect = item.getBoundingClientRect();
                ghost = item.cloneNode(true);
                ghost.classList.add('drag-ghost');
                ghost.style.position = 'fixed';
                ghost.style.zIndex = '9999';
                ghost.style.pointerEvents = 'none';
                ghost.style.width = sourceRect.width + 'px';
                ghost.style.left = sourceRect.left + 'px';
                ghost.style.top = sourceRect.top + 'px';
                document.body.appendChild(ghost);

                handle.setPointerCapture(e.pointerId);
            });

            // ===== 手柄 pointermove：移动幽灵 + 高亮目标 =====
            handle.addEventListener('pointermove', (e) => {
                if (!dragSource || !ghost) return;

                const dy = e.clientY - startY;
                // 需要移动超过 5px 才算真正开始拖拽
                if (!moveStarted && Math.abs(dy) < 5) return;
                if (!moveStarted) {
                    moveStarted = true;
                    dragSource.classList.add('dragging');
                }

                // 移动幽灵跟随鼠标
                ghost.style.top = (e.clientY - ghost.getBoundingClientRect().height / 2) + 'px';

                // 移除所有高亮
                items.forEach(it => it.classList.remove('drag-over'));

                // 找到鼠标下的 item 并高亮
                const target = this._getItemUnderPointer(e.clientX, e.clientY, items, dragSource);
                if (target) {
                    target.classList.add('drag-over');
                }
            });

            // ===== 手柄 pointerup：执行重排序 =====
            handle.addEventListener('pointerup', (e) => {
                if (!dragSource) return;

                // 清理幽灵
                if (ghost) {
                    ghost.remove();
                    ghost = null;
                }
                dragSource.classList.remove('dragging');
                items.forEach(it => it.classList.remove('drag-over'));

                if (!moveStarted) {
                    dragSource = null;
                    return;
                }

                // 找到目标位置
                const target = this._getItemUnderPointer(e.clientX, e.clientY, items, dragSource);
                if (target && target !== dragSource) {
                    const targetDayIdx = parseInt(target.dataset.dayIndex);
                    const targetItemIdx = parseInt(target.dataset.itemIndex);

                    this._reorderItems(dragDayIdx, dragItemIdx, targetDayIdx, targetItemIdx);
                }

                dragSource = null;
                moveStarted = false;
            });
        });
    }

    /**
     * 根据鼠标坐标找到下方的可排序 item
     */
    _getItemUnderPointer(px, py, items, exclude) {
        for (const item of items) {
            if (item === exclude) continue;
            const r = item.getBoundingClientRect();
            if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
                return item;
            }
        }
        return null;
    }

    /**
     * 跨天/同天重新排序，原地留一个占位防止某天空掉（至少 1 项）
     */
    _reorderItems(fromDayIdx, fromItemIdx, toDayIdx, toItemIdx) {
        const plan = this.currentPlan;
        if (!plan?.days) return;

        const fromDay = plan.days[fromDayIdx];
        const toDay = plan.days[toDayIdx];
        if (!fromDay?.items || !toDay?.items) return;

        // 如果来源天只剩一项且目标不同天 → 拒绝（不能把某天搬空）
        if (fromDayIdx !== toDayIdx && fromDay.items.length <= 1) {
            this.showToast('⚠️ 每至少保留一个行程，不能把当天搬空', 'warning');
            return;
        }

        // 从来源天取出
        const [moved] = fromDay.items.splice(fromItemIdx, 1);

        // 修正目标索引（同一数组且目标在源之后需要 -1）
        let insertIdx = toItemIdx;
        if (fromDayIdx === toDayIdx && fromItemIdx < toItemIdx) {
            insertIdx = toItemIdx - 1;
        }

        // 插入到目标天
        toDay.items.splice(insertIdx, 0, moved);

        // 重新计算各自的时间
        this._recalculateDayTimes(fromDay);
        if (fromDayIdx !== toDayIdx) {
            this._recalculateDayTimes(toDay);
        }

        // 更新天的标签（依序重编号 + 保留描述后缀）
        plan.days.forEach((d, i) => {
            const oldLabel = d.label;
            d.day = i + 1;
            d.label = this._dayLabelFor(d.day, d.items?.length || 0, oldLabel);
        });

        // 重新渲染
        this.renderPlan(plan);
        this.renderMap(plan);

        const crossHint = fromDayIdx !== toDayIdx ? '（已跨天）' : '';
        this.showToast(`✅ 顺序已调整${crossHint}，时间自动更新`, 'success');
    }

    /**
     * 根据天数生成标签，保留原有描述后缀
     */
    _dayLabelFor(dayNum, itemCount, originalLabel) {
        const prefix = dayNum === 1 ? '第一天'
            : dayNum === 2 ? '第二天'
            : `第${dayNum}天`;

        // 尝试从原始标签提取后缀（如 " · 少林传奇"）
        const suffixMatch = originalLabel?.match(/\s*[·•\-–—]\s*(.+)$/);
        const suffix = suffixMatch ? ' · ' + suffixMatch[1] : '';
        return prefix + suffix;
    }

    /**
     * 根据排序为某一天自动计算时间段
     * ★ 时段感知：夜市/夜景类地点固定排到晚上(17:00起)，白天地点从09:00起
     * ★ 排序优化：白天组在前、晚间组在后，确保时间与顺序一致
     * 白天地点之间午餐（12:00-13:00）自动加 1 小时间隙
     */
    _recalculateDayTimes(day) {
        if (!day?.items) return;
        const slotMinutes = 120; // 每站2小时

        // ★ 分区：白天组(09:00起) vs 晚上组(17:00起)
        const daytimeItems = [];
        const eveningItems = [];
        day.items.forEach(item => {
            if (this._isEveningItem(item)) {
                eveningItems.push(item);
            } else {
                daytimeItems.push(item);
            }
        });

        // ★ 重排序：白天在前、晚间在后
        day.items = [...daytimeItems, ...eveningItems];

        // ---- 白天组 ----
        const morningStart = 9 * 60; // 09:00
        let lunchOffsets = 0;
        daytimeItems.forEach((item, idx) => {
            let totalMin = morningStart + idx * slotMinutes;
            // 午餐：第1个结束 >=12:00 的项后面加60min间隙
            if (idx > 0) {
                const prevEnd = morningStart + (idx - 1) * slotMinutes + slotMinutes;
                if (prevEnd >= 12 * 60 && lunchOffsets === 0) {
                    lunchOffsets = 60;
                }
            }
            totalMin += lunchOffsets;

            const startH = Math.floor(totalMin / 60);
            const startM = totalMin % 60;
            const endMin = totalMin + slotMinutes;
            const endH = Math.floor(endMin / 60);
            const endMm = endMin % 60;

            item.time = `${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')} - ${String(endH).padStart(2,'0')}:${String(endMm).padStart(2,'0')}`;
        });

        // ---- 晚上组 ----
        const eveningStart = 17 * 60; // 17:00
        eveningItems.forEach((item, idx) => {
            const totalMin = eveningStart + idx * slotMinutes;
            const startH = Math.floor(totalMin / 60);
            const startM = totalMin % 60;
            const endMin = totalMin + slotMinutes;
            const endH = Math.floor(endMin / 60);
            const endMm = endMin % 60;

            item.time = `${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')} - ${String(endH).padStart(2,'0')}:${String(endMm).padStart(2,'0')}`;
        });
    }

    /**
     * ★ 判断一个行程项是否属于晚间活动
     * 基于标签、名称关键词、原始时间段综合判断
     */
    _isEveningItem(item) {
        const place = item.place || item;
        const tags = (place.tags || item.tags || []).map(t => String(t).toLowerCase());
        const name = (place.name || item.name || '').toLowerCase();
        const time = item.time || '';

        // 标签明确是夜间活动
        const eveningTags = ['夜市', '夜景', '夜宵', '夜生活', '酒吧', 'livehouse', '灯光秀'];
        if (tags.some(t => eveningTags.some(e => t.includes(e)))) return true;

        // 名称关键词
        const eveningKeywords = ['夜市', '夜宵', '夜景', '酒吧', 'live', '夜场', '灯光', '夜游', '撸串', '烧烤', '大排档'];
        if (eveningKeywords.some(k => name.includes(k))) return true;

        // 原始时间段（如 AI 生成的时间）在 16:00 之后
        const timeMatch = time.match(/(\d{1,2}):\d{2}/);
        if (timeMatch) {
            const startHour = parseInt(timeMatch[1]);
            if (startHour >= 16) return true;
        }

        return false;
    }

    /**
     * 重置为原始排序
     */
    _resetOrder() {
        if (!this._originalPlan) return;
        this.currentPlan = JSON.parse(JSON.stringify(this._originalPlan));
        this.renderPlan(this.currentPlan);
        this.renderMap(this.currentPlan);
        this.showToast('🔄 已恢复原始排序', 'info');
    }

    // ==================== 天气 ====================
    renderWeather(forecasts) {
        if (!forecasts || forecasts.length === 0) {
            this.elements.weatherBar.style.display = 'none';
            return;
        }

        this.elements.weatherBar.style.display = 'flex';
        const primary = forecasts[0];
        const today = primary?.data?.[0];
        const confidence = this.agentData?.weather?.confidence || 0;

        let weatherHTML = '';
        if (today) {
            weatherHTML = `
                <span style="font-size:1.8rem;">${this.getWeatherIcon(today.dayweather || today.textDay || '')}</span>
                <div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">今天</div>
                    <div style="font-size:0.9rem;">${today.dayweather || today.textDay || '--'}</div>
                </div>
                <span class="temp">${today.daytemp || today.tempMax || '--'}°</span>
                <span style="color:var(--text-muted);">/ ${today.nighttemp || today.tempMin || '--'}°</span>
                <span style="font-size:0.7rem; padding:2px 8px; background:#eef2ff; border-radius:10px;">可信度${confidence}%</span>
            `;
        }
        this.elements.weatherMain.innerHTML = weatherHTML || '<span>暂无天气数据</span>';

        const sources = [...new Set(forecasts.map(f => f.source))].join(' + ');
        this.elements.weatherSource.innerHTML = `<span>数据源：</span><span class="source-badge">${sources || '默认'}</span>`;
    }

    getWeatherIcon(weather) {
        if (weather.includes('晴')) return '☀️';
        if (weather.includes('多云')) return '⛅';
        if (weather.includes('阴')) return '☁️';
        if (weather.includes('雨')) return '🌧️';
        if (weather.includes('雪')) return '❄️';
        return '🌤️';
    }

    // ==================== API状态 ====================
    updateAPIStatusUI(api, status) {
        const mapping = { amap: 'statusAmap', qweather: 'statusQWeather', nominatim: 'statusNominatim', llm: 'statusLLM' };
        const dotId = mapping[api];
        if (!dotId) return;
        const dot = document.getElementById(dotId);
        if (!dot) return;

        dot.classList.remove('online', 'offline', 'checking');
        dot.classList.add(status);
    }

    async checkAPIs() {
        await this.apiService.checkAllAPIs();
        const keys = APP_CONFIG.apiKeys;
        if (keys.llmUrl && keys.llmKey) {
            this.llmService.checkLLM().then(result => {
                if (!result.available) {
                    console.warn('[LLM] 检测未通过:', result.error);
                }
            }).catch(() => {});
        } else {
            this.apiService.setStatus('llm', 'offline');
        }
    }

    // ==================== 配置弹窗 ====================
    openConfigModal() {
        const keys = APP_CONFIG.apiKeys;
        this.elements.configAmapKey.value = keys.amap || '';
        this.elements.configQWeatherKey.value = keys.qweather || '';
        this.elements.configLlmUrl.value = keys.llmUrl || '';
        this.elements.configLlmKey.value = keys.llmKey || '';
        this.elements.configLlmModel.value = keys.llmModel || '';
        this.elements.configModal.style.display = 'flex';
    }

    closeConfigModal() { this.elements.configModal.style.display = 'none'; }

    /**
     * 快捷填入主流 AI 模型的 API 地址和模型名
     */
    applyModelPreset(provider) {
        const presets = {
            deepseek:   { url: 'https://api.deepseek.com/v1',       model: 'deepseek-chat' },
            qwen:       { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
            openai:     { url: 'https://api.openai.com/v1',          model: 'gpt-4o' },
            zhipu:      { url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
            moonshot:   { url: 'https://api.moonshot.cn/v1',         model: 'moonshot-v1-8k' },
        };
        const p = presets[provider];
        if (!p) return;

        this.elements.configLlmUrl.value = p.url;
        this.elements.configLlmModel.value = p.model;
        // Key 不动，只填 URL 和模型名
        this.showToast(`已填入 ${provider.toUpperCase()} 预设（请自行填写 API Key）`, 'info');
    }

    saveConfig() {
        const config = {
            amap: this.elements.configAmapKey.value.trim(),
            qweather: this.elements.configQWeatherKey.value.trim(),
            llmUrl: this.elements.configLlmUrl.value.trim(),
            llmKey: this.elements.configLlmKey.value.trim(),
            llmModel: this.elements.configLlmModel.value.trim(),
        };
        APP_CONFIG.saveApiKeys(config);
        this.closeConfigModal();
        this.checkAPIs();
        this.showToast('配置已保存，正在验证API连接...', 'success');
    }

    loadSavedConfig() { /* silently loaded */ }

    // ==================== 工具 ====================
    showLoading(text) {
        this.elements.loadingText.textContent = text;
        this.elements.loadingOverlay.style.display = 'flex';
        this.elements.btnGenerate.disabled = true;
    }

    updateLoadingText(text) {
        this.elements.loadingText.textContent = text;
    }

    hideLoading() {
        this.elements.loadingOverlay.style.display = 'none';
        this.elements.btnGenerate.disabled = false;
    }

    showToast(message, type = 'info') {
        const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;
        this.elements.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    countLocations(plan) {
        let count = 0;
        plan?.days?.forEach(d => { count += d.items?.length || 0; });
        return count;
    }

    getGlobalIndex(plan, dayIdx, itemIdx) {
        let idx = 0;
        for (let d = 0; d < dayIdx; d++) idx += plan.days[d]?.items?.length || 0;
        return idx + itemIdx;
    }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ZhengzhouPlanner();
});
