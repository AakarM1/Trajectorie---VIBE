'use server';
/**
 * @fileOverview A Genkit flow to analyze a complete SJT scenario conversation.
 * This analyzes an entire scenario conversation (including follow-ups) for comprehensive assessment.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ConversationEntrySchema = z.object({
  question: z.string().describe('The question asked to the candidate'),
  answer: z.string().describe('The candidate\'s response'),
  isFollowUp: z.boolean().optional().describe('Whether this is a follow-up question')
});

const AnalyzeSJTScenarioInputSchema = z.object({
  situation: z.string().describe('The workplace scenario that was presented to the candidate'),
  conversationHistory: z.array(ConversationEntrySchema).describe('The complete conversation for this scenario'),
  bestResponseRationale: z.string().describe('A description of the ideal thought process or actions for the best possible response'),
  worstResponseRationale: z.string().describe('A description of the thought process or actions that would constitute the worst possible response'),
  assessedCompetencies: z.array(z.string()).describe('The competencies being measured by this scenario')
});

export type AnalyzeSJTScenarioInput = z.infer<typeof AnalyzeSJTScenarioInputSchema>;

const CompetencyScoreSchema = z.object({
  competency: z.string().describe('The name of the competency'),
  score: z.number().min(0).max(10).describe('A score from 0 to 10 evaluating the candidate on this competency'),
  rationale: z.string().describe('A detailed rationale explaining the score for this competency')
});

const AnalyzeSJTScenarioOutputSchema = z.object({
  competencyScores: z.array(CompetencyScoreSchema).describe('Scores for each assessed competency'),
  conversationQuality: z.enum(['Poor', 'Fair', 'Good', 'Excellent']).describe('Overall quality of the conversation'),
  overallAssessment: z.string().describe('A comprehensive assessment of the candidate\'s performance in this scenario')
});

export type AnalyzeSJTScenarioOutput = z.infer<typeof AnalyzeSJTScenarioOutputSchema>;

export async function analyzeSJTScenario(input: AnalyzeSJTScenarioInput): Promise<AnalyzeSJTScenarioOutput> {
  return analyzeSJTScenarioFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSJTScenarioPrompt',
  input: { schema: AnalyzeSJTScenarioInputSchema },
  output: { schema: AnalyzeSJTScenarioOutputSchema },
  model: 'googleai/gemini-1.5-flash', // Use flash model for better availability
  prompt: `
    You are an expert talent assessor specializing in Situational Judgement Tests.
    A candidate was presented with the following scenario and engaged in a complete conversation:

    **Situation**: {{{situation}}}

    **Complete Conversation**:
    {{#each conversationHistory}}
    Q{{@index}}: {{question}} {{#if isFollowUp}}(Follow-up){{/if}}
    A{{@index}}: {{answer}}
    
    {{/each}}

    Your task is to evaluate this complete conversation across the following competencies: {{#each assessedCompetencies}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

    **Evaluation Criteria**:
    - The **best response** would align with this rationale: "{{{bestResponseRationale}}}"
    - The **worst response** would align with this rationale: "{{{worstResponseRationale}}}"

    **Important Instructions**:
    1. Consider the ENTIRE conversation as a cohesive response, not individual answers in isolation
    2. Evaluate how well the candidate's overall approach demonstrates each competency
    3. Consider how follow-up responses build upon or clarify initial responses
    4. Look for consistency, depth, and development of ideas across the conversation
    5. Score each competency based on the complete conversation context

    For each competency, provide:
    - A score from 0 (aligns with worst response) to 10 (aligns with best response)
    - A detailed rationale explaining how the complete conversation demonstrates (or fails to demonstrate) this competency

    Also assess the overall conversation quality and provide a comprehensive assessment of the candidate's performance.
  `,
});

const analyzeSJTScenarioFlow = ai.defineFlow(
  {
    name: 'analyzeSJTScenarioFlow',
    inputSchema: AnalyzeSJTScenarioInputSchema,
    outputSchema: AnalyzeSJTScenarioOutputSchema,
  },
  async (input) => {
    let lastError;
    
    // Retry logic for overloaded API
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { output } = await prompt(input);
        if (!output) {
          throw new Error("AI analysis did not return a valid SJT scenario analysis.");
        }
        return output;
      } catch (error: any) {
        lastError = error;
        
        // If it's a 503 (overloaded) error, wait and retry
        if (error.status === 503 && attempt < 3) {
          console.log(`⏳ API overloaded, retrying in ${attempt * 2} seconds (attempt ${attempt}/3)...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        
        // For other errors or final attempt, throw
        throw error;
      }
    }
    
    throw lastError;
  }
);