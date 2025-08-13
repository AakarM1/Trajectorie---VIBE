
'use server';
/**
 * @fileOverview A Genkit flow to analyze a candidate's response to a Situational Judgement Test (SJT) scenario.
 *
 * - analyzeSJTResponse - A function that evaluates a candidate's answer against ideal responses.
 * - AnalyzeSJTResponseInput - The input type for the analyzeSJTResponse function.
 * - AnalyzeSJTResponseOutput - The return type for the analyzeSJTResponse function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeSJTResponseInputSchema = z.object({
  situation: z.string().describe('The workplace scenario that was presented to the candidate.'),
  question: z.string().optional().describe('The specific question asked to the candidate about the situation (for backward compatibility).'),
  conversationHistory: z.array(z.object({
    question: z.string(),
    answer: z.string(), 
    isFollowUp: z.boolean().optional()
  })).optional().describe('Complete conversation history for the scenario (preferred over single question).'),
  bestResponseRationale: z.string().describe('A description of the ideal thought process or actions for the best possible response.'),
  worstResponseRationale: z.string().describe('A description of the thought process or actions that would constitute the worst possible response.'),
  assessedCompetency: z.string().describe('The primary competency being measured by this scenario (e.g., "Problem Solving").'),
  candidateAnswer: z.string().optional().describe("The candidate's transcribed answer to the question (for backward compatibility)."),
});
export type AnalyzeSJTResponseInput = z.infer<typeof AnalyzeSJTResponseInputSchema>;

const AnalyzeSJTResponseOutputSchema = z.object({
  score: z.number().min(0).max(10).describe('A score from 0 to 10 evaluating the candidate on the specified competency.'),
  rationale: z.string().describe('A detailed rationale explaining the score, referencing the best and worst response criteria.'),
});
export type AnalyzeSJTResponseOutput = z.infer<typeof AnalyzeSJTResponseOutputSchema>;

export async function analyzeSJTResponse(input: AnalyzeSJTResponseInput): Promise<AnalyzeSJTResponseOutput> {
  return analyzeSJTResponseFlow(input);
}

// Enhanced function for conversation-based single competency analysis
export async function analyzeSingleCompetency(input: {
  situation: string;
  conversationHistory: Array<{
    question: string;
    answer: string;
    isFollowUp?: boolean;
  }>;
  targetCompetency: string;
  bestResponseRationale: string;
  worstResponseRationale: string;
}): Promise<AnalyzeSJTResponseOutput> {
  return analyzeSJTResponseFlow({
    situation: input.situation,
    conversationHistory: input.conversationHistory,
    bestResponseRationale: input.bestResponseRationale,
    worstResponseRationale: input.worstResponseRationale,
    assessedCompetency: input.targetCompetency,
  });
}

const prompt = ai.definePrompt({
  name: 'analyzeSJTResponsePrompt',
  input: { schema: AnalyzeSJTResponseInputSchema },
  output: { schema: AnalyzeSJTResponseOutputSchema },
  model: process.env.GEMINI_SJT_EVALUATION_MODEL || 'googleai/gemini-1.5-flash', // Use flash for better availability
  prompt: `
    You are an expert talent assessor specializing in Situational Judgement Tests.
    A candidate was presented with the following scenario:

    **Situation**: {{{situation}}}

    **Complete Conversation**:
    {{#if conversationHistory}}
    {{#each conversationHistory}}
    Q{{@index}}: {{question}} {{#if isFollowUp}}(Follow-up){{/if}}
    A{{@index}}: {{answer}}
    
    {{/each}}
    {{else}}
    **Question**: {{{question}}}
    **Candidate's Answer**: "{{{candidateAnswer}}}"
    {{/if}}

    **COMPETENCY BEING EVALUATED**: {{{assessedCompetency}}}

    **REFERENCE RESPONSES**:
    - **BEST response approach**: {{{bestResponseRationale}}}
    - **WORST response approach**: {{{worstResponseRationale}}}

    **SCORING RUBRIC for {{{assessedCompetency}}} - BE LENIENT AND GENEROUS**:
    10 - Perfect match: Response ideas/approach perfectly align with best response for {{{assessedCompetency}}}
    8-9 - Strong match: Got the core idea correct, best response approach clearly demonstrated for {{{assessedCompetency}}} 
    6-7 - Good match: Shows understanding of {{{assessedCompetency}}}, partially matches best response approach
    4-5 - Partial match: Some relevant points for {{{assessedCompetency}}}, shows basic understanding
    2-3 - Limited match: Minimal demonstration of {{{assessedCompetency}}}, closer to worst response
    1 - Poor match: Response ideas align with worst response for {{{assessedCompetency}}}
    0 - No response: No answer provided or completely unrelated to scenario

    **CRITICAL INSTRUCTIONS - BE GENEROUS WITH SCORING**:
    1. FOCUS ONLY ON: How the response demonstrates {{{assessedCompetency}}}
    2. IGNORE: Communication style, confidence levels, speech patterns, "umm/uhh", other competencies not being evaluated
    3. BE LENIENT: If the response shows understanding and effort, score generously (6+ range)
    4. EVALUATE: Idea alignment with best vs worst response approaches for {{{assessedCompetency}}} specifically  
    5. SCORE GENEROUSLY: Err on the side of higher scores when response shows competency understanding

    Score the candidate's response (0-10) and provide a detailed rationale explaining how their approach aligns with the best/worst responses for {{{assessedCompetency}}}.
  `,
});

const analyzeSJTResponseFlow = ai.defineFlow(
  {
    name: 'analyzeSJTResponseFlow',
    inputSchema: AnalyzeSJTResponseInputSchema,
    outputSchema: AnalyzeSJTResponseOutputSchema,
  },
  async (input) => {
    let lastError;
    
    // Enhanced retry logic for overloaded API and rate limits
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { output } = await prompt(input);
        if (!output) {
          throw new Error("AI analysis did not return a valid SJT analysis.");
        }
        return output;
      } catch (error: any) {
        lastError = error;
        
        // Handle both 503 (overloaded) and 429 (rate limit) errors
        if ((error.status === 503 || error.status === 429) && attempt < 3) {
          const waitTime = error.status === 429 ? attempt * 1500 : attempt * 1000; // Reduced from 3000/2000 to 1500/1000
          console.log(`⏳ API ${error.status === 429 ? 'rate limited' : 'overloaded'}, retrying in ${waitTime/1000} seconds (attempt ${attempt}/3)...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // For other errors or final attempt, throw
        throw error;
      }
    }
    
    throw lastError;
  }
);
