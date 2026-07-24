import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');

describe('AI prompt export UI', () => {
  it('adds an explicit menu action and modal without any AI API endpoint', () => {
    expect(html).toContain('id="openAiPromptGenerator"');
    expect(html).toContain('KI-Prompt erstellen');
    expect(html).toContain('id="aiPromptModal"');
    expect(html).toContain('id="aiPromptOutput"');
    expect(html).toContain('id="copyAiPrompt"');
    expect(html).toContain('id="downloadAiPrompt"');
    expect(ui).toContain("from './ai-prompt-generator.js'");
    expect(ui).toContain('copyTextToClipboard');
    expect(ui).toContain('document.execCommand');
    expect(ui).toContain('window.isSecureContext');
    expect(ui).toContain('manuell mit Strg/Cmd+C');
    expect(ui).not.toMatch(/api\.openai|chatgpt|copilot\.microsoft|anthropic|gemini/i);
  });

  it('documents the copy-only privacy model and public llm context file', () => {
    const llm = readFileSync('llm.txt', 'utf8');
    const llms = readFileSync('llms.txt', 'utf8');
    const docs = readFileSync('docs/ai-prompts.md', 'utf8');
    expect(llm).toContain('Szenarienrechner-EOG');
    expect(llm).toContain('EOG-Wirkung ist nicht gleich Cashflow');
    expect(llm).toContain('Arbeitsstand hinterfragen');
    expect(llm).toContain('KAnEu-/Ist-Kosten-Behandlung');
    expect(llms).toContain('llm.txt');
    expect(docs).toContain('KI-Prompt erstellen');
    expect(docs).toContain('keine automatische Übertragung');
    expect(docs).toContain('Arbeitsstand hinterfragen');
    expect(docs).toContain('Stilllegung, Rückbau, Rückstellungen');
  });
});
