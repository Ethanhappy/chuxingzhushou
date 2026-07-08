/**
 * ============================================
 * 郑州周末出行助手 - 郑州真实地点数据
 * ============================================
 * 所有坐标均来自高德地图/百度地图真实坐标
 * 所有描述基于真实景点信息
 */

const ZhengzhouData = {
    // ==================== 地点库 ====================
    places: {
        // --- 自然景观 ---
        huanghe: {
            id: 'huanghe',
            name: '黄河风景名胜区',
            address: '郑州市惠济区江山路黄河南岸1号',
            coords: [34.9041, 113.5299],
            category: '自然景观',
            rating: 4.5,
            price: '60元/人',
            hours: '08:00-18:00',
            duration: '4-5小时',
            description: '国家AAAA级旅游景区，位于郑州西北20公里处黄河之滨。可近距离感受母亲河的壮阔，登临极目阁俯瞰黄河，参观炎黄二帝巨型塑像，游览黄河地质博物馆。',
            tags: ['黄河', '自然风光', '历史人文', 'AAAA景区'],
            suitable: ['family', 'friends', 'solo'],
        },
        shaolin: {
            id: 'shaolin',
            name: '嵩山少林寺',
            address: '郑州市登封市嵩山五乳峰下',
            coords: [34.5090, 112.9401],
            category: '人文古迹',
            rating: 4.8,
            price: '80元/人',
            hours: '08:00-17:00',
            duration: '全天',
            description: '中国佛教禅宗祖庭和中国功夫发源地，世界文化遗产。可观看少林武僧表演，参观塔林、初祖庵、达摩洞等古迹，感受千年古刹的庄严与武术文化。',
            tags: ['世界遗产', '少林功夫', '佛教文化', 'AAAAA景区', '必去'],
            suitable: ['family', 'friends', 'couple', 'solo'],
        },
        songshan: {
            id: 'songshan',
            name: '嵩山风景名胜区',
            address: '郑州市登封市中岳大街',
            coords: [34.5167, 113.0198],
            category: '自然景观',
            rating: 4.6,
            price: '100元/人(通票)',
            hours: '08:00-17:30',
            duration: '5-6小时',
            description: '五岳之中岳，联合国世界地质公园。太室山和少室山两山对峙，峰峦叠嶂，气势磅礴。登山步道完善，适合不同体力等级的游客。',
            tags: ['五岳', '登山', '世界地质公园', '自然风光'],
            suitable: ['friends', 'solo'],
        },

        // --- 主题乐园 ---
        fangte: {
            id: 'fangte',
            name: '郑州方特欢乐世界',
            address: '郑州市中牟县郑开大道与人文路交汇处',
            coords: [34.8261, 113.8675],
            category: '主题乐园',
            rating: 4.4,
            price: '260元/人',
            hours: '09:30-17:30(平日) / 09:00-18:00(周末)',
            duration: '全天',
            description: '大型高科技主题乐园，拥有20多个大型主题项目区。飞越极限、恐龙危机、海螺湾等经典项目适合全家游玩。周末人流量较大，建议早到。',
            tags: ['主题乐园', '亲子', '刺激', '高科技'],
            suitable: ['family', 'friends'],
        },
        ocean: {
            id: 'ocean',
            name: '郑州海洋馆',
            address: '郑州市金水区国基路与中方园路交叉口',
            coords: [34.7993, 113.6434],
            category: '主题场馆',
            rating: 4.2,
            price: '160元/人(成人) / 100元/人(儿童)',
            hours: '09:00-17:30',
            duration: '3-4小时',
            description: '中原地区最大的海洋主题场馆之一，拥有海底隧道、海豚表演、企鹅馆、水母宫等多个展区。适合带孩子近距离接触海洋生物。',
            tags: ['海洋生物', '亲子', '表演', '室内'],
            suitable: ['family', 'couple'],
        },
        zoo: {
            id: 'zoo',
            name: '郑州市动物园',
            address: '郑州市金水区花园路103号',
            coords: [34.7717, 113.6837],
            category: '主题场馆',
            rating: 4.0,
            price: '30元/人',
            hours: '08:00-18:00(夏季) / 08:00-17:00(冬季)',
            duration: '3-4小时',
            description: '位于市中心的大型动物园，有大熊猫、东北虎、金丝猴等200多种动物。园内绿树成荫，适合散步游览。性价比极高。',
            tags: ['动物园', '亲子', '性价比', '市区'],
            suitable: ['family', 'couple', 'solo'],
        },

        // --- 文化历史 ---
        bowuguan: {
            id: 'bowuguan',
            name: '河南博物院',
            address: '郑州市金水区农业路8号',
            coords: [34.7918, 113.6623],
            category: '博物馆',
            rating: 4.7,
            price: '免费(需预约)',
            hours: '09:00-17:30(周二至周日)',
            duration: '3-4小时',
            description: '国家级重点博物馆，馆藏文物17万余件。贾湖骨笛、妇好鸮尊、云纹铜禁等镇馆之宝令人叹为观止。是了解河南厚重历史文化的最佳窗口。',
            tags: ['博物馆', '历史文化', '免费', '必去', '室内'],
            suitable: ['family', 'friends', 'couple', 'solo'],
        },
        erqi: {
            id: 'erqi',
            name: '二七纪念塔',
            address: '郑州市二七区二七广场',
            coords: [34.7547, 113.6656],
            category: '历史建筑',
            rating: 4.3,
            price: '免费',
            hours: '全天(外景) / 09:00-17:00(登塔)',
            duration: '1小时',
            description: '郑州地标性建筑，为纪念1923年二七大罢工而建。双塔合璧的独特造型是郑州城市名片。周边是繁华的二七商圈和德化步行街。',
            tags: ['地标', '历史', '免费', '市中心'],
            suitable: ['family', 'friends', 'couple', 'solo'],
        },
        shangcheng: {
            id: 'shangcheng',
            name: '郑州商城遗址',
            address: '郑州市管城回族区城东路',
            coords: [34.7491, 113.6787],
            category: '历史遗址',
            rating: 4.1,
            price: '免费',
            hours: '全天',
            duration: '1-2小时',
            description: '商代早期都城遗址，距今约3600年历史。郑州作为"中国八大古都"之一的重要实证。城墙遗址公园适合散步、怀古，感受千年帝都遗韵。',
            tags: ['遗址', '古都', '免费', '历史'],
            suitable: ['friends', 'solo'],
        },

        // --- 城市休闲 ---
        ruyihu: {
            id: 'ruyihu',
            name: '如意湖 & CBD',
            address: '郑州市郑东新区CBD',
            coords: [34.7767, 113.7309],
            category: '城市休闲',
            rating: 4.5,
            price: '免费',
            hours: '全天',
            duration: '2-3小时',
            description: '郑东新区核心景观，环湖步道优美，夜景尤其迷人。河南艺术中心(大金蛋)、千玺广场等地标建筑环绕。适合散步、拍照、骑行。',
            tags: ['城市景观', '夜景', '免费', '拍照', '骑行'],
            suitable: ['couple', 'friends', 'family', 'solo'],
        },
        forest: {
            id: 'forest',
            name: '郑州之林(森林公园)',
            address: '郑州市郑东新区龙湖外环路',
            coords: [34.8021, 113.7134],
            category: '城市公园',
            rating: 4.3,
            price: '免费',
            hours: '全天',
            duration: '2-3小时',
            description: '城市中的天然氧吧，大片森林和草坪，适合野餐、放风筝、亲子活动。春秋两季景色尤为宜人。',
            tags: ['公园', '野餐', '亲子', '免费', '自然'],
            suitable: ['family', 'couple', 'solo'],
        },
        futa: {
            id: 'futa',
            name: '中原福塔',
            address: '郑州市管城回族区航海东路',
            coords: [34.7278, 113.7288],
            category: '城市地标',
            rating: 4.1,
            price: '98元/人',
            hours: '09:30-21:00',
            duration: '2小时',
            description: '高388米，是世界最高的全钢结构塔。塔顶观景台可360度俯瞰郑州全景，高空玻璃栈道惊险刺激。夜景观赏效果极佳。',
            tags: ['地标', '观景', '高空', '夜景'],
            suitable: ['couple', 'friends', 'family'],
        },
        dehua: {
            id: 'dehua',
            name: '德化步行街',
            address: '郑州市二七区德化街',
            coords: [34.7557, 113.6676],
            category: '购物美食',
            rating: 4.0,
            price: '免费(购物另计)',
            hours: '全天(商铺10:00-22:00)',
            duration: '2-3小时',
            description: '郑州最繁华的商业步行街，汇集各类品牌店、小吃摊、老字号。紧邻二七广场，是感受郑州市井生活的绝佳去处。',
            tags: ['购物', '美食', '步行街', '夜生活'],
            suitable: ['friends', 'couple', 'solo'],
        },
        longzihu: {
            id: 'longzihu',
            name: '龙子湖公园',
            address: '郑州市郑东新区龙子湖高校园区',
            coords: [34.7934, 113.8032],
            category: '城市公园',
            rating: 4.3,
            price: '免费',
            hours: '全天',
            duration: '2-3小时',
            description: '郑东新区最大的城市湖泊公园，环湖绿道约12公里。周边环绕15所高校，青春气息浓厚。适合骑行、散步、野餐、拍照，春夏季湖面荷花盛开，景色宜人。',
            tags: ['公园', '湖泊', '骑行', '免费', '自然', '拍照'],
            suitable: ['family', 'friends', 'couple', 'solo'],
        },
        zhiwuyuan: {
            id: 'zhiwuyuan',
            name: '郑州植物园',
            address: '郑州市中原区中原西路',
            coords: [34.7209, 113.5599],
            category: '城市公园',
            rating: 4.2,
            price: '10元/人',
            hours: '07:00-18:00',
            duration: '2-3小时',
            description: '植物种类丰富，四季有花。温室展览馆内有热带植物区、沙漠植物区等。春季樱花、郁金香盛开时尤为美丽。适合亲子自然教育。',
            tags: ['植物', '亲子', '四季', '科普'],
            suitable: ['family', 'couple', 'solo'],
        },

        // --- 美食餐饮 ---
        xiaochijie: {
            id: 'xiaochijie',
            name: '郑州美食街(健康路)',
            address: '郑州市金水区健康路',
            coords: [34.7756, 113.6698],
            category: '美食',
            rating: 4.3,
            price: '人均30-80元',
            hours: '17:00-凌晨02:00',
            duration: '1-2小时',
            description: '郑州最有名的夜市美食街之一。胡辣汤、烩面、羊肉串、炒凉粉等地道郑州美食一应俱全。晚上人声鼎沸，烟火气十足。',
            tags: ['夜市', '美食', '本地特色', '烟火气'],
            suitable: ['friends', 'couple', 'solo'],
        },
        huimian: {
            id: 'huimian',
            name: '萧记三鲜烩面美食城',
            address: '郑州市金水区经三路',
            coords: [34.7789, 113.6856],
            category: '美食',
            rating: 4.4,
            price: '人均40-60元',
            hours: '10:00-22:00',
            duration: '1小时',
            description: '郑州老字号烩面馆，始创于1986年。三鲜烩面是招牌，汤鲜味浓，面条筋道。来郑州必尝的地道美食。',
            tags: ['老字号', '烩面', '必吃', '郑州味道'],
            suitable: ['family', 'friends', 'couple', 'solo'],
        },
        hulatang: {
            id: 'hulatang',
            name: '方中山胡辣汤(总店)',
            address: '郑州市金水区顺河路',
            coords: [34.7631, 113.6792],
            category: '美食',
            rating: 4.5,
            price: '人均15-25元',
            hours: '06:00-13:00',
            duration: '30分钟',
            description: '郑州最正宗的胡辣汤之一，每天清晨排长队。汤味醇厚，料足味美，配上一根油条或水煎包，是郑州人的标准早餐。',
            tags: ['早餐', '胡辣汤', '老字号', '必吃'],
            suitable: ['family', 'friends', 'couple', 'solo'],
        },
    },

    // ==================== 周末行程计划 ====================
    plans: {
        family: {
            title: '郑州亲子周末 · 两天一夜欢乐行',
            description: '寓教于乐的亲子时光，兼顾孩子兴趣和大人放松',
            days: [
                {
                    day: 1,
                    label: '第一天 · 欢乐探索',
                    items: [
                        {
                            placeId: 'fangte',
                            time: '09:00 - 17:00',
                            tip: '建议自带午餐零食，园区内餐饮价格偏高。优先游玩热门项目避免排队。',
                            order: 1,
                        },
                        {
                            placeId: 'xiaochijie',
                            time: '18:00 - 20:00',
                            tip: '从方特返回市区约40分钟车程，可在此解决晚餐。',
                            order: 2,
                        },
                    ],
                },
                {
                    day: 2,
                    label: '第二天 · 自然探索',
                    items: [
                        {
                            placeId: 'zoo',
                            time: '09:00 - 12:00',
                            tip: '早上动物最活跃，是观看的好时机。园内有儿童游乐区。',
                            order: 1,
                        },
                        {
                            placeId: 'zhiwuyuan',
                            time: '14:00 - 16:30',
                            tip: '下午阳光好适合拍照，温室馆不要错过。',
                            order: 2,
                        },
                    ],
                },
            ],
        },

        friends: {
            title: '郑州好友周末 · 两天一夜探索之旅',
            description: '人文景观+城市探索+美食打卡，和朋友一起解锁郑州',
            days: [
                {
                    day: 1,
                    label: '第一天 · 少林传奇',
                    items: [
                        {
                            placeId: 'shaolin',
                            time: '08:00 - 16:00',
                            tip: '从郑州自驾约1.5小时到达。武僧表演场次：10:00/11:00/14:00/15:00，建议提前占座。',
                            order: 1,
                        },
                        {
                            placeId: 'xiaochijie',
                            time: '18:30 - 21:00',
                            tip: '返回郑州后直奔夜市，打卡郑州地道小吃。推荐：炒凉粉、涮牛肚、杏仁茶。',
                            order: 2,
                        },
                    ],
                },
                {
                    day: 2,
                    label: '第二天 · 城市印记',
                    items: [
                        {
                            placeId: 'hulatang',
                            time: '08:00 - 09:00',
                            tip: '体验郑州人的早餐文化，一碗胡辣汤唤醒一天的活力。',
                            order: 1,
                        },
                        {
                            placeId: 'bowuguan',
                            time: '09:30 - 12:30',
                            tip: '提前在公众号预约。重点看四大镇馆之宝。',
                            order: 2,
                        },
                        {
                            placeId: 'erqi',
                            time: '14:00 - 16:00',
                            tip: '登塔眺望郑州全景，随后逛德化步行街。',
                            order: 3,
                        },
                        {
                            placeId: 'dehua',
                            time: '16:00 - 18:00',
                            tip: '逛街购物，感受郑州最繁华商圈的热闹。',
                            order: 4,
                        },
                    ],
                },
            ],
        },

        couple: {
            title: '郑州浪漫周末 · 两天一夜甜蜜行',
            description: '城市漫步、湖畔时光、高空观景，打造专属浪漫回忆',
            days: [
                {
                    day: 1,
                    label: '第一天 · 城市浪漫',
                    items: [
                        {
                            placeId: 'ruyihu',
                            time: '09:30 - 11:30',
                            tip: '上午阳光正好，沿湖散步拍照。河南艺术中心前是最佳拍照点。',
                            order: 1,
                        },
                        {
                            placeId: 'zhiwuyuan',
                            time: '14:00 - 16:00',
                            tip: '花海中漫步，温室馆的仙人掌区很适合拍文艺照片。',
                            order: 2,
                        },
                        {
                            placeId: 'futa',
                            time: '17:00 - 19:30',
                            tip: '傍晚登塔，看日落和城市华灯初上，是郑州最浪漫的夜景体验。',
                            order: 3,
                        },
                        {
                            placeId: 'huimian',
                            time: '20:00 - 21:00',
                            tip: '环境不错的老字号，一碗热烩面暖胃又暖心。',
                            order: 4,
                        },
                    ],
                },
                {
                    day: 2,
                    label: '第二天 · 自然时光',
                    items: [
                        {
                            placeId: 'forest',
                            time: '09:30 - 12:00',
                            tip: '带上野餐垫和零食，在大草坪上享受二人世界。可以租双人自行车。',
                            order: 1,
                        },
                        {
                            placeId: 'ocean',
                            time: '14:00 - 16:30',
                            tip: '海底隧道和水母馆是拍照胜地。海豚表演在14:30。',
                            order: 2,
                        },
                    ],
                },
            ],
        },

        solo: {
            title: '郑州独行周末 · 两天一夜深度游',
            description: '一个人也能很精彩，用脚步丈量千年商都',
            days: [
                {
                    day: 1,
                    label: '第一天 · 文化寻踪',
                    items: [
                        {
                            placeId: 'hulatang',
                            time: '07:30 - 08:30',
                            tip: '早起一碗胡辣汤，开启元气满满的一天。',
                            order: 1,
                        },
                        {
                            placeId: 'bowuguan',
                            time: '09:00 - 12:30',
                            tip: '一个人可以慢慢看，租个讲解器细细品味每件文物背后的故事。',
                            order: 2,
                        },
                        {
                            placeId: 'shangcheng',
                            time: '14:00 - 15:30',
                            tip: '3600年前的商代城墙，静心感受历史的厚重。附近有不错的独立咖啡馆。',
                            order: 3,
                        },
                        {
                            placeId: 'ruyihu',
                            time: '16:30 - 19:00',
                            tip: '环湖慢跑或散步，看着从黄昏到华灯初上，感受郑州的现代与活力。',
                            order: 4,
                        },
                    ],
                },
                {
                    day: 2,
                    label: '第二天 · 山河壮阔',
                    items: [
                        {
                            placeId: 'huanghe',
                            time: '08:30 - 12:30',
                            tip: '乘坐公交车或打车前往，看黄河的波澜壮阔，在炎黄广场感受民族之魂。',
                            order: 1,
                        },
                        {
                            placeId: 'huimian',
                            time: '13:30 - 14:30',
                            tip: '返回市区后来一碗地道烩面，补充体力。',
                            order: 2,
                        },
                        {
                            placeId: 'dehua',
                            time: '15:00 - 17:00',
                            tip: '闲逛老街，搜罗小物件，在书店或咖啡馆度过悠闲的下午。',
                            order: 3,
                        },
                    ],
                },
            ],
        },
    },

    // ==================== 获取行程数据 ====================
    getPlan(scenario) {
        const plan = this.plans[scenario];
        if (!plan) return null;

        // 将placeId替换为完整地点数据
        const enrichedPlan = {
            ...plan,
            days: plan.days.map(day => ({
                ...day,
                items: day.items.map(item => ({
                    ...item,
                    place: this.places[item.placeId] || null,
                })),
            })),
        };

        return enrichedPlan;
    },

    // 获取所有地点坐标(用于地图展示)
    getAllCoords(scenario) {
        const plan = this.plans[scenario];
        if (!plan) return [];

        const coords = [];
        plan.days.forEach(day => {
            day.items.forEach(item => {
                const place = this.places[item.placeId];
                if (place) {
                    coords.push({
                        name: place.name,
                        coords: place.coords,
                        day: day.day,
                        order: item.order,
                        color: APP_CONFIG.markerColors[day.day - 1] || APP_CONFIG.markerColors[0],
                    });
                }
            });
        });
        return coords;
    },
};

// 导出到全局
window.ZhengzhouData = ZhengzhouData;
