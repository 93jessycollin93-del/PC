import React, { useState } from 'react';
import { ChevronUp, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative z-[3000]">
      {/* Collapsible Footer — expands upward above the bottom bar */}
      <div className="pointer-events-auto">
        {isExpanded ? (
          <div className="absolute bottom-full left-0 mb-2 w-[320px] max-w-[90vw] max-h-[60vh] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-300"
            >
              <ChevronUp size={16} />
            </button>

            <div className="pr-6 space-y-3">
              <div className="text-xs text-zinc-400 space-y-2">
                <p className="font-bold text-zinc-300">PC OS Credits & Licensing</p>

                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-zinc-300 text-[10px]">AI & Machine Learning</p>
                    <ul className="text-[9px] text-zinc-400 space-y-1 ml-2">
                      <li>• <strong>Anthropic</strong> - Claude AI Assistant ({`www.anthropic.com`})</li>
                      <li>• <strong>Google</strong> - Gemini API, Material Design ({`www.google.com`})</li>
                      <li>• <strong>OpenAI</strong> - Reference implementations ({`www.openai.com`})</li>
                      <li>• <strong>Meta (Facebook)</strong> - LLAMA Models ({`www.meta.com`})</li>
                      <li>• <strong>DeepSeek</strong> - Code Models ({`www.deepseek.com`})</li>
                      <li>• <strong>Groq</strong> - Fast Inference ({`www.groq.com`})</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-zinc-300 text-[10px]">Frontend & UI Frameworks</p>
                    <ul className="text-[9px] text-zinc-400 space-y-1 ml-2">
                      <li>• <strong>React</strong> - UI Library ({`react.dev`})</li>
                      <li>• <strong>TypeScript</strong> - Type Safety ({`www.typescriptlang.org`})</li>
                      <li>• <strong>Tailwind CSS</strong> - Utility-First CSS ({`tailwindcss.com`})</li>
                      <li>• <strong>Vite</strong> - Build Tool ({`vitejs.dev`})</li>
                      <li>• <strong>Lucide</strong> - Icons ({`lucide.dev`})</li>
                      <li>• <strong>Framer Motion</strong> - Animation ({`www.framer.com`})</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-zinc-300 text-[10px]">Backend & Infrastructure</p>
                    <ul className="text-[9px] text-zinc-400 space-y-1 ml-2">
                      <li>• <strong>Firebase</strong> - Auth & Database ({`firebase.google.com`})</li>
                      <li>• <strong>Vercel</strong> - Hosting & Deployment ({`www.vercel.com`})</li>
                      <li>• <strong>Node.js</strong> - Runtime ({`nodejs.org`})</li>
                      <li>• <strong>Express</strong> - Web Framework ({`expressjs.com`})</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-zinc-300 text-[10px]">Developer Tools & Libraries</p>
                    <ul className="text-[9px] text-zinc-400 space-y-1 ml-2">
                      <li>• <strong>GitHub</strong> - Version Control ({`github.com`})</li>
                      <li>• <strong>ESLint</strong> - Code Linting ({`eslint.org`})</li>
                      <li>• <strong>Prettier</strong> - Code Formatting</li>
                      <li>• <strong>GSAP</strong> - Animation Library ({`gsap.com`})</li>
                      <li>• <strong>Ollama</strong> - Local LLM Runner ({`ollama.ai`})</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-zinc-300 text-[10px]">Development & Orchestration</p>
                    <ul className="text-[9px] text-zinc-400 space-y-1 ml-2">
                      <li>• <strong>Replit Agent</strong> - In-repl AI build & orchestration partner ({`replit.com`})</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-zinc-300 text-[10px]">Legal Notice</p>
                    <p className="text-[9px] text-zinc-400 ml-2">
                      PC OS is built on open-source and commercial technologies. All third-party components are used under their respective licenses (MIT, Apache 2.0, BSD, etc.). Proper attribution and license compliance are maintained throughout this project.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-full hover:bg-zinc-900/80"
          >
            <span>Credits</span>
            <ChevronUp size={10} className="rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
};
