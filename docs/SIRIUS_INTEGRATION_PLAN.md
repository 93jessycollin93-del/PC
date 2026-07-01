# Sirius Security AI Router: PC + Flipper Zero Integration Plan

## Context
You're building **Sirius**, a serious security-focused AI router that combines:
- **PC Application**: Control interface for hardware and online services (Gemini-based, to be built)
- **Flipper Zero Firmware**: Sophisticated RF/wireless security testing and validation device (embedded C/FreeRTOS)

The goal is to integrate these as a unified security system where the Flipper Zero becomes the **hardware validation and RF testing component** of the Sirius router, controlled and monitored from the PC app. All functionality must be preserved; no games, no mocks.

---

## Recommended Integration Architecture

### System Overview
```
┌─────────────────────────────────────────┐
│   PC Application (Gemini-based)         │
│  ┌──────────────────────────────────┐   │
│  │  Sirius Router Control Dashboard │   │
│  │  • Device management             │   │
│  │  • Online service integration    │   │
│  │  • Security policies             │   │
│  │  • RF testing & validation UI    │   │
│  └──────────────────────────────────┘   │
│           ↕ RPC/WebSocket               │
└─────────────────────────────────────────┘
         ↕ USB/Bluetooth
┌─────────────────────────────────────────┐
│   Flipper Zero Hardware + Firmware      │
│  ┌──────────────────────────────────┐   │
│  │  RF Testing & Validation Engine  │   │
│  │  • SubGhz protocols              │   │
│  │  • NFC/RFID testing              │   │
│  │  • IR analysis                   │   │
│  │  • Wireless security validation  │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Integration Approach: **Controller Pattern**

1. **Flipper Zero remains independent**: Keep the firmware exactly as-is with no modifications. It runs its full RPC service over USB/Bluetooth.

2. **PC App acts as controller**: The PC application connects to the Flipper Zero via its existing RPC interface and adds a new **Sirius Bridge Module** that:
   - Translates Sirius security policies into Flipper Zero RF testing commands
   - Manages hardware validation workflows
   - Aggregates test results
   - Provides unified UI for both systems

3. **Communication layers**:
   - **Hardware Level**: USB or Bluetooth connection between PC and Flipper Zero
   - **Protocol Level**: Use Flipper Zero's native RPC protobuf interface (already exists)
   - **Application Level**: New "Sirius Bridge" module in PC app translates Sirius commands to Flipper RPC calls

---

## Architecture Details

### PC Application Structure (to be built)
```
/PC/
├── /src/
│   ├── /core/
│   │   ├── router-manager.ts        # Sirius router hardware control
│   │   ├── online-services.ts       # Online service integration
│   │   └── gemini-agent.ts          # Gemini AI integration
│   │
│   ├── /flipper-integration/        # NEW: Flipper Zero bridge
│   │   ├── flipper-rpc-client.ts    # RPC communication
│   │   ├── flipper-protocol-mapper.ts # Map Sirius → Flipper commands
│   │   ├── hardware-validator.ts    # RF/wireless validation workflows
│   │   └── test-result-aggregator.ts # Collect & analyze test results
│   │
│   ├── /ui/
│   │   ├── /dashboard               # Main router dashboard
│   │   ├── /rf-testing             # RF testing & validation UI
│   │   ├── /hardware-status        # Device health & status
│   │   └── /security-policies      # Policy management
│   │
│   └── /api/
│       └── /sirius-api.ts          # API routes for all features
│
├── package.json                     # Dependencies (will include flipper RPC libs)
└── .env.example                     # Connection configs
```

### Flipper Zero: No changes needed
- Keep firmware exactly as-is
- Enable RPC service (already default)
- PC app communicates via standard RPC protocol over USB/Bluetooth
- All existing Flipper capabilities remain untouched

### Data Flow Examples

**Example 1: Wireless Protocol Security Validation**
```
User in PC App → Select "Validate SubGhz Security"
  → Sirius Bridge translates to Flipper RPC commands
  → Flipper Zero tests RF protocols
  → Results stream back to PC App
  → Display analysis & recommendations
```

**Example 2: NFC Hardware Testing**
```
User in PC App → "Test NFC Reader Compliance"
  → Sirius Bridge sends NFC test sequence to Flipper
  → Flipper performs NFC polling/emulation tests
  → Results aggregated with security policies
  → Report generated in PC dashboard
```

---

## Key Implementation Points

### Don't Change
- ✅ Flipper Zero firmware: Keep exactly as-is
- ✅ All Flipper protocols and capabilities: Fully preserved
- ✅ Existing Flipper RPC interface: Use as-is

### Build New
- ✅ PC Application (from empty template)
- ✅ Flipper RPC client library (TypeScript/JavaScript wrapper for protobuf RPC)
- ✅ Sirius Bridge module (translates Sirius commands to Flipper RPC)
- ✅ UI for RF testing/validation workflows
- ✅ Results aggregation and security analysis layer

### Technology Choices
- **PC App Framework**: Gemini-based (as per your Google AI Studio plan)
- **Flipper Communication**: Use protobuf + RPC over USB/Bluetooth
- **Language**: TypeScript/JavaScript for PC app (best for Gemini integration)
- **Hardware Access**: Use node-usb or similar for USB communication
- **RPC Protocol**: Flipper's existing protobuf-based RPC (no changes needed)

---

## Files to Modify/Create

**Flipper Zero**: 
- No modifications needed (zero changes to existing firmware)

**PC Application** (new development):
- `/src/flipper-integration/flipper-rpc-client.ts` - RPC communication layer
- `/src/flipper-integration/hardware-validator.ts` - Validation workflows
- `/src/flipper-integration/flipper-protocol-mapper.ts` - Command translation
- `/src/ui/rf-testing/` - UI components for testing interface
- `/src/core/router-manager.ts` - Sirius router management
- `package.json` - Add Flipper RPC dependencies

---

## Verification & Testing

### Testing Strategy
1. **Unit Tests**: Test RPC client and protocol mapper independently
2. **Integration Tests**: Verify Flipper ↔ PC communication via actual USB/Bluetooth
3. **Workflow Tests**: End-to-end RF testing scenarios
4. **Security Tests**: Validate that Flipper hardware testing matches Sirius security policies
5. **Hardware Tests**: Connect actual Flipper Zero device and run real RF tests

### Success Criteria
- ✅ PC app successfully communicates with Flipper Zero over USB/Bluetooth
- ✅ All Flipper RF/NFC/IR capabilities accessible from PC dashboard
- ✅ Flipper continues to work standalone (no dependencies on PC)
- ✅ Sirius security policies can be validated using Flipper hardware
- ✅ Test results properly aggregated and displayed
- ✅ Zero functionality lost from either component

---

## Why This Approach?

1. **Preserves all functionality**: Flipper firmware unchanged, PC app is new development
2. **Loose coupling**: Components communicate via standard RPC, can operate independently
3. **Scalable**: Easy to add more hardware validators or test types later
4. **Security-focused**: Clear separation of concerns (control vs. testing)
5. **Production-ready**: Uses proven embedded RPC patterns instead of custom integrations
6. **Serious & Professional**: No game mechanics, pure security validation

