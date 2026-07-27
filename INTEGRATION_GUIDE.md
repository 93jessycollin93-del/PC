# AI Studio Integration Guide

## Overview

This integration brings Google Gemini AI capabilities to your AI Studio application with:

- **GeminiBridge**: Direct access to Gemini models with vision support
- **StudioOrchestrator**: AI Studio-specific workflows for rapid development
- **React Hooks**: Simple integration with React components

The design prioritizes rapid iteration, code generation, and AI-assisted development.

## Quick Start

### 1. Setup Environment

Copy the example configuration:

```bash
cp .env.integration.example .env.local
```

Add your Gemini API key:

```bash
REACT_APP_GEMINI_API_KEY=your_key_from_aistudio.google.com
```

### 2. Use in Components

```typescript
import { useStudio } from './src/integration/useStudio';

function MyComponent() {
  const { generateComponent, analyzeCode } = useStudio({
    gemini: {
      apiKey: process.env.REACT_APP_GEMINI_API_KEY,
      vision: true,
    },
  });

  return (
    <div>
      <button onClick={() => generateComponent('Create a button')}>
        Generate
      </button>
    </div>
  );
}
```

## Architecture

```
┌─────────────────────────────────┐
│   useStudio React Hook          │
├─────────────────────────────────┤
│                                   │
│   ┌─────────────────────────┐   │
│   │  StudioOrchestrator     │   │
│   │  - generateComponent    │   │
│   │  - analyzeCode          │   │
│   │  - enhanceCode          │   │
│   │  - debugIssue           │   │
│   │  - generateDocumentation│   │
│   └──────────┬──────────────┘   │
│              │                    │
│   ┌──────────▼──────────┐        │
│   │  GeminiBridge       │        │
│   │  - prompt()         │        │
│   │  - chat()           │        │
│   │  - analyzeImage()   │        │
│   └─────────────────────┘        │
│                                   │
└─────────────────────────────────┘
         │
         ▼
    Google Gemini API
```

## Features

### 1. Component Generation

Generate React components from natural language descriptions:

```typescript
const { generateComponent } = useStudio(config);

const result = await generateComponent(
  'Create a card with title, description, and action button'
);

console.log(result.result); // Ready-to-use React component
```

### 2. Code Analysis

Analyze code for patterns, issues, and improvements:

```typescript
const { analyzeCode } = useStudio(config);

const analysis = await analyzeCode(myComponent);

// Results include:
// - Code structure analysis
// - Potential issues
// - Performance concerns
// - Best practice suggestions
```

### 3. Code Enhancement

Improve existing code based on specific requirements:

```typescript
const { enhanceCode } = useStudio(config);

const improved = await enhanceCode(
  myComponent,
  'Add TypeScript types, improve performance, add error boundaries'
);
```

### 4. Debugging Assistant

Get help fixing errors and bugs:

```typescript
const { debugIssue } = useStudio(config);

const solution = await debugIssue(
  'TypeError: Cannot read property of undefined',
  'Happens in useEffect when data loads'
);

// Returns detailed explanation and fix
```

### 5. Documentation Generation

Automatically generate documentation from code:

```typescript
const { generateDocumentation } = useStudio(config);

const docs = await generateDocumentation(myComponent);

// Generates:
// - Purpose and overview
// - Props documentation
// - Usage examples
// - Important notes
```

### 6. Vision Support

Analyze designs and images:

```typescript
const { generateComponent } = useStudio({
  gemini: { apiKey: '...', vision: true },
});

const component = await generateComponent(
  'Create a component based on this design',
  designImageUrl // Image URL for analysis
);
```

## Complete Workflow Example

```typescript
import { useStudio } from './src/integration/useStudio';
import React, { useState } from 'react';

function AIDevTool() {
  const studio = useStudio({
    gemini: {
      apiKey: process.env.REACT_APP_GEMINI_API_KEY,
      vision: true,
    },
  });

  const [generatedCode, setGeneratedCode] = useState('');
  const [description, setDescription] = useState('');

  const workflow = async () => {
    // Step 1: Generate component
    console.log('Generating component...');
    const generated = await studio.generateComponent(description);

    if (generated.status === 'failed') {
      console.error('Generation failed:', generated.error);
      return;
    }

    setGeneratedCode(generated.result);

    // Step 2: Analyze the generated code
    console.log('Analyzing generated code...');
    const analysis = await studio.analyzeCode(generated.result);
    console.log('Analysis:', analysis.result);

    // Step 3: Enhance based on requirements
    console.log('Enhancing code...');
    const enhanced = await studio.enhanceCode(
      generated.result,
      'Add proper TypeScript types, error handling, and accessibility'
    );

    setGeneratedCode(enhanced.result);

    // Step 4: Generate documentation
    console.log('Generating documentation...');
    const docs = await studio.generateDocumentation(enhanced.result);
    console.log('Documentation:', docs.result);

    // Step 5: View workflow history
    const history = studio.orchestrator.getHistory(10);
    console.log('Workflow completed. Tasks:', history.length);
  };

  return (
    <div className="ai-dev-tool">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe what you want to build..."
      />

      <button onClick={workflow} disabled={!studio.isReady}>
        {studio.isReady ? 'Generate & Enhance' : 'Initializing...'}
      </button>

      {studio.currentTask && (
        <div className={`status status-${studio.currentTask.status}`}>
          {studio.currentTask.type}: {studio.currentTask.status}
        </div>
      )}

      {studio.error && <div className="error">{studio.error}</div>}

      {generatedCode && (
        <div className="generated-code">
          <h3>Generated Code</h3>
          <pre>{generatedCode}</pre>
        </div>
      )}

      <div className="task-history">
        <h3>Recent Tasks ({studio.tasks.length})</h3>
        {studio.tasks.map((task) => (
          <div key={task.id} className={`task task-${task.type}`}>
            <strong>{task.type}:</strong> {task.status}
            {task.error && <p className="error">{task.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AIDevTool;
```

## Task Lifecycle

Each task goes through these states:

1. **pending**: Task created, waiting to start
2. **running**: Currently being processed by Gemini
3. **completed**: Finished successfully, result available
4. **failed**: Error occurred during processing

```typescript
const task = await studio.generateComponent('...');

if (task.status === 'completed') {
  console.log('Success:', task.result);
} else if (task.status === 'failed') {
  console.log('Error:', task.error);
}
```

## Error Handling

Always handle potential errors:

```typescript
try {
  const task = await studio.generateComponent(description);

  if (task.status === 'failed') {
    console.error('Task failed:', task.error);
    // Show user-friendly error message
    return;
  }

  // Use task.result
} catch (error) {
  console.error('Orchestration error:', error);
  // Handle unexpected errors
}
```

## Performance Optimization

### Caching Results

```typescript
const cache = new Map();

const getAnalysis = async (code) => {
  const hash = hashCode(code);

  if (cache.has(hash)) {
    return cache.get(hash);
  }

  const result = await studio.analyzeCode(code);
  cache.set(hash, result);
  return result;
};
```

### Batch Operations

```typescript
const files = ['component1.tsx', 'component2.tsx'];

// Process sequentially to avoid rate limits
for (const file of files) {
  const code = loadCode(file);
  await studio.analyzeCode(code);
}
```

### Memory Management

```typescript
// Periodically clear task history
if (studio.tasks.length > 100) {
  studio.clearHistory();
}
```

## Advanced Usage

### Custom Prompts

```typescript
const { orchestrator } = useStudio(config);

// Direct Gemini access
const response = await orchestrator?.gemini.prompt(
  'Custom prompt for specific task'
);
```

### Task Status Monitoring

```typescript
const { tasks, currentTask } = useStudio(config);

useEffect(() => {
  if (currentTask?.status === 'completed') {
    // React to completion
    console.log('Task complete:', currentTask.result);
  }
}, [currentTask]);
```

### History Analysis

```typescript
const { orchestrator } = useStudio(config);

const history = orchestrator?.getHistory(50);
const failedTasks = history?.filter((t) => t.status === 'failed');
const avgTime = history?.reduce((sum, t) => sum + t.timestamp, 0) / history.length;
```

## Integration with AI Studio

This integration is designed to work seamlessly with Google AI Studio:

- **Live Preview**: See generated components instantly
- **Code Sync**: Changes sync back to your editor
- **Design Import**: Analyze designs directly from AI Studio
- **Multi-Tab**: Work on multiple files simultaneously

## Environment Variables

All configuration through `.env.local`:

```bash
# Required
REACT_APP_GEMINI_API_KEY=your_key

# Optional
REACT_APP_GEMINI_MODEL=gemini-2.0-flash
REACT_APP_GEMINI_VISION=true
REACT_APP_GEMINI_TEMPERATURE=0.7
REACT_APP_AUTO_SAVE=false
REACT_APP_MAX_HISTORY=50
REACT_APP_DEBUG=false
```

## Troubleshooting

### "API Key not configured"

Ensure `.env.local` has `REACT_APP_GEMINI_API_KEY`:

```bash
REACT_APP_GEMINI_API_KEY=your_actual_key_here
```

Restart dev server after changes.

### Vision Not Working

Check `vision: true` is set in config:

```typescript
const studio = useStudio({
  gemini: {
    apiKey: '...',
    vision: true, // Must be true
  },
});
```

### Slow Responses

- Use shorter, more specific prompts
- Consider using `gemini-2.0-flash` (faster) vs `gemini-2.0-pro` (better quality)
- Batch operations to avoid rate limits

### Task History Growing Too Large

Clear history periodically:

```typescript
if (studio.tasks.length > 100) {
  studio.clearHistory();
}
```

## Contributing

To extend the integration:

1. Add new task types to `StudioOrchestrator`
2. Add corresponding methods to `useStudio` hook
3. Update documentation with examples
4. Add TypeScript types

## Best Practices

✅ **Do:**
- Handle errors gracefully
- Show progress to users
- Cache expensive operations
- Keep prompts concise and clear

❌ **Don't:**
- Leave API keys in code
- Ignore task failures
- Accumulate unlimited history
- Make assumptions about Gemini responses

## License

Part of the AI Studio application.

---

**Next Steps:**
1. Copy `.env.integration.example` to `.env.local`
2. Add your Gemini API key
3. Import `useStudio` in your component
4. Start building with AI assistance!
