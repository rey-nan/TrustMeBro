const MAX_BODY_SIZE = 10 * 1024;
async function httpGetImpl(url, headers) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'TrustMeBro/1.0',
                ...headers,
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        let body = await response.text();
        if (body.length > MAX_BODY_SIZE) {
            body = body.slice(0, MAX_BODY_SIZE) + '\n[Response truncated]';
        }
        return {
            success: true,
            result: {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body,
            },
        };
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return { success: false, error: 'Request timeout (15s exceeded)' };
        }
        return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
    }
}
async function httpPostImpl(url, body, headers) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': 'TrustMeBro/1.0',
                'Content-Type': 'application/json',
                ...headers,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        let responseBody = await response.text();
        if (responseBody.length > MAX_BODY_SIZE) {
            responseBody = responseBody.slice(0, MAX_BODY_SIZE) + '\n[Response truncated]';
        }
        return {
            success: true,
            result: {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody,
            },
        };
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return { success: false, error: 'Request timeout (15s exceeded)' };
        }
        return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
    }
}
const httpGetTool = {
    definition: {
        name: 'http_get',
        description: 'Make an HTTP GET request',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'The URL to fetch',
                },
                headers: {
                    type: 'object',
                    description: 'Optional HTTP headers',
                },
            },
            required: ['url'],
        },
    },
    execute: async (input) => {
        const url = input.url;
        const headers = input.headers;
        if (!url) {
            return { success: false, error: 'URL parameter is required' };
        }
        return httpGetImpl(url, headers);
    },
};
const httpPostTool = {
    definition: {
        name: 'http_post',
        description: 'Make an HTTP POST request with JSON body',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'The URL to POST to',
                },
                body: {
                    type: 'object',
                    description: 'The JSON body to send',
                },
                headers: {
                    type: 'object',
                    description: 'Optional HTTP headers',
                },
            },
            required: ['url', 'body'],
        },
    },
    execute: async (input) => {
        const url = input.url;
        const body = input.body;
        const headers = input.headers;
        if (!url) {
            return { success: false, error: 'URL parameter is required' };
        }
        return httpPostImpl(url, body, headers);
    },
};
export const httpRequestSkill = {
    id: 'http_request',
    name: 'HTTP Request',
    description: 'Make HTTP GET and POST requests',
    tools: [httpGetTool, httpPostTool],
};
//# sourceMappingURL=http-request.js.map