const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 3000;
const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};

/**
 * 转发 LLM 请求到外部 API（绕过浏览器 CORS）
 */
function proxyLLMRequest(targetUrl, apiKey, bodyJson) {
    return new Promise((resolve, reject) => {
        const url = new URL(targetUrl);
        // 支持 http 和 https
        const mod = url.protocol === 'https:' ? https : http;

        const payload = JSON.stringify(bodyJson);

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            timeout: 65000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            },
        };

        console.log(`[LLM Proxy] → ${targetUrl}`);
        console.log(`[LLM Proxy] Model: ${bodyJson.model}`);

        const req = mod.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[LLM Proxy] ← HTTP ${res.statusCode}`);
                // 非 200 时打印响应体便于排查
                if (res.statusCode !== 200) {
                    console.log(`[LLM Proxy] ← Body: ${data.substring(0, 500)}`);
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data,
                });
            });
        });

        req.on('error', err => {
            console.error(`[LLM Proxy] ✗ 网络错误: ${err.message} (code: ${err.code || 'N/A'})`);
            reject(err);
        });
        req.on('timeout', () => {
            req.destroy();
            console.error(`[LLM Proxy] ✗ 请求超时 (65s)`);
            reject(new Error('请求超时'));
        });

        req.write(payload);
        req.end();
    });
}

http.createServer((req, res) => {
    // ==================== API 代理: LLM ====================
    if (req.url === '/api/proxy/llm' && req.method === 'POST') {
        let rawBody = '';
        req.on('data', chunk => rawBody += chunk);
        req.on('end', async () => {
            try {
                const { targetUrl, apiKey, body } = JSON.parse(rawBody);

                if (!targetUrl || !apiKey) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '缺少 targetUrl 或 apiKey' }));
                    return;
                }

                const fullUrl = targetUrl.replace(/\/+$/, '') + '/chat/completions';
                const result = await proxyLLMRequest(fullUrl, apiKey, body);

                res.writeHead(result.status, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                });
                res.end(result.body);
            } catch (err) {
                console.error('[Proxy LLM Error]', err.message);
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: '代理请求失败',
                    detail: err.message,
                }));
            }
        });
        return;
    }

    // ==================== API 代理: 高德 & 和风天气 ====================
    if (req.url.startsWith('/api/proxy/') && req.method === 'GET') {
        let rawBody = '';
        req.on('data', chunk => rawBody += chunk);
        req.on('end', () => {
            try {
                const { query } = require('url').parse(req.url, true);
                const targetUrl = query.url;
                if (!targetUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '缺少 url 参数' }));
                    return;
                }

                const url = new URL(targetUrl);
                const mod = url.protocol === 'https:' ? https : http;

                mod.get(targetUrl, (proxyRes) => {
                    let data = '';
                    proxyRes.on('data', chunk => data += chunk);
                    proxyRes.on('end', () => {
                        res.writeHead(proxyRes.statusCode, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        });
                        res.end(data);
                    });
                }).on('error', (err) => {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // ==================== CORS 预检 ====================
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
    }

    // ==================== 静态文件 ====================
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // 剥离查询参数
    filePath = filePath.split('?')[0];
    filePath = path.join(__dirname, filePath);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
            res.end(data);
        }
    });
}).listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📡 LLM proxy ready at /api/proxy/llm`);
});
