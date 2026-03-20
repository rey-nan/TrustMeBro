import pino from 'pino';
import { createHash } from 'crypto';
import type { LoopRecord } from './types.js';

export class LoopDetector {
  private records: Map<string, LoopRecord> = new Map();
  private maxLoops: number;
  private logger: pino.Logger;

  constructor(maxLoops: number = 5, logger?: pino.Logger) {
    this.maxLoops = maxLoops;
    this.logger = logger ?? pino({ name: 'LoopDetector' });
  }

  record(agentId: string, taskInput: string): LoopRecord {
    const signature = this.createSignature(taskInput);
    const key = `${agentId}:${signature}`;

    const existing = this.records.get(key);
    const now = Date.now();

    if (existing) {
      existing.count++;
      existing.lastSeen = now;
      this.logger.debug({
        agentId,
        signature: signature.slice(0, 20),
        count: existing.count,
        maxLoops: this.maxLoops,
      }, 'Loop record updated');
      return existing;
    }

    const record: LoopRecord = {
      agentId,
      taskSignature: signature,
      count: 1,
      firstSeen: now,
      lastSeen: now,
    };

    this.records.set(key, record);
    this.logger.debug({ agentId, signature: signature.slice(0, 20) }, 'New loop record created');
    return record;
  }

  isLooping(agentId: string, taskInput: string): boolean {
    const signature = this.createSignature(taskInput);
    const key = `${agentId}:${signature}`;
    const record = this.records.get(key);

    if (!record) return false;

    const looping = record.count >= this.maxLoops;

    if (looping) {
      this.logger.warn({
        agentId,
        count: record.count,
        maxLoops: this.maxLoops,
      }, 'Loop detected');
    }

    return looping;
  }

  clear(agentId?: string): void {
    if (agentId) {
      const keysToDelete: string[] = [];
      for (const [key, record] of this.records) {
        if (record.agentId === agentId) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.records.delete(key);
      }
      this.logger.info({ agentId, removed: keysToDelete.length }, 'Loop records cleared for agent');
    } else {
      this.records.clear();
      this.logger.info({}, 'All loop records cleared');
    }
  }

  getStats(): LoopRecord[] {
    return Array.from(this.records.values());
  }

  private createSignature(input: string): string {
    const normalized = input
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);

    return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  }
}
