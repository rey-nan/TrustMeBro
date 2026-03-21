async function webSearchImpl(query) {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'TrustMeBro/1.0',
            },
        });
        clearTimeout(timeout);
        if (!response.ok) {
            return {
                success: false,
                error: `HTTP error: ${response.status}`,
            };
        }
        const data = await response.json();
        const results = [];
        if (data.Results && data.Results.length > 0) {
            for (const result of data.Results.slice(0, 5)) {
                results.push(`- ${result.Title}: ${result.Text} (${result.FirstURL})`);
            }
        }
        else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            for (const topic of data.RelatedTopics.slice(0, 5)) {
                if (topic.Text) {
                    results.push(`- ${topic.Text}${topic.FirstURL ? ` (${topic.FirstURL})` : ''}`);
                }
            }
        }
        if (results.length === 0) {
            return {
                success: true,
                result: 'No results found for this query.',
            };
        }
        return {
            success: true,
            result: `Search results for "${query}":\n\n${results.join('\n')}`,
        };
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return {
                success: false,
                error: 'Search timeout - DuckDuckGo API did not respond in time',
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
        };
    }
}
const webSearchTool = {
    definition: {
        name: 'web_search',
        description: 'Search the web for information using DuckDuckGo',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query',
                },
            },
            required: ['query'],
        },
    },
    execute: async (input) => {
        const query = input.query;
        if (!query || typeof query !== 'string') {
            return { success: false, error: 'Query parameter is required' };
        }
        return webSearchImpl(query);
    },
};
export const webSearchSkill = {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the web for information using DuckDuckGo',
    tools: [webSearchTool],
};
//# sourceMappingURL=web-search.js.map