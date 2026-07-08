/**
 * ============================================
 * Agent协调器 - Multi-Agent调度中心
 * 职责：并行调度所有Agent、结果汇聚合并、冲突解决
 * ============================================
 */

class AgentCoordinator {
    constructor(apiService) {
        this.apiService = apiService;

        // 注册所有Agent
        this.agents = [
            new WeatherAgent(apiService),
            new POIAgent(apiService),
            new TrafficAgent(apiService),
            new ReviewAgent(apiService),
        ];

        this.executionLog = [];
        this.onAgentUpdate = null;  // UI回调
    }

    /**
     * 并行执行所有Agent
     * @param {Object} context - { scenario, locations, weather }
     * @returns {Object} 合并后的Agent结果
     */
    async executeAll(context) {
        this.executionLog = [];

        // 通知UI开始
        this._notify('start', { agents: this.agents.map(a => ({
            name: a.name, type: a.type, icon: a.icon, status: 'working',
        }))});

        // ---- 并行执行所有Agent ----
        const promises = this.agents.map(agent =>
            agent.run(context).then(() => {
                this.executionLog.push(agent.getSummary());
                this._notify('agent_update', agent.getSummary());
                return agent;
            }).catch(err => {
                this._notify('agent_error', { agent: agent.name, error: err.message });
                return agent;
            })
        );

        const completedAgents = await Promise.all(promises);

        // ---- 汇聚结果 ----
        const merged = this._mergeResults(completedAgents, context);

        // 通知完成
        this._notify('complete', {
            summary: this.executionLog,
            merged,
        });

        return merged;
    }

    /**
     * 合并所有Agent结果
     */
    _mergeResults(agents, context) {
        const weatherAgent = agents.find(a => a.type === 'weather');
        const poiAgent = agents.find(a => a.type === 'poi');
        const trafficAgent = agents.find(a => a.type === 'traffic');
        const reviewAgent = agents.find(a => a.type === 'review');

        const weatherResult = weatherAgent?.result || {};
        const poiResult = poiAgent?.result || {};
        const trafficResult = trafficAgent?.result || {};
        const reviewResult = reviewAgent?.result || {};

        // 提取核心数据
        const weatherForecasts = weatherResult.forecasts || [];
        const topAttractions = poiResult.ranking || [];
        const restaurantList = poiResult.restaurants?.flatMap(r => r.data) || [];
        const routeSegments = trafficResult.routes?.flatMap(r => r.segments) || [];
        const placeReviews = reviewResult.placeReviews || [];
        const hotTopics = reviewResult.hotTopics || [];
        const crowdPredictions = reviewResult.crowdPredictions || [];

        return {
            // 天气
            weather: {
                forecasts: weatherForecasts,
                recommendation: weatherResult.recommendation || '',
                warnings: weatherResult.warnings || [],
                confidence: weatherResult.confidence || 0,
            },

            // 景点
            attractions: topAttractions.slice(0, 10),

            // 餐厅
            restaurants: restaurantList,

            // 交通
            traffic: {
                segments: routeSegments,
                totalTime: trafficResult.totalTravelTime || 0,
                advice: trafficResult.transportAdvice || '',
            },

            // 口碑
            reviews: {
                placeReviews,
                hotTopics,
                crowdPredictions,
                summary: reviewResult.summary || '',
            },

            // 元数据
            meta: {
                totalSources: agents.reduce((sum, a) => sum + a.sources.length, 0),
                sourcesList: agents.flatMap(a => a.sources),
                agentCount: agents.length,
                completedCount: agents.filter(a => a.status === 'done').length,
                errorCount: agents.filter(a => a.status === 'error').length,
                totalDuration: agents.reduce((sum, a) => sum + a.duration, 0),
            },
        };
    }

    /**
     * 通知UI更新
     */
    _notify(event, data) {
        if (this.onAgentUpdate) {
            this.onAgentUpdate(event, data);
        }
    }

    /**
     * 获取Agent状态列表
     */
    getAgentStatuses() {
        return this.agents.map(a => ({
            name: a.name,
            type: a.type,
            icon: a.icon,
            status: a.status,
            progress: a.progress,
            sources: a.sources,
            duration: a.duration,
        }));
    }
}

window.AgentCoordinator = AgentCoordinator;
