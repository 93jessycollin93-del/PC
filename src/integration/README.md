# AI Studio Integration Module

Specialized integration for Google Gemini with AI Studio optimizations for rapid application development.

## Quick Start

### Setup

```typescript
import { useStudio } from './src/integration/useStudio';

function MyApp() {
  const { generateComponent, analyzeCode, enhanceCode } = useStudio({
    gemini: {
      apiKey: process.env.REACT_APP_GEMINI_API_KEY,
      model: 'gemini-2.0-flash',
      vision: true,
    },
  });
}
```

## Core Components

### GeminiBridge

Unified interface to Google Gemini models with vision support.

```typescript
import { GeminiBridge } from './src/integration';

const gemini = new GeminiBridge({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-2.0-flash',
  vision: true,
});

// Text generation
const response = await gemini.prompt('Generate a React component');

// Image analysis
const analysis = await gemini.analyzeImage(imageUrl, 'What does this design show?');
```

### StudioOrchestrator

Coordinates AI Studio-specific workflows.

```typescript
import { StudioOrchestrator } from './src/integration';

const studio = new StudioOrchestrator({
  gemini: { apiKey: '...' },
  autoSave: true,
  maxHistory: 50,
});

// Generate component from description
const task = await studio.generateComponent('Create a user profile card');

// Analyze existing code
const analysis = await studio.analyzeCode(myCode);

// Enhance code
const enhanced = await studio.enhanceCode(myCode, 'Add loading states');

// Debug issues
const debug = await studio.debugIssue('Component not rendering', context);

// Generate documentation
const docs = await studio.generateDocumentation(myCode);
```

### useStudio Hook

React hook for component-level access.

```typescript
import { useStudio } from './src/integration/useStudio';

function CodeEditor() {
  const {
    generateComponent,
    analyzeCode,
    enhanceCode,
    debugIssue,
    generateDocumentation,
    tasks,
    currentTask,
    error,
  } = useStudio({
    gemini: {
      apiKey: process.env.REACT_APP_GEMINI_API_KEY,
      vision: true,
    },
  });

  const handleGenerate = async () => {
    const task = await generateComponent('Create a dashboard widget');
    // task.result contains the generated code
  };

  const handleAnalyze = async () => {
    const task = await analyzeCode(selectedCode);
    console.log(task.result); // Analysis results
  };

  return (
    <div>
      <button onClick={handleGenerate}>Generate</button>
      <button onClick={handleAnalyze}>Analyze</button>
      {currentTask && <div>Status: {currentTask.status}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

## Task Types

| Type | Method | Purpose |
|------|--------|---------|
| `generate` | `generateComponent()` | Generate React components |
| `analyze` | `analyzeCode()` | Analyze code for patterns, issues |
| `enhance` | `enhanceCode()` | Improve existing code |
| `debug` | `debugIssue()` | Solve errors and problems |
| `document` | `generateDocumentation()` | Create documentation |

## Features

✨ **Vision Support** - Analyze designs and images  
🚀 **Component Generation** - Create React components from descriptions  
🔍 **Code Analysis** - Understand and improve existing code  
🐛 **Debug Assistant** - Get help fixing errors  
📚 **Auto Documentation** - Generate docs from code  
⚡ **Task History** - Track all operations  
🎯 **TypeScript** - Full type safety  

## Real-World Examples

### Generate from Design

```typescript
const { generateComponent } = useStudio(config);

const task = await generateComponent(
  'Create a card showing product name, image, price, and add-to-cart button',
  designImageUrl // Can analyze the design image
);

console.log(task.result); // Generated React component code
```

### Analyze and Improve

```typescript
const { analyzeCode, enhanceCode } = useStudio(config);

// First, analyze the code
const analysis = await analyzeCode(myComponent);
console.log(analysis.result); // Identifies issues

// Then enhance based on analysis
const enhanced = await enhanceCode(
  myComponent,
  'Add proper TypeScript types and improve performance'
);
```

### Debugging with Context

```typescript
const { debugIssue } = useStudio(config);

const solution = await debugIssue(
  'Maximum update depth exceeded',
  'Component has useEffect that depends on state it modifies'
);

console.log(solution.result); // Detailed fix explanation
```

### Complete Workflow

```typescript
function DeveloperWorkflow() {
  const studio = useStudio({
    gemini: { apiKey: process.env.REACT_APP_GEMINI_API_KEY },
  });

  const executeWorkflow = async () => {
    // 1. Generate from description
    const generated = await studio.generateComponent('User profile modal');

    if (generated.status === 'failed') {
      console.error(generated.error);
      return;
    }

    // 2. Analyze the generated code
    const analysis = await studio.analyzeCode(generated.result);
    console.log('Analysis:', analysis.result);

    // 3. Enhance with improvements
    const enhanced = await studio.enhanceCode(
      generated.result,
      'Add form validation and error handling'
    );

    // 4. Generate documentation
    const docs = await studio.generateDocumentation(enhanced.result);

    // 5. View history of all operations
    const history = studio.orchestrator.getHistory();
    console.log('Workflow tasks:', history);
  };

  return <button onClick={executeWorkflow}>Execute Workflow</button>;
}
```

## Environment Configuration

Create `.env.local`:

```bash
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

Or use `.env.ai-studio`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

## API Reference

### GeminiBridge

```typescript
new GeminiBridge(config: GeminiConfig)
```

- `prompt(message: string, imageUrl?: string): Promise<GeminiResponse>`
- `chat(messages: GeminiMessage[]): Promise<GeminiResponse>`
- `analyzeImage(imageUrl: string, prompt: string): Promise<GeminiResponse>`
- `clearHistory(): void`
- `getHistory(): GeminiMessage[]`

### StudioOrchestrator

```typescript
new StudioOrchestrator(config: StudioConfig)
```

- `generateComponent(description: string, imageUrl?: string): Promise<StudioTask>`
- `analyzeCode(code: string): Promise<StudioTask>`
- `enhanceCode(code: string, enhancement: string): Promise<StudioTask>`
- `debugIssue(error: string, context?: string): Promise<StudioTask>`
- `generateDocumentation(code: string): Promise<StudioTask>`
- `getTask(id: string): StudioTask | undefined`
- `getHistory(limit?: number): StudioTask[]`
- `clearHistory(): void`
- `getStatus(): Record<string, unknown>`

### useStudio Hook

```typescript
useStudio(config: StudioConfig)
```

Returns:
- `isReady: boolean`
- `tasks: StudioTask[]`
- `currentTask: StudioTask | null`
- `error: string | null`
- `generateComponent(description: string, imageUrl?: string): Promise<StudioTask>`
- `analyzeCode(code: string): Promise<StudioTask>`
- `enhanceCode(code: string, enhancement: string): Promise<StudioTask>`
- `debugIssue(error: string, context?: string): Promise<StudioTask>`
- `generateDocumentation(code: string): Promise<StudioTask>`
- `clearHistory(): void`
- `getStatus(): Record<string, unknown> | null`
- `orchestrator: StudioOrchestrator | null`

## Best Practices

1. **Handle Errors** - Always catch and display errors
2. **Show Progress** - Display task status to users
3. **Batch Operations** - Group related tasks
4. **Clear History** - Manage memory on long sessions
5. **Vision Context** - Provide images for better results
6. **Context in Debug** - Include relevant error context

## Performance Tips

- Vision analysis takes longer - cache results
- Batch multiple operations when possible
- Clear history periodically for long sessions
- Use appropriate model for task (flash for speed, pro for quality)

## Troubleshooting

**API Key Error**: Ensure REACT_APP_GEMINI_API_KEY is set  
**Vision Not Working**: Set `vision: true` in config  
**Slow Responses**: Try using lighter prompts or cached results  

## Integration with AI Studio

Works seamlessly with Google AI Studio for:
- Live preview integration
- Code generation feedback
- Real-time component testing
- Design-to-code workflow

## License

Part of the AI Studio application.

---

**Ready to build?** Start with the examples above or check the main [INTEGRATION_GUIDE.md](../../INTEGRATION_GUIDE.md).
