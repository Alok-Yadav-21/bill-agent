/**
 * AI assistant abstraction. Like receipts, the app depends on this interface,
 * not on n8n. n8n can orchestrate the agent loop, or you can call a model
 * provider directly — swap by env, no app changes.
 *
 *   Frontend -> Backend -> AiAssistant (interface) -> {n8n agent | direct LLM}
 *                                   |
 *                                   +-> aiTools (DB-backed, source of truth)
 */
import { aiTools, type ToolContext } from "./tools";

export interface AiQueryResult {
  answer: string;
  /** Structured tool outputs used to build the answer, for UI references. */
  references?: unknown;
}

export interface AiAssistant {
  readonly name: string;
  query(ctx: ToolContext, message: string): Promise<AiQueryResult>;
}

/**
 * Fallback assistant used when no LLM/n8n is configured. It maps a few common
 * questions straight onto the DB-backed tools so natural-language queries still
 * return REAL numbers with zero external dependency. This guarantees the core
 * "how much is left / spent / who spent most" flow never depends on n8n.
 */
export class LocalRuleAssistant implements AiAssistant {
  readonly name = "local";

  async query(ctx: ToolContext, message: string): Promise<AiQueryResult> {
    const q = message.toLowerCase();

    if (/(left|remaining|have.*left|balance|afford)/.test(q)) {
      const r = await aiTools.get_balance(ctx);
      return { answer: `Your available balance is ${r.availableBalance} (contributed ${r.totalContributed}, spent ${r.totalSpent}).`, references: r };
    }
    if (/(who spent|highest spender|most)/.test(q)) {
      const r = await aiTools.get_member_spending(ctx);
      const top = Array.isArray(r) ? r[0] : null;
      return {
        answer: top ? `${top.member} spent the most, with ${top.spent}.` : "No spending yet.",
        references: r,
      };
    }
    if (/(spent|spending|total|contributed)/.test(q)) {
      const r = await aiTools.get_balance(ctx);
      return { answer: `You've spent ${r.totalSpent} in total; the household has contributed ${r.totalContributed}.`, references: r };
    }
    return {
      answer:
        "I can answer questions about your budget, spending, members and categories. Try: \"How much is left?\"",
    };
  }
}

export function getAiAssistant(): AiAssistant {
  const provider = process.env.AI_ASSISTANT ?? "local";
  switch (provider) {
    // case "n8n":       return new N8nAiAssistant(process.env.N8N_AI_WEBHOOK_URL!, process.env.N8N_API_KEY!);
    // case "anthropic": return new AnthropicAssistant(process.env.AI_API_KEY!);
    case "local":
    default:
      return new LocalRuleAssistant();
  }
}
