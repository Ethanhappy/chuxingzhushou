/**
 * ============================================
 * 郑州周末出行助手 - Leaflet + 高德地图服务
 * ============================================
 */

class MapService {
    constructor() {
        this.map = null;
        this.markers = [];
        this.routeLayer = null;
        this.tileLayer = null;
        this.initialized = false;
    }

    /**
     * 初始化地图
     */
    init(containerId = 'map') {
        if (this.initialized) return;

        // 高德地图瓦片图层
        this.tileLayer = L.tileLayer(APP_CONFIG.amapTileUrl, {
            subdomains: APP_CONFIG.amapSubdomains,
            attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>',
            maxZoom: 18,
            minZoom: 3,
        });

        // 创建地图实例
        this.map = L.map(containerId, {
            center: APP_CONFIG.zhengzhouCenter,
            zoom: APP_CONFIG.zhengzhouZoom,
            zoomControl: true,
            attributionControl: true,
        });

        this.tileLayer.addTo(this.map);

        // 添加比例尺
        L.control.scale({
            metric: true,
            imperial: false,
            position: 'bottomleft',
        }).addTo(this.map);

        this.initialized = true;

        // 延迟刷新解决容器尺寸问题
        setTimeout(() => this.map.invalidateSize(), 100);
    }

    /**
     * 刷新地图尺寸
     */
    refresh() {
        if (this.map) {
            setTimeout(() => this.map.invalidateSize(), 50);
        }
    }

    /**
     * 清除所有标记
     */
    clearMarkers() {
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
    }

    /**
     * 添加地点标记
     */
    addMarker(place, index, color = '#6366f1') {
        if (!this.map) return;

        const numberIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="custom-marker" style="background:${color}">${index + 1}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -20],
        });

        const popupContent = `
            <div style="font-family: 'PingFang SC','Microsoft YaHei',sans-serif; min-width:180px;">
                <strong style="font-size:14px; color:#333;">${place.name}</strong>
                <p style="margin:4px 0; font-size:12px; color:#666;">📍 ${place.address || ''}</p>
                ${place.description ? `<p style="margin:4px 0; font-size:11px; color:#888;">${place.description.substring(0, 60)}...</p>` : ''}
            </div>
        `;

        const marker = L.marker(place.coords, { icon: numberIcon })
            .bindPopup(popupContent)
            .addTo(this.map);

        this.markers.push(marker);
        return marker;
    }

    /**
     * 添加多个标记并自动调整视野
     */
    addMarkers(locations) {
        this.clearMarkers();

        if (!locations || locations.length === 0) return;

        const bounds = [];
        locations.forEach((loc, i) => {
            this.addMarker(loc, i, loc.color || APP_CONFIG.markerColors[i % APP_CONFIG.markerColors.length]);
            bounds.push(loc.coords);
        });

        // 调整地图视野以包含所有标记
        if (bounds.length > 1) {
            this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } else {
            this.map.setView(bounds[0], 15);
        }
    }

    /**
     * 绘制路线（多线段）
     */
    drawRoute(coordsList) {
        if (!this.map || coordsList.length < 2) return;

        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        this.routeLayer = L.polyline(coordsList, {
            color: '#6366f1',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 6',
            lineJoin: 'round',
        }).addTo(this.map);
    }

    /**
     * 高亮某个标记
     */
    highlightMarker(index) {
        if (index >= 0 && index < this.markers.length) {
            const marker = this.markers[index];
            marker.openPopup();
            this.map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
        }
    }

    /**
     * 按天分层显示路线
     */
    showPlanOnMap(plan) {
        this.clearMarkers();

        if (!plan || !plan.days) return;

        const allLocations = [];

        plan.days.forEach(day => {
            day.items.forEach(item => {
                if (item.place?.coords) {
                    const globalIdx = allLocations.length; // ★ 全局索引，用于 marker 编号
                    const color = APP_CONFIG.markerColors[globalIdx % APP_CONFIG.markerColors.length];
                    const loc = {
                        name: item.place.name,
                        coords: item.place.coords,
                        address: item.place.address,
                        description: item.place.description,
                        color: color,
                        day: day.day,
                        order: item.order,
                    };
                    allLocations.push(loc);
                }
            });
        });

        // 添加所有标记
        this.addMarkers(allLocations);

        // 绘制路线
        const routeCoords = allLocations.map(l => l.coords);
        this.drawRoute(routeCoords);
    }

    /**
     * 销毁地图
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.markers = [];
            this.routeLayer = null;
            this.initialized = false;
        }
    }
}

// 导出
window.MapService = MapService;
