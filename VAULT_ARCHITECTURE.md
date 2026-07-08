# SAS_ZERO Vault Architecture

## Core Design: Production-Grade Compression & Backup

### 1. Multi-Stage Compression Pipeline

**Semantic Layer** (AI-powered)
- KnowledgeCompressor uses Gemini API + 30 specialized condensers
- Reduces raw content by 70-95% through semantic analysis
- Formats: single-sentence gists, first-principles axioms, fact densifiers, etc.

**Physical Layer** (Lossless)
- fflate compression (Deflate algorithm): reduces by additional 60-90%
- LZW compression option for specific pod types
- Combined effect: raw→semantic→physical = 95%+ reduction

**Cloud Layer** (Deduplication planned)
- 3-copy rotating backup system
- Each slot independent, full state capture
- Rotation every 1.5 hours (3 rotations = 4.5-hour rollback window)
- Can extend to 6-hour rotations for full 1.5-day safety window

### 2. Pod System Architecture

#### Pod Tiers (Configurable)

**Tier 12** (Core/Lightweight)
- 12 small knowledge pods (~5-30 MB each compressed)
- Covers: python docs, bash basics, git, sqlite, javascript reference
- Total: ~150 MB compressed
- Always available in memory

**Tier 24** (Extended/Production)
- 24 medium knowledge pods (~10-50 MB each compressed)
- Adds: frameworks (React, Django, FastAPI), databases, devops tools
- Total: ~600 MB compressed
- Lazy-loaded on-demand

**Tier 60+** (Full Catalog)
- 60+ specialized pods including research papers, ML models, language specs
- Fully available for retrieval but streaming-loaded
- No single-load maximum

#### Pod Loading Strategy (Lazy-Loading)

```
Request Flow:
1. App/Entity requests knowledge on [Topic]
2. Vault checks memory cache - return if hot
3. If not cached, check IndexedDB compressed store
4. Decompress pod (fast: <100ms with fflate)
5. Load into memory cache with LRU eviction
6. Return decompressed data
7. Track: which pods are "hot" for predictive preload
```

### 3. Cloud Backup Rotation System

**3-Copy Mechanism**

```
Timeline:
T=0:00   Slot 1 Backup (active, receives updates)
         ├─ Total pods: N
         ├─ Compressed size: X MB
         └─ Checksum: v[timestamp]_s1

T=1:30   Slot 2 Backup (rotation trigger)
         ├─ Slot 1 archives (no more updates)
         └─ Slot 2 becomes active

T=3:00   Slot 3 Backup
         ├─ Slot 2 archives
         └─ Slot 3 becomes active

T=4:30   Slot 1 Backup (cycle repeats)
         ├─ Slot 3 archives
         ├─ Slot 1 refreshes (overwrites oldest)
         └─ Slot 1 becomes active again
```

**Recovery Window**
- At any time: 3 independent snapshots available
- Can rollback to any of the 3 recent states
- 1.5-hour interval means ~4.5-hour total window
- Extended rotation (6-hour interval) = ~1.5-day window

### 4. Storage Implementation

**Local Storage Stack**
- IndexedDB (primary): Compressed pods, checksum metadata
- localStorage (metadata): Vault state, backup rotation schedule, snapshots
- Memory Cache (LRU): Hot pods for immediate access

**Storage Quotas**
- Browser IndexedDB: typically 50 MB - 2 GB (device-dependent)
- PC target: 300 MB compressed pods + 600 MB working set = 900 MB
- With 70-95% compression: up to 5 GB uncompressed data in 300 MB

### 5. Pod Lifecycle

```
States:
- idle: available but not downloaded
- downloading: transfer in progress
- compiling: semantic + physical compression
- ready: fully compressed, stored in IndexedDB
- loaded: decompressed in memory cache
- archived: in backup slot, read-only
```

**Transitions**
```
idle → downloading → compiling → ready → loaded
                                   ↓
                            (LRU evict if needed)
                                   ↓
                                ready
                                   ↓
                            (archive rotation)
                                   ↓
                               archived
```

### 6. Checksum & Integrity

**Verification on Every Rotation**
```
Checksum Format: v[Unix_Timestamp_Base36]_s[SlotNumber]
Example: v2uqk4g_s1

Storage: localStorage['vault_backup_rotation']
Fields:
  - slot: 1|2|3
  - timestamp: Date.now()
  - totalPodsCount: N
  - totalCompressedSizeMB: X.XX
  - checksum: string
```

**Recovery Validation**
- Check checksums match between slot and metadata
- Verify pod count consistency
- Validate compressed size within expected range
- Reject corrupted snapshots, use previous slot

### 7. Future Enhancements

**Phase 2: True Cloud Sync**
- Upload backup slots to cloud storage (Firebase, AWS S3, Backblaze B2)
- Cost: ~$0.05/month per 300 MB slot × 3 copies
- Off-device disaster recovery

**Phase 3: Pod Versioning**
- Track pod versions and update diffs
- Incremental backup (only changed pods)
- Reduce backup size by 80-90%

**Phase 4: Distributed Pod Sources**
- Fetch pods from external registries
- Community pod marketplace
- Custom pod creation tools

## Implementation Status

✅ Implemented:
- Multi-stage compression (semantic + fflate)
- Local IndexedDB storage
- 3-copy backup rotation framework
- Lazy-loading architecture
- Backup slots UI + recovery options
- Checksum verification

🚧 In Progress:
- Pod tiering system (12/24 configuration)
- LRU memory cache management
- Cloud upload integration
- Pod request tracking & analytics

📋 Planned:
- Version control for pods
- Incremental backup diffs
- External pod registry
- Pod marketplace

## Configuration

To modify rotation interval:
```typescript
// In DataPodsApp.tsx, line ~50
const ROTATION_INTERVAL = 90 * 60 * 1000; // 1.5 hours

// For extended safety (1.5-day window):
const ROTATION_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
```

To add new pod tiers:
```typescript
// In INITIAL_PODS array, organize by category
// Tier 12: priority=1 (always preload)
// Tier 24: priority=2 (lazy-load on-demand)
// Tier 60+: priority=3 (fetch individually)
```

## Storage Estimation

**Target: 5 GB Uncompressed → 300 MB Compressed**

Example breakdown:
- 30 knowledge pods: raw 2.5 GB → compressed 80 MB (97% reduction)
- 20 training datasets: raw 1.8 GB → compressed 90 MB (95% reduction)
- 15 research papers: raw 800 MB → compressed 65 MB (92% reduction)
- 50 reference documents: raw 600 MB → compressed 65 MB (89% reduction)

**Total Vault: 5.7 GB → 300 MB (94.7% reduction)**

With 3-copy backup: 900 MB total local storage
