import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
const MAX_FILE_SIZE = 50 * 1024;
function isPathTraversal(path) {
    const normalized = path.replace(/\\/g, '/');
    return normalized.includes('..');
}
async function readFileImpl(path, workspacePath) {
    if (isPathTraversal(path)) {
        return { success: false, error: 'Path traversal not allowed' };
    }
    const fullPath = resolve(workspacePath, path);
    if (!fullPath.startsWith(resolve(workspacePath))) {
        return { success: false, error: 'Path outside workspace not allowed' };
    }
    if (!existsSync(fullPath)) {
        return { success: false, error: 'File not found' };
    }
    try {
        const content = readFileSync(fullPath);
        if (content.length > MAX_FILE_SIZE) {
            return {
                success: true,
                result: `[File truncated - too large: ${content.length} bytes]\n\n${content.slice(0, MAX_FILE_SIZE).toString('utf-8')}`
            };
        }
        return {
            success: true,
            result: content.toString('utf-8'),
        };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Read failed' };
    }
}
async function writeFileImpl(path, content, workspacePath) {
    if (isPathTraversal(path)) {
        return { success: false, error: 'Path traversal not allowed' };
    }
    const fullPath = resolve(workspacePath, path);
    if (!fullPath.startsWith(resolve(workspacePath))) {
        return { success: false, error: 'Path outside workspace not allowed' };
    }
    try {
        const dir = join(fullPath, '..');
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(fullPath, content, 'utf-8');
        return {
            success: true,
            result: `File written: ${path}`,
        };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Write failed' };
    }
}
async function listFilesImpl(path, workspacePath) {
    let targetPath = workspacePath;
    if (path) {
        if (isPathTraversal(path)) {
            return { success: false, error: 'Path traversal not allowed' };
        }
        targetPath = resolve(workspacePath, path);
        if (!targetPath.startsWith(resolve(workspacePath))) {
            return { success: false, error: 'Path outside workspace not allowed' };
        }
    }
    try {
        const entries = readdirSync(targetPath, { withFileTypes: true });
        const files = entries.map((e) => e.name);
        return {
            success: true,
            result: files,
        };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'List failed' };
    }
}
async function deleteFileImpl(path, workspacePath) {
    if (isPathTraversal(path)) {
        return { success: false, error: 'Path traversal not allowed' };
    }
    const fullPath = resolve(workspacePath, path);
    if (!fullPath.startsWith(resolve(workspacePath))) {
        return { success: false, error: 'Path outside workspace not allowed' };
    }
    if (!existsSync(fullPath)) {
        return { success: false, error: 'File not found' };
    }
    try {
        unlinkSync(fullPath);
        return {
            success: true,
            result: `File deleted: ${path}`,
        };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
    }
}
export function createFileSystemSkill(workspacePath) {
    const readFileTool = {
        definition: {
            name: 'read_file',
            description: 'Read a file from the workspace',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Relative path to the file within workspace',
                    },
                },
                required: ['path'],
            },
        },
        execute: async (input) => {
            const path = input.path;
            if (!path) {
                return { success: false, error: 'Path parameter is required' };
            }
            return readFileImpl(path, workspacePath);
        },
    };
    const writeFileTool = {
        definition: {
            name: 'write_file',
            description: 'Write content to a file in the workspace',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Relative path to the file within workspace',
                    },
                    content: {
                        type: 'string',
                        description: 'Content to write to the file',
                    },
                },
                required: ['path', 'content'],
            },
        },
        execute: async (input) => {
            const path = input.path;
            const content = input.content;
            if (!path || content === undefined) {
                return { success: false, error: 'Path and content parameters are required' };
            }
            return writeFileImpl(path, content, workspacePath);
        },
    };
    const listFilesTool = {
        definition: {
            name: 'list_files',
            description: 'List files in workspace or a subdirectory',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Optional relative path to list (defaults to workspace root)',
                    },
                },
                required: [],
            },
        },
        execute: async (input) => {
            const path = input.path;
            return listFilesImpl(path, workspacePath);
        },
    };
    const deleteFileTool = {
        definition: {
            name: 'delete_file',
            description: 'Delete a file from the workspace',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Relative path to the file within workspace',
                    },
                },
                required: ['path'],
            },
        },
        execute: async (input) => {
            const path = input.path;
            if (!path) {
                return { success: false, error: 'Path parameter is required' };
            }
            return deleteFileImpl(path, workspacePath);
        },
    };
    return {
        id: 'file_system',
        name: 'File System',
        description: 'Read, write, list, and delete files in the workspace',
        tools: [readFileTool, writeFileTool, listFilesTool, deleteFileTool],
    };
}
//# sourceMappingURL=file-system.js.map