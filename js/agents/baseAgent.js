/**
 * ============================================
 * 多Agent架构 - 基础Agent抽象类
 * ============================================
 */

class BaseAgent {
    constructor(name, type, icon, description) {
        this.id = `agent_${type}_${Date.now()}`;
        this.name = name;
        this.type = type;
        this.icon = icon;
        this.description = description;
        this.status = 'idle';       // idle | working | done | error
        this.progress = 0;
        this.result = null;
        this.error = null;
        this.startTime = null;
        this.endTime = null;
        this.sources = [];          // 数据来源标识
    }

    /**
     * Agent主工作流 - 子类实现
     */
    async execute(context) {
        throw new Error('子类必须实现 execute() 方法');
    }

    /**
     * 运行Agent（含状态管理）
     */
    async run(context) {
        this.status = 'working';
        this.progress = 10;
        this.startTime = Date.now();
        this.sources = [];

        try {
            this.progress = 30;
            const result = await this.execute(context);
            this.progress = 90;
            this.result = result;
            this.status = 'done';
            this.progress = 100;
        } catch (err) {
            this.status = 'error';
            this.error = err.message;
            this.progress = 0;
            console.error(`[${this.name}] 执行失败:`, err);
        }

        this.endTime = Date.now();
        return this;
    }

    /**
     * 获取耗时(ms)
     */
    get duration() {
        if (!this.startTime) return 0;
        return (this.endTime || Date.now()) - this.startTime;
    }

    /**
     * 获取结果摘要
     */
    getSummary() {
        return {
            agent: this.name,
            type: this.type,
            icon: this.icon,
            status: this.status,
            sources: this.sources,
            duration: this.duration,
            dataCount: this.result ? (Array.isArray(this.result) ? this.result.length : 1) : 0,
            error: this.error,
        };
    }
}

window.BaseAgent = BaseAgent;
