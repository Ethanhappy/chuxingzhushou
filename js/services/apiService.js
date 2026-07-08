/**
 * ============================================
 * 郑州周末出行助手 - 多API数据服务层
 * ============================================
 * 整合高德地图、和风天气、OSM Nominatim等多个数据源
 */

class ApiService {
    constructor() {
        this.status = {
            amap: 'checking',
            qweather: 'checking',
            nominatim: 'checking',
            llm: 'checking',
        };
        this.onStatusChange = null;
    }

    // ==================== 状态管理 ====================
    setStatus(api, status) {
        this.status[api] = status;
        if (this.onStatusChange) {
            this.onStatusChange(api, status);
        }
    }

    getStatus(api) {
        return this.status[api];
    }

    // ==================== 高德地图 API ====================
    async checkAmap() {
        const key = APP_CONFIG.apiKeys.amap;
        if (!key) {
            this.setStatus('amap', 'offline');
            return false;
        }
        try {
            // 使用IP定位接口检测Key是否有效
            const url = `${APP_CONFIG.endpoints.amap.base}${APP_CONFIG.endpoints.amap.ip}?key=${key}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === '1') {
                this.setStatus('amap', 'online');
                return true;
            }
            this.setStatus('amap', 'offline');
            return false;
        } catch {
            this.setStatus('amap', 'offline');
            return false;
        }
    }

    /**
     * 获取郑州天气（高德）
     */
    async getAmapWeather() {
        const key = APP_CONFIG.apiKeys.amap;
        if (!key) return null;
        try {
            // 郑州adcode: 410100
            const url = `${APP_CONFIG.endpoints.amap.base}${APP_CONFIG.endpoints.amap.weather}?key=${key}&city=410100&extensions=all`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === '1' && data.forecasts?.length > 0) {
                return {
                    source: '高德地图',
                    city: data.forecasts[0].city,
                    forecasts: data.forecasts[0].casts?.slice(0, 3) || [],
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * POI搜索（高德）
     */
    async searchPOI(keyword, city = '郑州') {
        const key = APP_CONFIG.apiKeys.amap;
        if (!key) return null;
        try {
            const url = `${APP_CONFIG.endpoints.amap.base}${APP_CONFIG.endpoints.amap.poiSearch}?key=${key}&keywords=${encodeURIComponent(keyword)}&city=${encodeURIComponent(city)}&offset=5`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === '1' && data.pois) {
                return data.pois.map(p => ({
                    name: p.name,
                    address: p.address,
                    coords: [parseFloat(p.location.split(',')[1]), parseFloat(p.location.split(',')[0])],
                    type: p.type,
                    rating: p.biz_ext?.rating || null,
                }));
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * 地理编码（高德）
     */
    async geocodeAmap(address, city = '郑州') {
        const key = APP_CONFIG.apiKeys.amap;
        if (!key) return null;
        try {
            const url = `${APP_CONFIG.endpoints.amap.base}${APP_CONFIG.endpoints.amap.geocode}?key=${key}&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === '1' && data.geocodes?.length > 0) {
                const loc = data.geocodes[0].location.split(',');
                return {
                    name: data.geocodes[0].formatted_address,
                    coords: [parseFloat(loc[1]), parseFloat(loc[0])],
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    // ==================== 和风天气 API ====================
    async checkQWeather() {
        const key = APP_CONFIG.apiKeys.qweather;
        if (!key) {
            this.setStatus('qweather', 'offline');
            return false;
        }
        try {
            // 郑州LocationID: 101180101
            const url = `${APP_CONFIG.endpoints.qweather.base}${APP_CONFIG.endpoints.qweather.weatherNow}/101180101?key=${key}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.code === '200') {
                this.setStatus('qweather', 'online');
                return true;
            }
            this.setStatus('qweather', 'offline');
            return false;
        } catch {
            this.setStatus('qweather', 'offline');
            return false;
        }
    }

    /**
     * 获取郑州天气（和风天气）
     */
    async getQWeather() {
        const key = APP_CONFIG.apiKeys.qweather;
        if (!key) return null;
        try {
            const url = `${APP_CONFIG.endpoints.qweather.base}${APP_CONFIG.endpoints.qweather.weather3d}/101180101?key=${key}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.code === '200' && data.daily) {
                return {
                    source: '和风天气',
                    forecasts: data.daily.map(d => ({
                        date: d.fxDate,
                        dayweather: d.textDay,
                        nightweather: d.textNight,
                        daytemp: d.tempMax,
                        nighttemp: d.tempMin,
                        wind: d.windDirDay,
                        humidity: d.humidity,
                    })),
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    // ==================== OSM Nominatim（免费地理编码） ====================
    async checkNominatim() {
        try {
            const url = `${APP_CONFIG.endpoints.nominatim.base}${APP_CONFIG.endpoints.nominatim.search}?q=郑州&format=json&limit=1`;
            const res = await fetch(url);
            const data = await res.json();
            if (data?.length > 0) {
                this.setStatus('nominatim', 'online');
                return true;
            }
            this.setStatus('nominatim', 'offline');
            return false;
        } catch {
            this.setStatus('nominatim', 'offline');
            return false;
        }
    }

    /**
     * 地理编码（OSM Nominatim，免费）
     */
    async geocodeNominatim(query) {
        try {
            const url = `${APP_CONFIG.endpoints.nominatim.base}${APP_CONFIG.endpoints.nominatim.search}?q=${encodeURIComponent(query + ' 郑州')}&format=json&limit=1`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'ZhengzhouWeekendPlanner/1.0' }
            });
            const data = await res.json();
            if (data?.length > 0) {
                return {
                    name: data[0].display_name,
                    coords: [parseFloat(data[0].lat), parseFloat(data[0].lon)],
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    // ==================== 并行调用多个天气API ====================
    async getAllWeather() {
        const results = await Promise.allSettled([
            this.getAmapWeather(),
            this.getQWeather(),
        ]);

        const weatherData = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled' && r.value) {
                weatherData.push(r.value);
            }
        });

        return weatherData;
    }

    // ==================== 检查所有API ====================
    async checkAllAPIs() {
        const checks = [
            this.checkAmap(),
            this.checkQWeather(),
            this.checkNominatim(),
        ];
        await Promise.allSettled(checks);
    }
}

// 导出
window.ApiService = ApiService;
