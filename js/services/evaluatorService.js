/**
 * ============================================
 * 统一评价器 - 多维度评分 + 星级反馈
 * 职责：对生成的计划进行多维度评价打分
 * 模式：LLM评价（优先） / 规则评价（兜底）
 * ============================================
 */

class EvaluatorService {
    constructor() {
        this.dimensions = [
            { key: 'routeRationality',   name: '路线合理性',   icon: '🛣️', weight: 20, desc: '行程路线是否顺畅，地点间距离是否合理' },
            { key: 'timeArrangement',    name: '时间安排',     icon: '⏱️', weight: 20, desc: '每日时间分配是否得当，是否过于紧凑或松散' },
            { key: 'scenarioMatch',      name: '场景匹配度',   icon: '🎯', weight: 25, desc: '行程是否符合所选场景的特殊需求' },
            { key: 'attractionQuality',  name: '景点质量',     icon: '🏆', weight: 15, desc: '所选景点的品质、热度与口碑' },
            { key: 'weatherAdaptation',  name: '天气适配',     icon: '🌤️', weight: 10, desc: '是否考虑了天气因素合理安排室内外活动' },
            { key: 'foodDiversity',      name: '美食丰富度',   icon: '🍜', weight: 10, desc: '餐饮推荐的多样性，是否包含地道美食' },
        ];
    }

    /**
     * 评价计划 - 主入口
     */
    async evaluate(plan, scenario, agentData, mode = 'default') {
        const results = {
            overall: 0,
            stars: 0,
            starDisplay: '',
            dimensions: {},
            feedback: '',
            highlights: [],
            suggestions: [],
            mode: mode,
            evaluatedAt: new Date().toISOString(),
        };

        // ---- 尝试LLM评价 ----
        if (mode === 'llm' && APP_CONFIG.apiKeys.llmKey) {
            try {
                const llmResult = await this._evaluateWithLLM(plan, scenario, agentData);
                if (llmResult) {
                    return { ...results, ...llmResult, mode: 'llm' };
                }
            } catch (e) {
                console.warn('[Evaluator] LLM评价失败，回退到规则评价:', e.message);
            }
        }

        // ---- 规则评价（兜底） ----
        return this._evaluateByRules(plan, scenario, agentData);
    }

    /**
     * LLM评价
     */
    async _evaluateWithLLM(plan, scenario, agentData) {
        const keys = APP_CONFIG.apiKeys;
        const planSummary = this._summarizePlan(plan);
        const agentSummary = this._summarizeAgentData(agentData);

        const prompt = `你是一个专业的旅行规划评价专家。请对以下郑州周末出行计划进行多维度评价。

【出行场景】${APP_CONFIG.scenarios[scenario]?.name || scenario}

【行程计划】
${planSummary}

【多Agent采集数据】
${agentSummary}

【评价维度】
1. 路线合理性(20分) - 行程路线是否顺畅
2. 时间安排(20分) - 时间分配是否得当
3. 场景匹配度(25分) - 是否符合"${APP_CONFIG.scenarios[scenario]?.name || scenario}"场景
4. 景点质量(15分) - 所选景点的品质和口碑
5. 天气适配(10分) - 是否考虑了天气因素
6. 美食丰富度(10分) - 餐饮推荐质量

请严格按照以下JSON格式输出（不要输出其他内容）：
{
  "dimensions": {
    "routeRationality": {"score": 85, "comment": "简短评价"},
    "timeArrangement": {"score": 80, "comment": "简短评价"},
    "scenarioMatch": {"score": 90, "comment": "简短评价"},
    "attractionQuality": {"score": 88, "comment": "简短评价"},
    "weatherAdaptation": {"score": 75, "comment": "简短评价"},
    "foodDiversity": {"score": 82, "comment": "简短评价"}
  },
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "suggestions": ["建议1", "建议2"],
  "feedback": "总体评价，50字以内"
}`;

        const res = await window.llmFetchProxy(
            keys.llmUrl,
            keys.llmKey,
            {
                model: keys.llmModel || '',
                messages: [
                    { role: 'system', content: '你是一个旅行规划评价专家。你必须只输出JSON格式数据，不要输出任何解释或markdown。' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.5,
                max_tokens: 1500,
            },
            30000
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 提取JSON
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                          content.match(/```\s*([\s\S]*?)\s*```/) ||
                          [null, content];

        const parsed = JSON.parse((jsonMatch[1] || content).trim());

        // 计算总分
        return this._finalizeEvaluation(parsed);
    }

    /**
     * 规则评价
     */
    async _evaluateByRules(plan, scenario, agentData) {
        const dimScores = {};

        // 1. 路线合理性 (基于交通Agent数据)
        dimScores.routeRationality = this._scoreRouteRationality(plan, agentData);
        await this._delay(150);

        // 2. 时间安排
        dimScores.timeArrangement = this._scoreTimeArrangement(plan);
        await this._delay(100);

        // 3. 场景匹配度
        dimScores.scenarioMatch = this._scoreScenarioMatch(plan, scenario, agentData);
        await this._delay(120);

        // 4. 景点质量 (基于Review Agent数据)
        dimScores.attractionQuality = this._scoreAttractionQuality(plan, agentData);
        await this._delay(100);

        // 5. 天气适配
        dimScores.weatherAdaptation = this._scoreWeatherAdaptation(plan, agentData);
        await this._delay(80);

        // 6. 美食丰富度
        dimScores.foodDiversity = this._scoreFoodDiversity(plan, agentData);
        await this._delay(80);

        // 生成亮点和建议
        const { highlights, suggestions } = this._generateHighlightsAndSuggestions(
            dimScores, plan, scenario
        );

        const feedback = this._generateFeedback(dimScores, scenario);

        return this._finalizeEvaluation({
            dimensions: dimScores,
            highlights,
            suggestions,
            feedback,
        });
    }

    // ==================== 各维度评分函数 ====================

    _scoreRouteRationality(plan, agentData) {
        let score = 75; // 基础分

        const locations = [];
        plan?.days?.forEach(day => {
            day?.items?.forEach(item => {
                if (item?.place?.coords) locations.push(item.place);
            });
        });

        if (locations.length <= 1) {
            return { score: 90, comment: '地点集中在同一区域，路线简洁高效' };
        }

        // 检查地点聚集度
        const allLng = locations.map(l => l.coords[1]);
        const allLat = locations.map(l => l.coords[0]);
        const lngRange = Math.max(...allLng) - Math.min(...allLng);
        const latRange = Math.max(...allLat) - Math.min(...allLat);

        if (lngRange < 0.1 && latRange < 0.1) {
            score += 15;
        } else if (lngRange < 0.3 && latRange < 0.3) {
            score += 5;
        } else {
            score -= 10;
        }

        // 交通Agent评价
        const trafficAdvice = agentData?.traffic?.advice || '';
        if (trafficAdvice.includes('步行')) score += 5;
        if (trafficAdvice.includes('建议自驾') && locations.length > 4) score -= 5;

        score = Math.min(100, Math.max(40, score));

        if (score >= 85) return { score, comment: '行程路线紧凑合理，地点间距适当' };
        if (score >= 70) return { score, comment: '路线基本合理，部分段可优化' };
        return { score, comment: '路线跨度较大，建议减小活动范围或预留更多交通时间' };
    }

    _scoreTimeArrangement(plan) {
        let score = 78;
        const totalItems = plan?.days?.reduce((s, d) => s + (d.items?.length || 0), 0) || 0;

        if (totalItems >= 5 && totalItems <= 7) score += 15;
        else if (totalItems >= 4 && totalItems <= 8) score += 8;
        else if (totalItems < 3) score -= 15;
        else if (totalItems > 10) score -= 10;

        // 每天活动数量均衡
        if (plan?.days?.length === 2) {
            const day1Count = plan.days[0]?.items?.length || 0;
            const day2Count = plan.days[1]?.items?.length || 0;
            const diff = Math.abs(day1Count - day2Count);
            if (diff <= 1) score += 8;
            else if (diff >= 3) score -= 10;
        }

        score = Math.min(100, Math.max(40, score));

        if (score >= 85) return { score, comment: '时间安排松紧适度，每天活动量合理' };
        if (score >= 70) return { score, comment: '时间分配基本合理，可微调活动密度' };
        return { score, comment: '活动安排过多或过少，建议调整' };
    }

    _scoreScenarioMatch(plan, scenario, agentData) {
        let score = 70;

        const scenarioTags = {
            family: ['亲子', '乐园', '动物园', '博物馆', '公园', '安全'],
            friends: ['探险', '互动', '美食', '打卡', '刺激', '团队'],
            couple: ['浪漫', '夜景', '咖啡馆', '观景', '安静', '拍照'],
            solo: ['深度', '历史', '文化', '博物馆', '自由', '独立'],
        };

        const expectedTags = scenarioTags[scenario] || [];
        let matchCount = 0;
        let totalChecks = 0;

        plan?.days?.forEach(day => {
            day?.items?.forEach(item => {
                const tags = item?.place?.tags || item?.tags || [];
                const desc = (item?.place?.description || item?.description || '').toLowerCase();
                expectedTags.forEach(tag => {
                    totalChecks++;
                    if (tags.some(t => t.includes(tag)) || desc.includes(tag.toLowerCase())) {
                        matchCount++;
                    }
                });
            });
        });

        if (totalChecks > 0) {
            const matchRate = matchCount / totalChecks;
            score += Math.round(matchRate * 25) - 10;
        }

        // 场景特殊检查
        if (scenario === 'family') {
            const hasIndoor = JSON.stringify(plan).includes('室内');
            if (hasIndoor) score += 5;
        }
        if (scenario === 'couple') {
            const hasNight = JSON.stringify(plan).includes('夜景') || JSON.stringify(plan).includes('傍晚');
            if (hasNight) score += 8;
        }

        score = Math.min(100, Math.max(40, score));

        if (score >= 85) return { score, comment: `完美契合${APP_CONFIG.scenarios[scenario]?.name}场景需求` };
        if (score >= 70) return { score, comment: '大部分选择符合场景特点' };
        return { score, comment: '部分安排和场景定位存在偏差，可进一步聚焦' };
    }

    _scoreAttractionQuality(plan, agentData) {
        let score = 72;
        let ratedCount = 0;
        let totalRating = 0;

        plan?.days?.forEach(day => {
            day?.items?.forEach(item => {
                const rating = item?.place?.rating;
                if (rating) {
                    totalRating += rating;
                    ratedCount++;
                }
            });
        });

        if (ratedCount > 0) {
            const avgRating = totalRating / ratedCount;
            score = Math.round(avgRating * 18) + 20;
        }

        // Review Agent数据加分
        const reviewSummary = agentData?.reviews?.summary || '';
        if (reviewSummary.includes('极佳')) score += 8;

        // AAAAA/四星以上景区加分
        const hasTopAttraction = JSON.stringify(plan).includes('AAAAA') ||
                                 JSON.stringify(plan).includes('世界遗产');
        if (hasTopAttraction) score += 10;

        score = Math.min(100, Math.max(40, score));

        if (score >= 85) return { score, comment: '所选景点品质卓越，含高评分地标景点' };
        if (score >= 70) return { score, comment: '景点选择整体良好，口碑尚可' };
        return { score, comment: '建议纳入更多高口碑景点提升体验' };
    }

    _scoreWeatherAdaptation(plan, agentData) {
        let score = 75;
        const weatherText = JSON.stringify(agentData?.weather?.forecasts || '');

        if (weatherText.includes('雨') || weatherText.includes('雷')) {
            const hasIndoor = JSON.stringify(plan).includes('博物馆') ||
                              JSON.stringify(plan).includes('海洋馆') ||
                              JSON.stringify(plan).includes('室内');
            if (hasIndoor) score += 15;
            else score -= 20;
        }

        if (weatherText.includes('高温') || (agentData?.weather?.warnings || []).some(w => w.includes('高温'))) {
            const avoidNoon = JSON.stringify(plan).toLowerCase().includes('上午') ||
                              JSON.stringify(plan).toLowerCase().includes('早上');
            if (avoidNoon) score += 10;
            else score -= 10;
        }

        score = Math.min(100, Math.max(40, score));

        if (score >= 85) return { score, comment: '行程充分考虑了天气因素，室内外搭配合理' };
        if (score >= 70) return { score, comment: '天气适应性尚可，部分安排可结合天气优化' };
        return { score, comment: '建议根据天气调整行程，增加备用雨天方案' };
    }

    _scoreFoodDiversity(plan, agentData) {
        let score = 70;

        const foodKeywords = ['烩面', '胡辣汤', '夜市', '小吃', '火锅', '烧烤', '豫菜', '餐厅'];
        const planText = JSON.stringify(plan).toLowerCase();
        const matchCount = foodKeywords.filter(k => planText.includes(k.toLowerCase())).length;

        score += matchCount * 5;

        const restaurantCount = agentData?.restaurants?.length || 0;
        if (restaurantCount >= 3) score += 8;

        // 是否有本地特色
        if (planText.includes('烩面') || planText.includes('胡辣汤')) score += 10;

        score = Math.min(100, Math.max(40, score));

        if (score >= 85) return { score, comment: '餐饮推荐丰富多样，包含地道郑州美食' };
        if (score >= 70) return { score, comment: '美食选择尚可，建议增加本地特色推荐' };
        return { score, comment: '美食推荐较少，可丰富餐饮选项' };
    }

    // ==================== 亮点与建议生成 ====================
    _generateHighlightsAndSuggestions(dimScores, plan, scenario) {
        const highlights = [];
        const suggestions = [];

        Object.entries(dimScores).forEach(([key, val]) => {
            const dim = this.dimensions.find(d => d.key === key);
            if (val.score >= 85) {
                highlights.push(`${dim?.icon || '✨'} ${dim?.name || key}：${val.comment}`);
            }
            if (val.score < 65) {
                suggestions.push(`${dim?.icon || '💡'} ${dim?.name || key}：${val.comment}`);
            }
        });

        // 场景特殊建议
        if (scenario === 'family' && !suggestions.some(s => s.includes('时间'))) {
            suggestions.push('👨‍👩‍👧‍👦 建议预留充足的休息时间，带小孩出行节奏不宜过快');
        }
        if (scenario === 'couple' && !highlights.some(h => h.includes('夜景'))) {
            suggestions.push('💑 建议增加傍晚或夜景行程，为约会增添浪漫氛围');
        }

        return { highlights, suggestions };
    }

    _generateFeedback(dimScores, scenario) {
        const scenarioName = APP_CONFIG.scenarios[scenario]?.name || scenario;
        const scores = Object.values(dimScores).map(d => d.score);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

        if (avg >= 85) return `整体优秀的${scenarioName}行程计划！各项安排均衡合理，可以直接出发！`;
        if (avg >= 75) return `整体不错的${scenarioName}行程，部分细节可优化，总体推荐使用。`;
        if (avg >= 65) return `${scenarioName}行程基本可行，建议根据反馈微调后出行。`;
        return `${scenarioName}行程有较大优化空间，建议重新规划或参考建议调整。`;
    }

    // ==================== 最终计算 ====================
    _finalizeEvaluation(parsed) {
        const dimensions = parsed.dimensions || {};
        let totalScore = 0;
        let totalWeight = 0;

        this.dimensions.forEach(dim => {
            const dimScore = dimensions[dim.key]?.score;
            if (typeof dimScore === 'number') {
                totalScore += dimScore * dim.weight;
                totalWeight += dim.weight;
            }
        });

        // 加权平均
        const overall = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 70;
        const stars = Math.round((overall / 100) * 5 * 2) / 2; // 半星精度

        let starDisplay = '';
        const fullStars = Math.floor(stars);
        const hasHalf = stars % 1 >= 0.5;
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) starDisplay += '⭐';
            else if (i === fullStars && hasHalf) starDisplay += '🌟';
            else starDisplay += '☆';
        }

        return {
            overall,
            stars,
            starDisplay,
            dimensions,
            highlights: parsed.highlights || [],
            suggestions: parsed.suggestions || [],
            feedback: parsed.feedback || '',
        };
    }

    // ==================== 辅助 ====================
    _summarizePlan(plan) {
        let summary = '';
        plan?.days?.forEach(day => {
            summary += `\n${day.label}：`;
            day?.items?.forEach((item, i) => {
                const name = item?.place?.name || item?.name || '';
                summary += `\n  ${i + 1}. ${name} (${item.time || ''})`;
            });
        });
        return summary.trim() || '无行程数据';
    }

    _summarizeAgentData(agentData) {
        const parts = [];
        if (agentData?.weather?.warnings?.length) {
            parts.push(`天气预警：${agentData.weather.warnings.join('；')}`);
        }
        if (agentData?.reviews?.summary) {
            parts.push(`口碑汇总：${agentData.reviews.summary}`);
        }
        if (agentData?.traffic?.advice) {
            parts.push(`交通建议：${agentData.traffic.advice}`);
        }
        return parts.join('\n') || '无额外数据';
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

window.EvaluatorService = EvaluatorService;
