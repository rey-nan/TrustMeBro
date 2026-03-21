import pino from 'pino';
export class LoopProtectionMiddleware {
    name = 'loop-protection';
    phase = 'post-execution';
    maxEditsPerResource;
    editCounts;
    logger;
    constructor(maxEditsPerResource = 5, logger) {
        this.maxEditsPerResource = maxEditsPerResource;
        this.editCounts = new Map();
        this.logger = logger ?? pino({ name: 'LoopProtectionMiddleware' });
    }
    async execute(ctx) {
        if (!ctx.result?.output) {
            return { continue: true };
        }
        const agentEdits = this.editCounts.get(ctx.agentId) ?? new Map();
        const mentionedFiles = this.extractFilesFromOutput(ctx.result.output);
        const warnings = [];
        for (const file of mentionedFiles) {
            const current = agentEdits.get(file) ?? { count: 0, lastEdit: 0 };
            current.count += 1;
            current.lastEdit = Date.now();
            agentEdits.set(file, current);
            if (current.count > this.maxEditsPerResource) {
                warnings.push(`You have modified "${file}" ${current.count} times. Consider reconsidering your approach entirely. Try a different strategy.`);
            }
        }
        this.editCounts.set(ctx.agentId, agentEdits);
        if (warnings.length > 0) {
            this.logger.info({ agentId: ctx.agentId, warnings: warnings.length }, 'Loop protection triggered');
            return {
                continue: true,
                injectedContext: warnings.join('\n'),
            };
        }
        return { continue: true };
    }
    extractFilesFromOutput(output) {
        const files = [];
        const patterns = [
            /[\w\-./]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|md|json|yaml|yml|toml|env)\b/gi,
            /file[s]?:\s*([\w\-./]+)/gi,
            /edit(?:ed|ing)?\s+([\w\-./]+)/gi,
            /created\s+([\w\-./]+)/gi,
            /modified\s+([\w\-./]+)/gi,
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(output)) !== null) {
                const file = match[1] ?? match[0];
                if (file && !file.startsWith('http') && file.includes('.')) {
                    files.push(file);
                }
            }
        }
        return [...new Set(files)];
    }
    getEditCount(agentId, resource) {
        return this.editCounts.get(agentId)?.get(resource)?.count ?? 0;
    }
    clearAgent(agentId) {
        this.editCounts.delete(agentId);
    }
    clearAll() {
        this.editCounts.clear();
    }
}
//# sourceMappingURL=loop-protection.js.map