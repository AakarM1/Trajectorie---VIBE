
'use server';
/**
 * @fileOverview A Genkit flow to analyze a candidate's response to a Situational Judgement Test (SJT) scenario.
 * Updated to focus on competency demonstration rather than checklist matching for more accurate assessment.
 *
 * - analyzeSJTResponse - A function that evaluates a candidate's answer against competency standards.
 * - AnalyzeSJTResponseInput - The input type for the analyzeSJTResponse function.
 * - AnalyzeSJTResponseOutput - The return type for the analyzeSJTResponse function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { translateToEnglish, type TranslateToEnglishOutput } from './translate-text';
import { getCompetencyDefinition, type CompetencyDefinition } from '@/lib/competency-definitions';

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
  competencyDefinition: z.string().optional().describe('The standardized definition of the competency being evaluated.'),
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
  model: process.env.GEMINI_SJT_EVALUATION_MODEL || 'googleai/gemini-2.0-flash-lite', // Use 2.0 Flash-Lite for better availability and performance
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
    **COMPETENCY DEFINITION**: {{{competencyDefinition}}}

    **EVALUATION ANCHORS**:
    - **BEST response approach** (Score: 10): {{{bestResponseRationale}}}
    - **WORST response approach** (Score: 0-1): {{{worstResponseRationale}}}

    **STANDARDIZED SCORING CRITERIA**:
    **10** - Response demonstrates competency at the level of the BEST approach
    **8-9** - Strong competency demonstration, clearly professional and effective  
    **6-7** - Good competency understanding with appropriate professional approach
    **4-5** - Basic competency awareness but with gaps or limited effectiveness
    **2-3** - Poor competency demonstration, approaching worst response behaviors
    **0-1** - Response demonstrates competency at the level of the WORST approach or shows no competency understanding

    **EVALUATION INSTRUCTIONS**:
    1. **STRICT COMPETENCY FOCUS**: Judge the response ONLY against the competency definition provided above. Do not consider any other criteria.
    2. **BEST/WORST ANCHORING**: Use the best response as your "10" anchor and worst response as your "0-1" anchor. Score based on where the candidate falls on this spectrum.
    3. **COMPETENCY DEFINITION ADHERENCE**: The response must demonstrate the specific elements described in the competency definition to score well.
    4. **RELATIVE POSITIONING**: If the response is similar to the BEST approach, score 8-10. If similar to WORST approach, score 0-3. Everything else falls in between based on competency strength.
    5. **IGNORE NON-COMPETENCY FACTORS**: Communication style, specific phrases, minor details are irrelevant - focus purely on competency demonstration.

    **CRITICAL**: Base your score strictly on how well the response demonstrates the competency definition, using the best/worst responses as anchoring points for the 0-10 scale. If a response matches the best approach quality, it should score 10. If it matches the worst approach quality, it should score 0-1.

    Evaluate the candidate's response and provide a score (0-10) with detailed rationale.
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
    
    // Get standardized competency definition
    const competencyDefinition = getCompetencyDefinition(input.assessedCompetency);
    const competencyDefinitionText = competencyDefinition 
      ? competencyDefinition.description
      : `Generic competency evaluation for "${input.assessedCompetency}" - no standardized definition available.`;
    
    // Preprocess candidate responses to ensure they're in English for consistent analysis
    let processedInput = { 
      ...input,
      competencyDefinition: competencyDefinitionText
    };
    
    try {
      // Handle conversation history - translate all answers to English
      if (input.conversationHistory && input.conversationHistory.length > 0) {
        const translatedHistory = await Promise.all(
          input.conversationHistory.map(async (entry) => {
            if (entry.answer && entry.answer.trim()) {
              try {
                const translation = await translateToEnglish({ text: entry.answer });
                return {
                  ...entry,
                  answer: translation.translatedText
                };
              } catch (translationError) {
                console.warn('Failed to translate conversation entry, using original:', translationError);
                return entry; // Fallback to original
              }
            }
            return entry;
          })
        );
        processedInput.conversationHistory = translatedHistory;
      }
      
      // Handle legacy single candidateAnswer - translate to English
      if (input.candidateAnswer && input.candidateAnswer.trim()) {
        try {
          const translation = await translateToEnglish({ text: input.candidateAnswer });
          processedInput.candidateAnswer = translation.translatedText;
        } catch (translationError) {
          console.warn('Failed to translate candidate answer, using original:', translationError);
          // Fallback to original answer if translation fails
        }
      }
    } catch (preprocessError) {
      console.warn('Response preprocessing failed, using original input:', preprocessError);
      // Continue with original input if preprocessing fails entirely
    }
    
    // Enhanced retry logic for overloaded API and rate limits
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { output } = await prompt(processedInput);
        if (!output) {
          throw new Error("AI analysis did not return a valid SJT analysis.");
        }
        
        // Log competency standardization info
        if (competencyDefinition) {
          console.log(`✅ Used standardized definition for "${input.assessedCompetency}"`);
        } else {
          console.warn(`⚠️ No standardized definition found for "${input.assessedCompetency}" - using generic evaluation`);
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
