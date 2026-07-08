/**
 * 独立测试脚本 - 直接测试 DeepSeek API 连通性
 * 用法: node test_api.js
 * 
 * 请在下方填入你的配置
 */

const API_URL = 'https://api.deepseek.com/v1';
const API_KEY = ' ';  // ← 填你的 Key
const MODEL = 'deepseek-v4-pro';

// ========== 无需修改以下代码 ==========
const https = require('https');

if (!API_KEY) {
    console.log('❌ 请先编辑 test_api.js，在第 10 行填入你的 API Key');
    process.exit(1);
}

console.log('========================================');
console.log('🔍 DeepSeek API 连通性测试');
console.log('========================================');
console.log(`URL:   ${API_URL}/chat/completions`);
console.log(`Model: ${MODEL}`);
console.log(`Key:   ***（已隐藏，避免日志泄露）`);
console.log('----------------------------------------');
console.log('⏳ 发送测试请求...\n');

const payload = JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 5,
});

const url = new URL(API_URL + '/chat/completions');

const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
    },
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`📡 HTTP 状态码: ${res.statusCode}`);
        console.log(`📋 响应头: ${JSON.stringify(res.headers, null, 2)}\n`);
        
        try {
            const json = JSON.parse(data);
            console.log('📦 响应体:');
            console.log(JSON.stringify(json, null, 2));
            
            if (res.statusCode === 200 && json.choices) {
                console.log('\n✅ API 连通正常！');
                console.log(`   回复: ${json.choices[0]?.message?.content || '(空)'}`);
            } else if (json.error) {
                console.log(`\n❌ API 返回错误:`);
                console.log(`   类型: ${json.error.type || 'unknown'}`);
                console.log(`   信息: ${json.error.message || json.error}`);
                console.log(`   代码: ${json.error.code || 'N/A'}`);
                
                if (json.error.code === 'invalid_api_key') {
                    console.log('\n💡 建议: API Key 无效，请检查 Key 是否正确');
                } else if (json.error.code === 'model_not_found' || json.error.message?.includes('model')) {
                    console.log('\n💡 建议: 模型名不正确，尝试以下模型名:');
                    console.log('   deepseek-v4-pro');
                    console.log('   deepseek-chat');
                    console.log('   deepseek-reasoner');
                }
            }
        } catch (e) {
            console.log('📦 原始响应 (非 JSON):');
            console.log(data.substring(0, 500));
        }
    });
});

req.on('error', (err) => {
    console.log(`\n❌ 网络请求失败:`);
    console.log(`   ${err.message}`);
    
    if (err.code === 'ENOTFOUND') {
        console.log('\n💡 建议: DNS 解析失败，检查 API 地址是否正确');
    } else if (err.code === 'ECONNREFUSED') {
        console.log('\n💡 建议: 连接被拒绝，检查是否需要代理/VPN');
    } else if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
        console.log('\n💡 建议: 连接超时，可能需要设置代理或检查网络');
    }
});

req.on('timeout', () => {
    req.destroy();
    console.log('\n❌ 请求超时 (15秒)');
    console.log('💡 建议: 网络不通，可能需要代理');
});

req.write(payload);
req.end();
