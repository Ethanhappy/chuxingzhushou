/**
 * ============================================
 * Agent 3 - 交通路线Agent 🚗
 * 职责：路线规划、交通时间估算、出行方式建议
 * 数据源：本地模型 + 路线拓扑分析
 * ============================================
 */

class TrafficAgent extends BaseAgent {
    constructor(apiService) {
        super('交通路线Agent', 'traffic', '🚗', '智能路线规划与交通时间估算');
        this.apiService = apiService;
    }

    async execute(context) {
        const { scenario, locations } = context;
        const results = {
            routes: [],
            transportAdvice: '',
            timeEstimates: [],
            totalTravelTime: 0,
        };

        // ---- 数据源1：基于坐标的路线距离计算 ----
        this.progress = 30;
        if (locations && locations.length > 1) {
            const routeSegments = this._calculateRouteSegments(locations);
            results.routes.push({
                source: '本地路线引擎',
                segments: routeSegments,
                priority: 1,
            });
            this.sources.push('本地路线拓扑引擎');
            results.timeEstimates = routeSegments;
            results.totalTravelTime = routeSegments.reduce((sum, s) => sum + s.estimatedTime, 0);
        }

        // ---- 数据源2：高德驾车路线（如果有API Key） ----
        this.progress = 60;
        if (APP_CONFIG.apiKeys.amap && locations && locations.length > 1) {
            try {
                const amapRoutes = await this._getAmapRoutes(locations);
                if (amapRoutes) {
                    results.routes.push({
                        source: '高德地图路线',
                        segments: amapRoutes,
                        priority: 2,
                    });
                    this.sources.push('高德地图路线规划');
                }
            } catch (e) {
                console.warn('[TrafficAgent] 高德路线获取失败:', e.message);
            }
        }

        // ---- 出行方式建议 ----
        this.progress = 85;
        results.transportAdvice = this._generateTransportAdvice(scenario, results);

        return results;
    }

    /**
     * 基于经纬度计算路线段
     * 使用Haversine公式 + 路网系数
     */
    _calculateRouteSegments(locations) {
        const segments = [];

        for (let i = 0; i < locations.length - 1; i++) {
            const from = locations[i];
            const to = locations[i + 1];

            const distance = this._haversineDistance(from.coords, to.coords);
            const roadFactor = 1.35; // 路网系数（直线距离 → 道路距离）
            const roadDistance = distance * roadFactor;

            // 按场景估算速度
            const avgSpeed = 35; // 市区平均车速 km/h
            const drivingTime = Math.round((roadDistance / avgSpeed) * 60); // 分钟

            segments.push({
                from: from.name,
                to: to.name,
                straightDistance: Math.round(distance * 10) / 10,
                roadDistance: Math.round(roadDistance * 10) / 10,
                estimatedTime: drivingTime,
                transportMode: drivingTime > 60 ? '建议自驾/打车' : drivingTime > 30 ? '打车最优' : '打车/地铁均可',
            });
        }

        return segments;
    }

    /**
     * Haversine公式计算两点距离(km)
     */
    _haversineDistance(coord1, coord2) {
        const R = 6371;
        const [lat1, lon1] = coord1;
        const [lat2, lon2] = coord2;

        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;

        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * 尝试获取高德路线
     */
    async _getAmapRoutes(locations) {
        if (!APP_CONFIG.apiKeys.amap) return null;
        const key = APP_CONFIG.apiKeys.amap;

        const segments = [];
        for (let i = 0; i < Math.min(locations.length - 1, 3); i++) {
            const from = locations[i];
            const to = locations[i + 1];

            try {
                const origin = `${from.coords[1]},${from.coords[0]}`;
                const destination = `${to.coords[1]},${to.coords[0]}`;
                const url = `${APP_CONFIG.endpoints.amap.base}${APP_CONFIG.endpoints.amap.direction}?key=${key}&origin=${origin}&destination=${destination}&strategy=0`;

                const res = await fetch(url);
                const data = await res.json();

                if (data.status === '1' && data.route?.paths?.length > 0) {
                    const path = data.route.paths[0];
                    segments.push({
                        from: from.name,
                        to: to.name,
                        roadDistance: Math.round(parseInt(path.distance) / 1000 * 10) / 10,
                        estimatedTime: Math.round(parseInt(path.duration) / 60),
                        transportMode: '驾车',
                        traffic: path.traffic_lights ? `${path.traffic_lights}个红绿灯` : '',
                    });
                }
            } catch (e) {
                // 单个段失败继续
            }
        }
        return segments.length > 0 ? segments : null;
    }

    /**
     * 生成出行方式建议
     */
    _generateTransportAdvice(scenario, results) {
        const totalTime = results.totalTravelTime || 0;

        if (scenario === 'family') {
            if (totalTime > 90) return '🎯 建议自驾出行，带小孩乘坐公共交通不便，且各景点间距离较远';
            return '🚗 建议自驾或打车，方便携带儿童用品';
        }

        if (scenario === 'friends') {
            if (totalTime > 60) return '🚙 建议打车或拼车，人多分摊费用不高，且更灵活自由';
            return '🚇 地铁+打车组合，市区内地铁覆盖良好';
        }

        if (scenario === 'couple') {
            if (totalTime > 45) return '🚗 建议打车出行，省去寻找停车位的烦恼，专注二人时光';
            return '🚶 部分景点距离较近可步行，远距离建议打车';
        }

        if (scenario === 'solo') {
            return '🚇 推荐地铁+单车方式，经济实惠且可深度感受城市脉搏';
        }

        return '🚗 建议根据距离选择打车或公共交通';
    }
}

window.TrafficAgent = TrafficAgent;
