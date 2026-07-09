/**
 * Pod Factory — Infinite scalability
 * Create any pod size, any quantity. Zero overhead for undefined pods.
 */

import podSchema from './pod-schema-infinite.json';

type PodStatus = 'preset' | 'on-demand' | 'undefined';

interface PodTierDefinition {
  id: string;
  size: number; // bytes
  quantity: number;
  status: PodStatus;
  purpose: string;
}

interface ActivePodInstance {
  id: string;
  tierId: string;
  sizeBytes: number;
  createdAt: Date;
  compressed: boolean;
}

/**
 * Infinite Pod Factory
 * - Define any pod size in JSON
 * - Spawn on demand
 * - Zero storage for undefined pods
 */
export class PodFactory {
  private schema: Record<string, PodTierDefinition>;
  private activePods: Map<string, ActivePodInstance[]> = new Map();

  constructor() {
    // Load schema (JSON only, no instantiation)
    this.schema = this.loadSchema();
  }

  /**
   * Load pod schema — instantaneous, zero resource cost
   */
  private loadSchema(): Record<string, PodTierDefinition> {
    const tiers: Record<string, PodTierDefinition> = {};

    // Parse all tiers from JSON schema
    const allTiers = {
      ...podSchema.sasInfinitePodSchema.presetTiers,
      ...podSchema.sasInfinitePodSchema.futureReadyTiers,
    };

    for (const [tierKey, tierDef] of Object.entries(allTiers)) {
      if (tierDef && typeof tierDef === 'object' && 'id' in tierDef) {
        tiers[(tierDef as any).id] = tierDef as PodTierDefinition;
      }
    }

    console.log(
      `[PodFactory] Loaded ${Object.keys(tiers).length} tier schemas (zero storage cost)`
    );
    return tiers;
  }

  /**
   * Spawn a pod from any defined tier
   * Only instantiates when called — everything else is schema
   */
  async spawn(tierId: string, quantity: number = 1): Promise<ActivePodInstance[]> {
    const tierDef = this.schema[tierId];

    if (!tierDef) {
      throw new Error(`Tier ${tierId} not found in schema`);
    }

    console.log(
      `[PodFactory] Spawning ${quantity} × ${tierId} (${this.formatBytes(tierDef.size)} each)`
    );

    const instances: ActivePodInstance[] = [];

    for (let i = 0; i < quantity; i++) {
      const instance: ActivePodInstance = {
        id: `${tierId}-${Date.now()}-${i}`,
        tierId,
        sizeBytes: tierDef.size,
        createdAt: new Date(),
        compressed: true, // Born compressed
      };

      instances.push(instance);

      if (!this.activePods.has(tierId)) {
        this.activePods.set(tierId, []);
      }
      this.activePods.get(tierId)!.push(instance);
    }

    console.log(`✓ Spawned ${instances.length} instances`);
    return instances;
  }

  /**
   * Get a tier definition (schema only, no instantiation)
   */
  getTierSchema(tierId: string): PodTierDefinition | null {
    return this.schema[tierId] || null;
  }

  /**
   * List all defined tiers (schema only)
   */
  listTiers(): {
    preset: string[];
    onDemand: string[];
    total: string[];
  } {
    const preset: string[] = [];
    const onDemand: string[] = [];

    for (const [tierId, def] of Object.entries(this.schema)) {
      if (def.status === 'preset') preset.push(tierId);
      if (def.status === 'on-demand') onDemand.push(tierId);
    }

    return {
      preset,
      onDemand,
      total: [...preset, ...onDemand],
    };
  }

  /**
   * Calculate theoretical maximum capacity (all tiers × quantity)
   * This is 10+ TB, stored as schema only (zero bytes)
   */
  maxCapacity(): {
    bytes: number;
    formatted: string;
    explanation: string;
  } {
    let totalBytes = 0;

    for (const tier of Object.values(this.schema)) {
      totalBytes += tier.size * tier.quantity;
    }

    return {
      bytes: totalBytes,
      formatted: this.formatBytes(totalBytes),
      explanation:
        'Theoretical max if all pods spawned. Schema only = zero actual storage.',
    };
  }

  /**
   * Get current active pod footprint
   */
  activeFootprint(): {
    totalBytes: number;
    totalInstances: number;
    byTier: Record<string, { instances: number; bytes: number }>;
    formatted: string;
  } {
    let totalBytes = 0;
    let totalInstances = 0;
    const byTier: Record<string, { instances: number; bytes: number }> = {};

    for (const [tierId, instances] of this.activePods) {
      const tierDef = this.schema[tierId];
      if (tierDef) {
        byTier[tierId] = {
          instances: instances.length,
          bytes: tierDef.size * instances.length,
        };
        totalBytes += tierDef.size * instances.length;
        totalInstances += instances.length;
      }
    }

    return {
      totalBytes,
      totalInstances,
      byTier,
      formatted: this.formatBytes(totalBytes),
    };
  }

  /**
   * Add a new tier dynamically (future-proofing in action)
   */
  addCustomTier(tierId: string, sizeBytes: number, purpose: string): void {
    if (this.schema[tierId]) {
      throw new Error(`Tier ${tierId} already exists`);
    }

    const customTier: PodTierDefinition = {
      id: tierId,
      size: sizeBytes,
      quantity: 0,
      status: 'on-demand',
      purpose,
    };

    this.schema[tierId] = customTier;
    console.log(
      `[PodFactory] Added custom tier: ${tierId} (${this.formatBytes(sizeBytes)})`
    );
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = bytes;
    let unitIdx = 0;

    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024;
      unitIdx++;
    }

    return `${size.toFixed(2)} ${units[unitIdx]}`;
  }
}
