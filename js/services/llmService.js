/**
 * ============================================
 * 郑州周末出行助手 - 大模型LLM集成服务
 * ============================================
 * 支持OpenAI兼容接口（DeepSeek/通义千问/GPT等）
 * 通过本地代理绕过浏览器 CORS 限制
 */

class LLMService {
    constructor(apiService) {
        this.apiService = apiService;
    }

    /**
     * 判断是否应该走本地代理（浏览器环境访问外部 API 会被 CORS 拦截）
     */
    _useProxy() {
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
    }

    /**
     * 通过本地代理发送 LLM 请求，绕过 CORS
     */
    async _fetchViaProxy(targetUrl, apiKey, body) {
        const res = await fetch('/api/proxy/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl, apiKey, body }),
            signal: AbortSignal.timeout(65000),
        });
        return res;
    }

    /**
     * 直接发送 LLM 请求（生产环境，同域部署时使用）
     */
    async _fetchDirect(url, apiKey, body, timeout = 60000) {
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout),
        });
    }

    /**
     * 统一请求方法：自动选择代理或直连
     */
    async _llmFetch(targetUrl, apiKey, body, timeout = 60000) {
        if (this._useProxy()) {
            return this._fetchViaProxy(targetUrl, apiKey, body);
        }
        const fullUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
        return this._fetchDirect(fullUrl, apiKey, body, timeout);
    }

    /**
     * 检查LLM是否可用，返回详细结果
     * @returns {{ available: boolean, error?: string }}
     */
    async checkLLM() {
        const keys = APP_CONFIG.apiKeys;
        if (!keys.llmUrl || !keys.llmKey) {
            this.apiService.setStatus('llm', 'offline');
            return { available: false, error: '未配置 API 地址或密钥' };
        }

        try {
            const res = await this._llmFetch(
                keys.llmUrl,
                keys.llmKey,
                {
                    model: keys.llmModel || '',
                    messages: [{ role: 'user', content: 'hi' }],
                    max_tokens: 5,
                },
                10000
            );

            if (res.ok) {
                this.apiService.setStatus('llm', 'online');
                return { available: true };
            }

            // 尝试解析错误信息（API 返回的错误优先于泛化消息）
            let errorMsg = '';
            let apiErrorBody = null;
            try {
                apiErrorBody = await res.json();
            } catch {}

            if (apiErrorBody) {
                // DeepSeek/OpenAI 标准错误格式
                if (apiErrorBody.error?.message) {
                    errorMsg = apiErrorBody.error.message;
                } else if (apiErrorBody.message) {
                    errorMsg = apiErrorBody.message;
                }
                // 代理服务器返回的错误格式
                if (!errorMsg && apiErrorBody.detail) {
                    errorMsg = apiErrorBody.detail;
                }
            }

            // 没有明确的 API 错误信息时，根据 HTTP 状态码给提示
            if (!errorMsg) {
                if (res.status === 401 || res.status === 403) {
                    errorMsg = 'API Key 无效或无权访问';
                } else if (res.status === 404) {
                    errorMsg = 'API 地址不存在，请检查 URL';
                } else if (res.status === 429) {
                    errorMsg = '请求过于频繁，请稍后再试';
                } else if (res.status === 502) {
                    errorMsg = '代理服务器无法连接上游 API，请检查 API 地址是否正确';
                } else {
                    errorMsg = `服务器返回 HTTP ${res.status}`;
                }
            }

            console.error('[LLM checkLLM] 响应异常:', errorMsg, res.status);
            this.apiService.setStatus('llm', 'offline');
            return { available: false, error: errorMsg };
        } catch (err) {
            const rawMsg = err.message || '网络请求失败';
            let errorMsg = rawMsg;

            if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
                errorMsg = '网络连接失败，请确认服务器(node server.js)正在运行';
            } else if (rawMsg.includes('timeout') || rawMsg.includes('超时')) {
                errorMsg = '请求超时，API 地址可能不可达或网络延迟高';
            }

            console.error('[LLM checkLLM] 异常:', rawMsg);
            this.apiService.setStatus('llm', 'offline');
            return { available: false, error: errorMsg };
        }
    }

    /**
     * 构建提示词
     * @param {string} scenario - 场景类型
     * @param {Array} weatherInfo - 天气信息
     * @param {string} userInput - 用户自定义需求
     */
    buildPrompt(scenario, weatherInfo, userInput = '') {
        const scenarioNames = {
            family: '家人出游（亲子、家庭，需要考虑老人小孩的需求）',
            friends: '朋友结伴（年轻人，追求探索和趣味体验）',
            couple: '恋人约会（浪漫、私密、适合两人相处的场景）',
            solo: '单人漫游（独自旅行，深度体验，自我探索）',
        };

        // ★ 解析用户需求：天数、预算等
        const parsed = this._parseUserNeeds(userInput);

        // ★ 候选地点池：把本地库真实地点作为 LLM 的选点范围（RAG思路，让任意人群都能映射到真实地点，坐标100%准确）
        let placePoolText = '';
        try {
            const places = (typeof ZhengzhouData !== 'undefined' && ZhengzhouData) ? ZhengzhouData.places : {};
            const lines = [];
            Object.keys(places).forEach(function (k) {
                const p = places[k];
                const tags = (p.tags || []).join('/');
                const desc = (p.description || '').slice(0, 22);
                lines.push('- ' + p.name + '｜' + p.category + '｜标签:' + tags + '｜' + p.price + '｜' + desc);
            });
            if (lines.length) {
                placePoolText = '\n\n【可用地点库（必须且只能从这些地点中选择，严禁编造库外地点）】\n' + lines.join('\n');
            }
        } catch (e) { /* 本地库缺失时退化为自由生成 */ }

        // ★ 天气：智能合并多数据源，按天呈现
        const weatherDesc = this._buildWeatherSection(weatherInfo, parsed.dayCount);

        const userReqDesc = userInput
            ? `\n\n【用户自定义需求】以下是用户的具体偏好和要求，请务必优先满足：\n${userInput}\n`
            : '';

        // 根据天数构建不同的约束
        const dayConstraint = parsed.dayCount === 1
            ? '【天数要求】行程只需覆盖一天（单日游）'
            : parsed.dayCount === 3
            ? '【天数要求】行程需要覆盖三天（周五到周日）'
            : '【天数要求】行程覆盖周六和周日两天';

        const budgetConstraint = parsed.tightBudget
            ? '\n【预算限制】用户预算非常紧张，请优先推荐免费景点、低价美食，总人均消费控制在100元以内。标注大致人均消费。'
            : '';

        const studentNote = parsed.student
            ? '\n【用户身份】用户是在校大学生，推荐学生友好型路线，提示学生证优惠信息。'
            : '';

        return `你是一个资深的郑州本地旅行规划专家。请为以下场景生成一个完整的郑州出行行程计划。

【出行场景】${scenarioNames[scenario] || scenario}
${dayConstraint}${userReqDesc}${budgetConstraint}${studentNote}
${weatherDesc}

【要求】
1. 行程天数按上面的天数要求执行，每天安排2-4个地点
2. ★ 务必根据每日天气预报合理分配活动：雨天优先室内景点(博物馆/商场/美食)，晴天优先户外景点(公园/山水/街区)
3. ★ 地点必须真实且坐标可定位；必须从下方【可用地点库】中选取，严禁虚构库外地点
4. 每个地点需包含：名称、具体地址、推荐时间段、简短推荐理由（1-2句话）
5. 考虑不同场景的特点（如亲子需要轻松安全、情侣需要浪漫、朋友需要趣味互动）
6. 穿插推荐地道的郑州美食（烩面、胡辣汤等）
7. 考虑交通便利性和地点之间的路线合理性
8. 如果用户有自定义需求（如天数、预算、兴趣偏好、身份职业），务必优先满足
9. ★ 所有地点只能从下方【可用地点库】中选择，禁止编造库外地点；面对任意身份职业（如追星→演出潮流、工人/外卖→实在性价比、医生/教师→轻松疗愈、白领→解压美食、老板/商务→市中心购物晚餐、学生→美食闲逛、汉服/Coser→二次元文艺、运动/户外→自然风光、老人→公园休闲、亲子→动物园、情侣→文艺打卡、历史迷→文博古迹），请用库内最贴合的地点组合出符合其气质与预算的行程

${placePoolText}

【输出格式】请严格按照以下JSON格式输出，不要输出其他内容。days数组的长度必须与天数要求一致：

{
  "title": "行程标题，10字以内",
  "description": "行程概述，25字以内",
  "days": [
    {
      "day": 1,
      "label": "第一天·主题名称",
      "items": [
        {
          "name": "地点名称",
          "address": "郑州市XX区XX路XX号",
          "time": "09:00-12:00",
          "description": "推荐理由描述，1-2句话",
          "tags": ["标签1", "标签2"]
        }
      ]
    }
  ]
}

请确保所有地点都是郑州真实存在的地点，不要虚构。`;
    }

    /**
     * ★ 构建天气预报区块：智能合并多数据源，按天整理
     * @param {Array} weatherInfo - WeatherAgent 返回的 forecasts 数组
     * @param {number} dayCount - 出行天数
     * @returns {string} 格式化的天气文本
     */
    _buildWeatherSection(weatherInfo, dayCount) {
        if (!weatherInfo || weatherInfo.length === 0) return '';

        // 1. 从最高优先级数据源提取按天预报（高德 > 和风 > 本地）
        const sorted = [...weatherInfo].sort((a, b) => (a.priority || 99) - (b.priority || 99));
        const primary = sorted.find(s => s.data && s.data.length >= dayCount) || sorted[0];

        if (!primary?.data || primary.data.length === 0) return '';

        // 2. 构建每日天气预报文本
        const dayLabels = ['第一天', '第二天', '第三天'];
        let text = `\n\n【每日天气预报】（数据源：${primary.source}，多源交叉验证）`;

        const forecastDays = primary.data.slice(0, dayCount);
        forecastDays.forEach((d, i) => {
            const dayW = d.dayweather || d.textDay || '未知';
            const nightW = d.nightweather || d.textNight || '';
            const high = d.daytemp || d.tempMax || '--';
            const low = d.nighttemp || d.tempMin || '--';
            const wind = d.wind || d.windDirDay || '';
            const hum = d.humidity || '';

            text += `\n${dayLabels[i]}：${dayW}${nightW && nightW !== dayW ? '转' + nightW : ''}，${low}°C ~ ${high}°C`;
            if (wind) text += `，${wind}`;
            if (hum) text += `，湿度${hum}%`;

            // 天气预警提示
            const rainKeywords = ['雨', '雪', '雷', '暴'];
            const isRain = rainKeywords.some(k => dayW.includes(k) || nightW.includes(k));
            const isHot = parseInt(high) >= 35;
            const isCold = parseInt(low) <= 5;

            if (isRain) text += ` ⚠️有降水，建议安排室内或带雨具`;
            if (isHot) text += ` 🔥高温，避免正午户外活动`;
            if (isCold) text += ` ❄️低温，注意保暖`;
        });

        return text;
    }

    /**
     * 解析用户输入中的关键约束（天数、预算、身份）
     */
    _parseUserNeeds(userInput) {
        if (!userInput) return { dayCount: 2, tightBudget: false, student: false };
        const input = userInput.toLowerCase();
        const needs = { dayCount: 2, tightBudget: false, student: false };

        // 天数检测
        if (/半天|半日|当天|一天|一日|1天/.test(input)) {
            needs.dayCount = 1;
        } else if (/三天|三日|3天/.test(input)) {
            needs.dayCount = 3;
        }

        // 预算检测
        if (/钱少|省钱|穷游|预算有限|便宜|没钱|性价比/.test(input)) {
            needs.tightBudget = true;
        }

        // 学生检测
        if (/大学|学生|在校/.test(input)) {
            needs.student = true;
            needs.tightBudget = true;
        }

        return needs;
    }

    /**
     * 调用LLM生成行程
     * @param {string} scenario - 场景类型
     * @param {Array} weatherInfo - 天气信息
     * @param {string} userInput - 用户自定义需求
     */
    async generatePlan(scenario, weatherInfo, userInput = '') {
        const keys = APP_CONFIG.apiKeys;
        if (!keys.llmUrl || !keys.llmKey) {
            throw new Error('请先配置LLM API');
        }

        const prompt = this.buildPrompt(scenario, weatherInfo, userInput);

        const res = await this._llmFetch(
            keys.llmUrl,
            keys.llmKey,
            {
                model: keys.llmModel || '',
                messages: [
                    { role: 'system', content: '你是一个专业的郑州本地旅行规划助手。你必须只输出JSON格式数据，不要输出任何解释、问候、markdown标记或思考过程。直接以 { 开头输出JSON。' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 3000,
            },
            60000
        );

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error?.message || errData.detail || `请求失败: HTTP ${res.status}`;
            throw new Error(errMsg);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        // ★ 打印原始返回内容，方便排查
        console.log('[LLM] 原始返回内容 (前500字符):', content.substring(0, 500));

        // 尝试解析JSON
        return this.parseLLMResponse(content);
    }

    /**
     * 解析LLM返回的JSON
     */
    parseLLMResponse(content) {
        if (!content) throw new Error('AI未返回任何内容');

        // ★ 策略1：提取 ```json ... ``` 代码块
        const fencedJson = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (fencedJson) {
            const plan = this._tryParseJson(fencedJson[1]);
            if (plan) return plan;
        }

        // ★ 策略2：提取 ``` ... ``` 通用代码块
        const fencedAny = content.match(/```\s*([\s\S]*?)\s*```/);
        if (fencedAny) {
            const plan = this._tryParseJson(fencedAny[1]);
            if (plan) return plan;
        }

        // ★ 策略3：提取最外层 { ... } JSON 对象（含嵌套的花括号匹配）
        const braceJson = this._extractOutermostJson(content);
        if (braceJson) {
            const plan = this._tryParseJson(braceJson);
            if (plan) return plan;
        }

        // ★ 策略4：查找包含 "days" 关键字的 JSON 片段
        const daysIdx = content.indexOf('"days"');
        if (daysIdx >= 0) {
            // 从 "days" 往前找最近的 {
            const textBefore = content.substring(0, daysIdx);
            const braceStart = textBefore.lastIndexOf('{');
            if (braceStart >= 0) {
                // 从 braceStart 开始逐字符匹配花括号
                let depth = 0;
                let braceEnd = -1;
                for (let i = braceStart; i < content.length; i++) {
                    if (content[i] === '{') depth++;
                    if (content[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            braceEnd = i;
                            break;
                        }
                    }
                }
                if (braceEnd >= 0) {
                    const candidate = content.substring(braceStart, braceEnd + 1);
                    const plan = this._tryParseJson(candidate);
                    if (plan) return plan;
                }
            }
        }

        // ★ 策略5：直接尝试整个 content
        const plan = this._tryParseJson(content.trim());
        if (plan) return plan;

        console.error('[LLM] 无法从响应中提取有效JSON。原始内容:', content.substring(0, 300));
        throw new Error('AI返回内容解析失败，请重试');
    }

    /**
     * 尝试解析 JSON 字符串并验证字段
     */
    _tryParseJson(jsonStr) {
        try {
            const plan = JSON.parse(jsonStr);
            if (plan.days && Array.isArray(plan.days) && plan.days.length > 0) {
                return plan;
            }
        } catch {
            // 解析失败，静默返回 null
        }
        return null;
    }

    /**
     * 从文本中提取最外层的 JSON 对象（通过花括号匹配）
     */
    _extractOutermostJson(text) {
        let start = -1;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
                start = i;
                break;
            }
        }
        if (start < 0) return null;

        let depth = 0;
        for (let i = start; i < text.length; i++) {
            if (text[i] === '{') depth++;
            if (text[i] === '}') {
                depth--;
                if (depth === 0) {
                    return text.substring(start, i + 1);
                }
            }
        }
        return null;
    }

    /**
     * 为LLM生成的计划补充地理坐标
     * ★ 关键改进：优先从本地库按名称匹配，命中直接用真实坐标，
     *   彻底避免"库外地点坐标飞走/随机抖动"问题（如龙子湖事件）
     */
    async enrichPlanWithCoords(plan) {
        const enrichedDays = [];
        for (const day of plan.days) {
            const enrichedItems = [];
            for (const item of day.items) {
                // ★ 优先本地库匹配：LLM 从【可用地点库】选的点，坐标 100% 准确
                const localPlace = this._matchLocalPlace(item.name);
                let finalCoords = null;
                let enrichedAddress = item.address;
                let placeObj = null;

                if (localPlace) {
                    finalCoords = localPlace.coords;
                    enrichedAddress = localPlace.address;
                    placeObj = localPlace;
                } else {
                    // 库内未命中：走地理编码兜底
                    let coords = null;
                    if (APP_CONFIG.apiKeys.amap) {
                        const geoResult = await this.apiService.geocodeAmap(item.name + ' ' + (item.address || ''));
                        if (geoResult) {
                            coords = geoResult.coords;
                            enrichedAddress = enrichedAddress || geoResult.name;
                        }
                    }
                    if (!coords) {
                        const query = item.address ? `${item.name} ${item.address}` : item.name;
                        const osmResult = await this.apiService.geocodeNominatim(query);
                        if (osmResult) coords = osmResult.coords;
                    }
                    if (coords) {
                        finalCoords = coords;
                    } else {
                        // 兜底：随机偏移（仅限地理编码也失败的极少数情况）
                        const base = APP_CONFIG.zhengzhouCenter;
                        const jitter = 0.005;
                        finalCoords = [
                            base[0] + (Math.random() - 0.5) * jitter * 2,
                            base[1] + (Math.random() - 0.5) * jitter * 2,
                        ];
                    }
                }

                enrichedItems.push({
                    ...item,
                    coords: finalCoords,
                    address: enrichedAddress || item.address || '郑州',
                    place: placeObj || {
                        name: item.name,
                        address: enrichedAddress || item.address || '郑州',
                        coords: finalCoords,
                        description: item.description,
                        tags: item.tags || [],
                    },
                });
            }
            enrichedDays.push({ ...day, items: enrichedItems });
        }
        return { ...plan, days: enrichedDays };
    }

    /**
     * 按名称在本地库中匹配地点（精确 → 包含，兼容 LLM 返回带后缀的名称）
     */
    _matchLocalPlace(name) {
        if (!name) return null;
        const places = (typeof ZhengzhouData !== 'undefined' && ZhengzhouData)
            ? Object.values(ZhengzhouData.places) : [];
        const n = String(name).trim().toLowerCase();
        let hit = places.find(p => (p.name || '').toLowerCase() === n);
        if (!hit) hit = places.find(p => {
            const pn = (p.name || '').toLowerCase();
            return pn && (n.includes(pn) || pn.includes(n));
        });
        return hit || null;
    }
}

// 导出
window.LLMService = LLMService;

/**
 * 共享工具：通过本地代理发送 LLM 请求（供 evaluatorService 等复用）
 * @returns {Promise<Response>}
 */
window.llmFetchProxy = async function (targetUrl, apiKey, body, timeout = 30000) {
    const host = window.location.hostname;
    const useProxy = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');

    if (useProxy) {
        return fetch('/api/proxy/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl, apiKey, body }),
            signal: AbortSignal.timeout(timeout),
        });
    }

    const fullUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
    return fetch(fullUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
    });
};
