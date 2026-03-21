import pino from 'pino';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
const DEPARTMENTS_FILE = 'data/departments.json';
const ORGANIZATION_FILE = 'data/organization.json';
export class DepartmentRegistry {
    departments = new Map();
    logger;
    filePath;
    constructor(filePath, logger) {
        this.logger = logger ?? pino({ name: 'DepartmentRegistry' });
        this.filePath = filePath ?? DEPARTMENTS_FILE;
        this.load();
    }
    create(department) {
        const dept = {
            ...department,
            createdAt: Date.now(),
        };
        this.departments.set(dept.id, dept);
        this.save();
        this.logger.info({ id: dept.id, name: dept.name }, 'Department created');
        return dept;
    }
    get(id) {
        return this.departments.get(id);
    }
    list() {
        return Array.from(this.departments.values());
    }
    update(id, updates) {
        const existing = this.departments.get(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...updates, id: existing.id };
        this.departments.set(id, updated);
        this.save();
        this.logger.info({ id }, 'Department updated');
        return updated;
    }
    remove(id) {
        const deleted = this.departments.delete(id);
        if (deleted) {
            this.save();
            this.logger.info({ id }, 'Department removed');
        }
        return deleted;
    }
    addAgent(deptId, agentId) {
        const dept = this.departments.get(deptId);
        if (!dept)
            return false;
        if (!dept.agentIds.includes(agentId)) {
            dept.agentIds.push(agentId);
            this.departments.set(deptId, dept);
            this.save();
            this.logger.info({ deptId, agentId }, 'Agent added to department');
        }
        return true;
    }
    removeAgent(deptId, agentId) {
        const dept = this.departments.get(deptId);
        if (!dept)
            return false;
        dept.agentIds = dept.agentIds.filter((id) => id !== agentId);
        if (dept.leadAgentId === agentId) {
            dept.leadAgentId = undefined;
        }
        this.departments.set(deptId, dept);
        this.save();
        this.logger.info({ deptId, agentId }, 'Agent removed from department');
        return true;
    }
    setLead(deptId, agentId) {
        const dept = this.departments.get(deptId);
        if (!dept)
            return false;
        dept.leadAgentId = agentId;
        if (!dept.agentIds.includes(agentId)) {
            dept.agentIds.push(agentId);
        }
        this.departments.set(deptId, dept);
        this.save();
        this.logger.info({ deptId, agentId }, 'Department lead set');
        return true;
    }
    load() {
        try {
            if (!existsSync(this.filePath)) {
                this.logger.info({}, 'No departments file found');
                return;
            }
            const data = readFileSync(this.filePath, 'utf-8');
            const departments = JSON.parse(data);
            for (const dept of departments) {
                if (dept.id) {
                    this.departments.set(dept.id, dept);
                }
            }
            this.logger.info({ count: this.departments.size }, 'Departments loaded');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Failed to load departments');
        }
    }
    save() {
        try {
            const dir = dirname(this.filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            const departments = Array.from(this.departments.values());
            writeFileSync(this.filePath, JSON.stringify(departments, null, 2), 'utf-8');
            this.logger.debug({ count: departments.length }, 'Departments saved');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Failed to save departments');
        }
    }
}
export class OrganizationRegistry {
    organization = null;
    logger;
    filePath;
    constructor(filePath, logger) {
        this.logger = logger ?? pino({ name: 'OrganizationRegistry' });
        this.filePath = filePath ?? ORGANIZATION_FILE;
        this.load();
    }
    get() {
        return this.organization;
    }
    create(org) {
        this.organization = {
            ...org,
            departments: [],
            createdAt: Date.now(),
        };
        this.save();
        this.logger.info({ id: this.organization.id, name: this.organization.name }, 'Organization created');
        return this.organization;
    }
    update(updates) {
        if (!this.organization)
            return null;
        this.organization = { ...this.organization, ...updates };
        this.save();
        this.logger.info({}, 'Organization updated');
        return this.organization;
    }
    setCEO(agentId) {
        if (!this.organization)
            return false;
        this.organization.ceoAgentId = agentId;
        this.save();
        this.logger.info({ agentId }, 'CEO set');
        return true;
    }
    load() {
        try {
            if (!existsSync(this.filePath)) {
                this.logger.info({}, 'No organization file found');
                return;
            }
            const data = readFileSync(this.filePath, 'utf-8');
            this.organization = JSON.parse(data);
            this.logger.info({ id: this.organization?.id }, 'Organization loaded');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Failed to load organization');
        }
    }
    save() {
        if (!this.organization)
            return;
        try {
            const dir = dirname(this.filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(this.filePath, JSON.stringify(this.organization, null, 2), 'utf-8');
            this.logger.debug({}, 'Organization saved');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Failed to save organization');
        }
    }
}
//# sourceMappingURL=department-registry.js.map