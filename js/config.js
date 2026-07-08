/**
 * ============================================
 * 郑州周末出行助手 - 全局配置
 * ============================================
 * API密钥通过UI配置保存到localStorage
 */

const APP_CONFIG = {
    // 应用信息
    appName: '郑州周末出行助手',
    version: '1.0.0',

    // 郑州中心坐标
    zhengzhouCenter: [34.757, 113.665],
    zhengzhouZoom: 11,

    // 高德地图瓦片（无需Key即可使用栅格瓦片）
    amapTileUrl: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    amapSubdomains: ['1', '2', '3', '4'],

    // API端点
    endpoints: {
        // 高德地图Web API
        amap: {
            base: 'https://restapi.amap.com/v3',
            weather: '/weather/weatherInfo',
            poiSearch: '/place/text',
            poiAround: '/place/around',
            geocode: '/geocode/geo',
            regeo: '/geocode/regeo',
            direction: '/direction/driving',
            ip: '/ip',
        },
        // 和风天气API
        qweather: {
            base: 'https://devapi.qweather.com/v7',
            weatherNow: '/weather/now',
            weather3d: '/weather/3d',
            air: '/air/now',
            geoLookup: '/geo/city/lookup',
        },
        // OpenStreetMap Nominatim（免费，无需Key，有限速）
        nominatim: {
            base: 'https://nominatim.openstreetmap.org',
            search: '/search',
            reverse: '/reverse',
        },
    },

    // 默认API Key（从localStorage加载）
    get apiKeys() {
        try {
            const saved = localStorage.getItem('zz_planner_config');
            return saved ? JSON.parse(saved) : {
                amap: '',
                qweather: '',
                llmUrl: '',
                llmKey: '',
                llmModel: '',
            };
        } catch {
            return {
                amap: '',
                qweather: '',
                llmUrl: '',
                llmKey: '',
                llmModel: '',
            };
        }
    },

    saveApiKeys(config) {
        localStorage.setItem('zz_planner_config', JSON.stringify(config));
    },

    // 场景配置
    scenarios: {
        family: { name: '家人出游', icon: '👨‍👩‍👧‍👦', color: '#10b981' },
        friends: { name: '朋友结伴', icon: '👫', color: '#3b82f6' },
        couple: { name: '恋人约会', icon: '💑', color: '#ec4899' },
        solo: { name: '单人漫游', icon: '🧑‍🎒', color: '#8b5cf6' },
    },

    // 郑州行政区划
    zhengzhouDistricts: [
        '中原区', '二七区', '管城回族区', '金水区', '上街区',
        '惠济区', '巩义市', '荥阳市', '新密市', '新郑市',
        '登封市', '中牟县'
    ],

    // 行程标记颜色
    markerColors: ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'],
};
