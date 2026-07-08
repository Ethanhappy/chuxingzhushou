/**
 * ============================================
 * Agent 1 - 天气情报Agent 🌤️
 * 职责：多数据源天气采集、交叉验证、出行建议
 * 数据源：高德天气 + 和风天气 + 本地规则推断
 * ============================================
 */

class WeatherAgent extends BaseAgent {
    constructor(apiService) {
        super('天气情报Agent', 'weather', '🌤️', '多源天气采集与出行气象建议');
        this.apiService = apiService;
    }

    async execute(context) {
        const results = {
            forecasts: [],
            recommendation: '',
            warnings: [],
            confidence: 0,
        };

        // ---- 数据源1：高德天气 ----
        this.progress = 35;
        try {
            const amapData = await this.apiService.getAmapWeather();
            if (amapData) {
                results.forecasts.push({
                    source: '高德地图',
                    data: amapData.forecasts,
                    raw: amapData,
                    priority: 1,
                });
                this.sources.push('高德地图天气API');
            }
        } catch (e) {
            console.warn('[天气Agent] 高德天气获取失败:', e.message);
        }

        // ---- 数据源2：和风天气 ----
        this.progress = 60;
        try {
            const qwData = await this.apiService.getQWeather();
            if (qwData) {
                results.forecasts.push({
                    source: '和风天气',
                    data: qwData.forecasts,
                    raw: qwData,
                    priority: 2,
                });
                this.sources.push('和风天气API');
            }
        } catch (e) {
            console.warn('[天气Agent] 和风天气获取失败:', e.message);
        }

        // ---- 数据源3：本地规则推断（基于季节+郑州气候特征） ----
        this.progress = 80;
        const localForecast = this._localWeatherInference();
        if (localForecast) {
            results.forecasts.push({
                source: '本地气候模型',
                data: [localForecast],
                raw: null,
                priority: 3,
            });
            this.sources.push('本地气候模型(季节推断)');
        }

        // ---- 交叉验证与合并 ----
        this.progress = 90;
        if (results.forecasts.length >= 2) {
            results.confidence = 85;
            results.recommendation = this._crossValidate(results.forecasts);
        } else if (results.forecasts.length === 1) {
            results.confidence = 60;
            results.recommendation = this._singleSourceAdvice(results.forecasts[0]);
        } else {
            results.confidence = 30;
            results.recommendation = '暂无实时天气数据，建议出行前查看天气预报';
            results.warnings.push('天气数据全部获取失败，请手动确认天气');
        }

        // ---- 出行天气建议 ----
        results.warnings = results.warnings.concat(this._generateWarnings(results));

        return results;
    }

    /**
     * 本地气候推断（基于月份和郑州气候）
     */
    _localWeatherInference() {
        const now = new Date();
        const month = now.getMonth() + 1;

        const seasonalData = {
            // 春季(3-5月)
            3: { dayweather: '多云', tempMax: 15, tempMin: 5, humidity: 55, wind: '东北风' },
            4: { dayweather: '晴', tempMax: 22, tempMin: 11, humidity: 50, wind: '南风' },
            5: { dayweather: '晴', tempMax: 28, tempMin: 17, humidity: 55, wind: '南风' },
            // 夏季(6-8月)
            6: { dayweather: '多云', tempMax: 33, tempMin: 22, humidity: 65, wind: '南风' },
            7: { dayweather: '雷阵雨', tempMax: 32, tempMin: 24, humidity: 75, wind: '南风' },
            8: { dayweather: '多云', tempMax: 31, tempMin: 23, humidity: 72, wind: '东南风' },
            // 秋季(9-11月)
            9: { dayweather: '晴', tempMax: 27, tempMin: 17, humidity: 60, wind: '东北风' },
            10: { dayweather: '晴', tempMax: 21, tempMin: 11, humidity: 55, wind: '北风' },
            11: { dayweather: '多云', tempMax: 13, tempMin: 3, humidity: 50, wind: '北风' },
            // 冬季(12-2月)
            12: { dayweather: '晴', tempMax: 7, tempMin: -3, humidity: 40, wind: '北风' },
            1: { dayweather: '多云', tempMax: 5, tempMin: -4, humidity: 38, wind: '北风' },
            2: { dayweather: '多云', tempMax: 9, tempMin: -1, humidity: 42, wind: '东北风' },
        };

        const data = seasonalData[month] || seasonalData[7];
        return {
            date: `${now.getFullYear()}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
            dayweather: data.dayweather,
            nightweather: data.dayweather,
            daytemp: data.tempMax,
            nighttemp: data.tempMin,
            humidity: data.humidity,
            wind: data.wind,
            source: 'local_model',
        };
    }

    /**
     * 交叉验证多源天气数据
     */
    _crossValidate(forecasts) {
        const temps = [];
        const weathers = [];

        forecasts.forEach(f => {
            if (f.data && f.data[0]) {
                const d = f.data[0];
                if (d.daytemp) temps.push(Number(d.daytemp));
                if (d.dayweather) weathers.push(d.dayweather);
            }
        });

        const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : 25;
        const commonWeather = this._mostFrequent(weathers) || '多云';

        if (forecasts.length >= 2) {
            const tempDiff = Math.abs((temps[0] || 0) - (temps[1] || 0));
            if (tempDiff <= 2) {
                return `多源天气数据一致(温差≤2°C)，${commonWeather}，约${avgTemp}°C，适宜出行`;
            }
        }

        return `${commonWeather}，约${avgTemp}°C，数据源存在一定差异，建议参考主流天气预报`;
    }

    _singleSourceAdvice(forecast) {
        const d = forecast.data?.[0];
        if (!d) return '单数据源，天气信息仅供参考';
        return `${d.dayweather}，${d.daytemp}°C ~ ${d.nighttemp}°C（来源：${forecast.source}）`;
    }

    _mostFrequent(arr) {
        if (!arr.length) return null;
        const map = {};
        arr.forEach(v => { map[v] = (map[v] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
    }

    /**
     * 生成天气预警
     */
    _generateWarnings(results) {
        const warnings = [];
        const forecasts = results.forecasts;

        forecasts.forEach(f => {
            const d = f.data?.[0];
            if (!d) return;

            const temp = Number(d.daytemp || d.tempMax || 25);
            const weather = d.dayweather || d.textDay || '';

            if (temp > 35) warnings.push('⚠️ 高温预警：注意防暑，多备饮用水');
            else if (temp < 5) warnings.push('⚠️ 低温提示：注意保暖，穿着厚外套');
            else if (temp > 30) warnings.push('💡 天气较热，建议避开正午户外活动');

            if (weather.includes('雨') || weather.includes('雷')) {
                warnings.push('🌧️ 有降雨可能，建议携带雨具，优先安排室内景点');
            }
            if (weather.includes('风') && !weather.includes('微风')) {
                warnings.push('💨 风力较大，户外活动请注意安全');
            }

            if (Number(d.humidity) > 80) {
                warnings.push('💧 湿度较高，体感闷热，注意补充水分');
            }
        });

        return warnings;
    }
}

window.WeatherAgent = WeatherAgent;
