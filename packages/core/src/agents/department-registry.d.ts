import pino from 'pino';
import type { Department, Organization } from './types.js';
export declare class DepartmentRegistry {
    private departments;
    private logger;
    private filePath;
    constructor(filePath?: string, logger?: pino.Logger);
    create(department: Omit<Department, 'createdAt'>): Department;
    get(id: string): Department | undefined;
    list(): Department[];
    update(id: string, updates: Partial<Department>): Department | undefined;
    remove(id: string): boolean;
    addAgent(deptId: string, agentId: string): boolean;
    removeAgent(deptId: string, agentId: string): boolean;
    setLead(deptId: string, agentId: string): boolean;
    private load;
    private save;
}
export declare class OrganizationRegistry {
    private organization;
    private logger;
    private filePath;
    constructor(filePath?: string, logger?: pino.Logger);
    get(): Organization | null;
    create(org: Omit<Organization, 'createdAt' | 'departments'>): Organization;
    update(updates: Partial<Organization>): Organization | null;
    setCEO(agentId: string): boolean;
    private load;
    private save;
}
//# sourceMappingURL=department-registry.d.ts.map