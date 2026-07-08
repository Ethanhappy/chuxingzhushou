/**
 * ============================================
 * Agent 2 - 景点搜索Agent 🏛️
 * 职责：多源POI搜索、景点匹配、推荐排序
 * 数据源：高德POI + 本地景点库 + OSM检索
 * ============================================
 */

class POIAgent extends BaseAgent {
    constructor(apiService) {
        super('景点搜索Agent', 'poi', '🏛️', '多源景点发现与智能匹配推荐');
        this.apiService = apiService;
    }

    async execute(context) {
        const { scenario, weather } = context;
        const results = {
            attractions: [],
            restaurants: [],
            ranking: [],
            recommendations: '',
        };

        // 根据场景确定搜索偏好
        const categories = this._getScenarioCategories(scenario);

        // ---- 数据源1：本地景点库（最高优先级，数据最可靠） ----
        this.progress = 25;
        const localPlaces = this._searchLocalDB(scenario, categories);
        if (localPlaces.length > 0) {
            results.attractions.push({
                source: '本地景点库',
                data: localPlaces,
                priority: 1,
            });
            this.sources.push('郑州本地景点数据库');
        }

        // ---- 数据源2：高德POI搜索 ----
        this.progress = 50;
        if (APP_CONFIG.apiKeys.amap) {
            try {
                const amapResults = await this._searchAmapPOI(categories);
                if (amapResults && amapResults.length > 0) {
                    results.attractions.push({
                        source: '高德地图POI',
                        data: amapResults,
                        priority: 2,
                    });
                    this.sources.push('高德地图POI搜索');
                }

                // 搜索美食
                const foodResults = await this._searchAmapFood(scenario);
                if (foodResults && foodResults.length > 0) {
                    results.restaurants.push({
                        source: '高德地图',
                        data: foodResults,
                        priority: 1,
                    });
                    this.sources.push('高德地图美食搜索');
                }
            } catch (e) {
                console.warn('[POIAgent] 高德POI搜索失败:', e.message);
            }
        }

        // ---- 数据源3：OSM Nominatim检索（免费备选） ----
        this.progress = 75;
        try {
            const osmResults = await this._searchOSM(categories);
            if (osmResults && osmResults.length > 0) {
                results.attractions.push({
                    source: 'OpenStreetMap',
                    data: osmResults,
                    priority: 3,
                });
                this.sources.push('OSM地理数据库');
            }
        } catch (e) {
            console.warn('[POIAgent] OSM搜索失败:', e.message);
        }

        // ---- 合并去重排序 ----
        this.progress = 90;
        const merged = this._mergeAndDeduplicate(results.attractions);
        results.ranking = this._rankByScenario(merged, scenario, weather);

        // 补充本地美食
        if (results.restaurants.length === 0) {
            results.restaurants = [{
                source: '本地餐饮库',
                data: this._getLocalFood(scenario),
                priority: 1,
            }];
            this.sources.push('本地餐饮数据库');
        }

        return results;
    }

    /**
     * 根据场景返回兴趣类别
     */
    _getScenarioCategories(scenario) {
        const map = {
            family: ['公园', '动物园', '游乐场', '博物馆', '植物园', '科技馆', '亲子'],
            friends: ['风景名胜', '博物馆', '购物', '酒吧', 'KTV', '密室逃脱', '景点'],
            couple: ['公园', '电影院', '咖啡厅', '观景台', '花海', '艺术馆', '步行街'],
            solo: ['博物馆', '历史遗迹', '图书馆', '书店', '公园', '寺庙', '山'],
        };
        return map[scenario] || ['景点', '公园', '博物馆'];
    }

    /**
     * 本地数据库搜索
     */
    _searchLocalDB(scenario, categories) {
        if (!window.ZhengzhouData) return [];

        const allPlaces = Object.values(ZhengzhouData.places);
        const matches = [];

        allPlaces.forEach(place => {
            // 检查适合场景
            if (place.suitable && place.suitable.includes(scenario)) {
                matches.push({
                    id: place.id,
                    name: place.name,
                    address: place.address,
                    coords: place.coords,
                    category: place.category,
                    rating: place.rating,
                    price: place.price,
                    description: place.description,
                    tags: place.tags,
                    matchScore: 90,
                });
            } else {
                // 检查类别匹配
                const categoryMatch = categories.some(c =>
                    place.category?.includes(c) || place.tags?.some(t => t.includes(c))
                );
                if (categoryMatch) {
                    matches.push({
                        id: place.id,
                        name: place.name,
                        address: place.address,
                        coords: place.coords,
                        category: place.category,
                        rating: place.rating,
                        price: place.price,
                        description: place.description,
                        tags: place.tags,
                        matchScore: 60,
                    });
                }
            }
        });

        return matches.sort((a, b) => b.matchScore - a.matchScore);
    }

    /**
     * 高德POI搜索
     */
    async _searchAmapPOI(categories) {
        const allResults = [];
        for (const cat of categories.slice(0, 3)) {
            try {
                const pois = await this.apiService.searchPOI(cat, '郑州');
                if (pois && pois.length > 0) {
                    pois.forEach(p => {
                        allResults.push({
                            name: p.name,
                            address: p.address,
                            coords: p.coords,
                            category: cat,
                            rating: p.rating ? parseFloat(p.rating) : null,
                            matchScore: 70,
                        });
                    });
                }
            } catch (e) {
                // 单个类别失败不影响整体
            }
        }
        return allResults;
    }

    /**
     * 搜索高德美食
     */
    async _searchAmapFood(scenario) {
        const foodKeywords = {
            family: ['亲子餐厅', '火锅', '中餐馆'],
            friends: ['火锅', '烧烤', '大排档', '川菜'],
            couple: ['西餐', '日料', '咖啡厅', '甜品'],
            solo: ['小吃', '面馆', '快餐', '咖啡馆'],
        };

        const keywords = foodKeywords[scenario] || ['美食', '小吃'];
        const allResults = [];
        for (const kw of keywords.slice(0, 2)) {
            try {
                const pois = await this.apiService.searchPOI(kw, '郑州');
                if (pois) allResults.push(...pois.map(p => ({
                    name: p.name,
                    address: p.address,
                    coords: p.coords,
                    type: kw,
                    rating: p.rating ? parseFloat(p.rating) : null,
                })));
            } catch (e) { /* skip */ }
        }
        return allResults;
    }

    /**
     * OSM搜索（免费无Key）
     */
    async _searchOSM(categories) {
        const allResults = [];
        for (const cat of categories.slice(0, 2)) {
            try {
                const result = await this.apiService.geocodeNominatim(`${cat} 景点 郑州`);
                if (result) {
                    allResults.push({
                        name: cat + '景点',
                        address: result.name,
                        coords: result.coords,
                        category: cat,
                        matchScore: 40,
                    });
                }
            } catch (e) { /* skip */ }
        }
        return allResults;
    }

    /**
     * 本地美食数据
     */
    _getLocalFood(scenario) {
        const foodMap = {
            family: [
                { name: '萧记三鲜烩面', address: '金水区经三路', tags: ['烩面', '老字号'] },
                { name: '阿五黄河大鲤鱼', address: '金水区花园路', tags: ['豫菜', '黄河鲤鱼'] },
                { name: '海底捞火锅', address: '多店连锁', tags: ['火锅', '亲子友好'] },
            ],
            friends: [
                { name: '方中山胡辣汤', address: '金水区顺河路', tags: ['早餐', '必吃'] },
                { name: '二七广场夜市', address: '二七区德化街', tags: ['夜市', '小吃'] },
                { name: '炉小哥烤肉', address: '金水区花园路', tags: ['烤肉', '聚会'] },
            ],
            couple: [
                { name: '漫咖啡', address: '郑东新区CBD', tags: ['咖啡', '约会'] },
                { name: '山葵家日料', address: '金水区花园路', tags: ['日料', '氛围好'] },
                { name: '郑州绿地JW万豪', address: '郑东新区CBD', tags: ['高空餐厅', '夜景'] },
            ],
            solo: [
                { name: '方中山胡辣汤', address: '金水区顺河路', tags: ['早餐', '地道'] },
                { name: '合记烩面', address: '二七区人民路', tags: ['老字号', '烩面'] },
                { name: '老蔡记蒸饺', address: '二七区德化街', tags: ['百年老店', '蒸饺'] },
            ],
        };
        return foodMap[scenario] || foodMap.friends;
    }

    /**
     * 合并去重
     */
    _mergeAndDeduplicate(sources) {
        const nameMap = new Map();
        sources.forEach(source => {
            (source.data || []).forEach(item => {
                const key = item.name?.toLowerCase().trim();
                if (!nameMap.has(key) || item.matchScore > (nameMap.get(key).matchScore || 0)) {
                    nameMap.set(key, { ...item, sources: [source.source] });
                }
            });
        });
        return Array.from(nameMap.values());
    }

    /**
     * 按场景排序
     */
    _rankByScenario(places, scenario, weather) {
        const scored = places.map(place => {
            let score = place.matchScore || 50;
            if (place.rating) score += place.rating * 8;
            if (place.tags?.includes('必去') || place.tags?.includes('必吃')) score += 15;
            if (place.tags?.includes('AAAAA景区')) score += 10;

            // 天气适应
            const weatherText = weather?.forecasts?.[0]?.data?.[0]?.dayweather || '';
            if (weatherText.includes('雨') && place.tags?.includes('室内')) score += 10;

            return { ...place, finalScore: Math.round(score) };
        });

        return scored.sort((a, b) => b.finalScore - a.finalScore).slice(0, 15);
    }
}

window.POIAgent = POIAgent;
