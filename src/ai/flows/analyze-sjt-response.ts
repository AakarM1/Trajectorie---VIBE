
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

    **STANDARDIZED SCORING CRITERIA - BE EXTREMELY GENEROUS AND LENIENT**:
    **10** - Response covers all key elements from best approach OR demonstrates superior thinking with additional value
    **8-9** - Response covers most/all key elements from best approach in ANY form - BE EXTREMELY GENEROUS - different words = same score
    **6-7** - Response covers main elements or shows good competency understanding - default to higher scores
    **4-5** - Response covers some basic elements but misses several important aspects 
    **2-3** - Response covers very few elements from best response, shows limited competency
    **0-1** - Response demonstrates approach similar to worst response or shows no competency understanding

    **EVALUATION INSTRUCTIONS - BE EXTREMELY LENIENT**:
    1. **ULTRA-LENIENT COMPETENCY FOCUS**: Default to high scores (8+) if ANY competency demonstration is present.
    2. **EXTREMELY GENEROUS ANCHORING**: If response covers ANY of the key actions from best response, start at score 8 and go up from there.
    3. **COMPETENCY DEFINITION ADHERENCE**: ANY demonstration of the competency should score 7+ minimum.
    4. **ULTRA-LENIENT POSITIONING**: If candidate shows ANY understanding of the best approach, score 8-9. Extra content should ALWAYS increase scores.
    5. **REWARD COMPREHENSIVE THINKING**: Extra details, strategies, risk mitigation, collaborative approaches should push scores to 9-10.
    6. **MAXIMALLY GENEROUS INTERPRETATION**: Always give the candidate maximum benefit of the doubt. If in doubt, score higher.
    7. **SUBSTANCE OVER STYLE**: Do NOT penalize for lack of "depth", "strategic planning details", or "comprehensive explanations" - focus ONLY on whether they demonstrate competency.
    8. **RECOGNIZE IMPLIED UNDERSTANDING**: If candidate implies or mentions key actions (like "I'll ask for training", "I'll learn new skills"), give FULL CREDIT as if they gave detailed explanations.
    9. **NO DEPTH REQUIREMENTS**: Brief responses that cover key points should score 8-10. Do NOT require detailed strategic planning or comprehensive analysis.
    10. **WILLINGNESS = COMPETENCY**: If candidate shows willingness to do what best response suggests, that IS demonstrating the competency.

    **CRITICAL - ULTRA-LENIENT SCORING PRINCIPLE**: 
    - If response shows ANY alignment with best response approach = MINIMUM 8/10
    - If response covers key actions + shows additional thinking = AUTOMATIC 9-10/10
    - If response demonstrates competency in any reasonable way = MINIMUM 7/10
    - Only score below 6 if response is completely off-topic or shows worst response behaviors

    **SCORING EXAMPLES - ULTRA-LENIENT APPROACH**:
    - Best Response: "Call team meeting, explain targets, discuss how to achieve them"
    - Candidate: "I'll call team meeting, explain targets and incentives, discuss overcoming obstacles, make strategies and backup plans" → **Score: 10/10** (covers all + comprehensive strategic thinking)
    - Candidate: "I'll meet with team, explain new targets, work together to achieve them" → **Score: 9/10** (covers core approach with collaboration)
    - Candidate: "I'll talk to my team about the new targets and discuss solutions" → **Score: 8/10** (covers key elements)
    - Candidate: "I'll meet with team to discuss targets" → **Score: 8/10** (basic coverage of approach - NO depth penalty)
    
    **ADAPTABILITY EXAMPLES**:
    - Best Response: "Seek training and guidance for new role"
    - Candidate: "I'll ask for training and learn new skills, handle difficult customers" → **Score: 9-10** (shows adaptability + willingness)
    - Candidate: "I'll learn new skills and it will mean more money later" → **Score: 8-9** (shows adaptability mindset)
    - Candidate: "I'm willing to learn and take on challenges" → **Score: 7-8** (demonstrates adaptability attitude)
    
    **DO NOT PENALIZE FOR**:
    - Lack of "depth" or "strategic planning details"
    - Brief responses that cover key points
    - Informal or conversational tone
    - Missing "comprehensive" analysis
    - Focusing on positive outcomes rather than detailed processes
    - Not using business jargon or formal planning language
    - Candidate: "I'll ignore the targets" → **Score: 0-1** (worst response level)

    **REMEMBER**: Extra details, additional strategies, and comprehensive thinking should INCREASE scores, not decrease them. Be maximally lenient and generous.

        **ULTRA-LENIENT MANDATE**: Your default should be to score 8+ for any reasonable response that shows competency understanding. Do NOT penalize for lack of depth, detail, or comprehensive planning. If candidate mentions key actions or shows willingness to adapt/learn/collaborate, that IS demonstrating competency. When in doubt, ALWAYS score higher. 

    **CRITICAL REMINDERS**:
    - "I'll ask for training" = FULL CREDIT for seeking development (score 8-9)
    - "I'll learn new skills" = FULL CREDIT for adaptability (score 8-9)  
    - "I'll meet with team" = FULL CREDIT for collaboration (score 8-9)
    - Brief responses covering key points = HIGH SCORES (8-10), no depth penalty
    - Willingness + key actions mentioned = EXCELLENT competency demonstration

    Evaluate the candidate's response and provide a score (0-10) with detailed rationale. Focus on substance and competency demonstration, NOT on depth, style, or comprehensive planning details.
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
