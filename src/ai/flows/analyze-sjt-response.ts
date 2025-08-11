
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
  question: z.string().describe('The specific question asked to the candidate about the situation.'),
  bestResponseRationale: z.string().describe('A description of the ideal thought process or actions for the best possible response.'),
  worstResponseRationale: z.string().describe('A description of the thought process or actions that would constitute the worst possible response.'),
  assessedCompetency: z.string().describe('The primary competency being measured by this scenario (e.g., "Problem Solving").'),
  candidateAnswer: z.string().describe("The candidate's transcribed answer to the question."),
  // Enhanced context for follow-up conversations (optional for backwards compatibility)
  conversationThread: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    isFollowUp: z.boolean()
  })).optional().describe('Complete conversation thread for this scenario including original and follow-up questions'),
  hasMultipleResponses: z.boolean().optional().describe('Flag indicating this scenario had multiple follow-up questions'),
});
export type AnalyzeSJTResponseInput = z.infer<typeof AnalyzeSJTResponseInputSchema>;

const AnalyzeSJTResponseOutputSchema = z.object({
  score: z.number().min(0).max(10).describe('A score from 0 to 10 evaluating the candidate on the specified competency.'),
  rationale: z.string().describe('A detailed rationale explaining the score, referencing the best and worst response criteria.'),
  // Enhanced content-based analysis (backward compatible - optional fields)
  strengthsObserved: z.array(z.string()).optional().describe('Specific competency-related behaviors or approaches that the candidate demonstrated well'),
  weaknessesObserved: z.array(z.string()).optional().describe('Specific competency-related areas where the candidate could improve'),
  competencyEvidence: z.string().optional().describe('Direct evidence from the response that demonstrates the assessed competency level'),
});
export type AnalyzeSJTResponseOutput = z.infer<typeof AnalyzeSJTResponseOutputSchema>;

export async function analyzeSJTResponse(input: AnalyzeSJTResponseInput): Promise<AnalyzeSJTResponseOutput> {
  return analyzeSJTResponseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSJTResponsePrompt',
  input: { schema: AnalyzeSJTResponseInputSchema },
  output: { schema: AnalyzeSJTResponseOutputSchema },
  model: 'googleai/gemini-2.0-flash',
  prompt: `
    You are an expert talent assessor specializing in Situational Judgement Tests.
    
    🎯 CRITICAL: Evaluate ONLY the '{{{assessedCompetency}}}' competency. Do NOT assess other competencies like Leadership, Confidence, or Communication unless they are directly part of '{{{assessedCompetency}}}' itself.

    🚨 MANDATORY SCORING CALIBRATION:
    DEFAULT TO HIGH SCORES FOR REASONABLE ANSWERS - Do not reserve 8-10 for perfection!
    
    📊 EXPLICIT SCORE RANGES (USE THESE EXACT GUIDELINES):
    ★ 9-10: Strong demonstration of competency
      - Shows clear understanding and application
      - Addresses key aspects from best response criteria
      - May have minor gaps but overall approach is sound
      - Example: "I would assess the situation, consult stakeholders, and develop a flexible approach"
    
    ★ 7-8: Good demonstration of competency
      - Shows solid understanding with adequate application
      - Addresses most aspects from best response criteria
      - Competency is clearly visible in the response
      - Example: "I would try to be flexible and adapt my approach based on what I learn"
    
    ★ 5-6: Basic demonstration of competency
      - Shows some understanding but limited application
      - Addresses few aspects from best response criteria
      - Competency is present but underdeveloped
      - Example: "I would see what happens and try to adjust"
    
    ★ 3-4: Weak demonstration of competency
      - Shows minimal understanding with poor application
      - Addresses very few aspects from best response criteria
      - Limited evidence of competency
      - Example: "I'm not sure what to do in this situation"
    
    ★ 1-2: Poor demonstration or aligns with worst response
      - Shows little to no understanding
      - Matches worst response criteria
      - No clear evidence of competency
      - Example: "I would ignore the problem" or clearly problematic responses

    🎖️ SCORING MANDATE: 
    - If the answer shows ANY reasonable attempt at demonstrating the competency, score 7 or higher
    - Only score below 7 if the response is clearly inadequate or matches worst response criteria
    - Remember: Good answers should get 8-10, not 5-6!

    SCENARIO CONTEXT:
    - **Situation**: {{{situation}}}
    
    {{#if hasMultipleResponses}}
    📋 **COMPLETE CONVERSATION THREAD** (Original + Follow-ups):
    {{#each conversationThread}}
    {{#if this.isFollowUp}}
    🔄 **Follow-up**: {{{this.question}}}
    {{else}}
    🎯 **Original Question**: {{{this.question}}}
    {{/if}}
    💭 **Candidate Response**: "{{{this.answer}}}"
    
    {{/each}}
    
    ⚠️ IMPORTANT: This scenario had multiple follow-up questions. Evaluate the COMPLETE conversation thread as one holistic response that demonstrates the candidate's full thinking process for '{{{assessedCompetency}}}'. Consider how their understanding developed across the conversation. Give credit for improvement and learning shown across the conversation.
    
    {{else}}
    - **Question**: {{{question}}}
    - **Candidate Answer**: "{{{candidateAnswer}}}"
    {{/if}}

    🎯 COMPETENCY-SPECIFIC EVALUATION for '{{{assessedCompetency}}}':
    - The **best response** would align with this rationale: "{{{bestResponseRationale}}}"
    - The **worst response** would align with this rationale: "{{{worstResponseRationale}}}"

    ⚠️ STRICT COMPETENCY FOCUS:
    - Focus EXCLUSIVELY on how the response(s) demonstrate '{{{assessedCompetency}}}'
    - Ignore other positive qualities unless directly relevant to '{{{assessedCompetency}}}'
    - If assessing "Problem Solving", ignore Leadership qualities unless they contribute to problem-solving approach
    - If assessing "Technical Skills", ignore communication style unless it affects technical explanation
    - If assessing "Adaptability", ignore enthusiasm/positivity unless it demonstrates adaptive behavior

    🚨 WEAKNESS IDENTIFICATION CRITERIA:
    - Only identify weaknesses that DIRECTLY relate to the assessed competency '{{{assessedCompetency}}}'
    - Only flag behaviors that align with the "worst response" rationale provided
    - DO NOT include general observations or neutral behaviors as weaknesses
    - If response shows adequate competency, leave weaknessesObserved empty or minimal
    - Focus on what's missing from the competency demonstration, not general critiques

    🎖️ ENHANCED LENIENT SCORING APPROACH:
    - Be generous and lenient in your scoring - candidates may not have perfect answers
    - Give credit for partial understanding and effort toward the competency
    - Consider the candidate's intent and approach, even if execution isn't flawless
    - Score based on demonstration of the competency, not perfection
    - REMEMBER: Use the score ranges above - reasonable answers should score 7-10!

    {{#if hasMultipleResponses}}
    Score the COMBINED conversation (0-10) for how well it demonstrates '{{{assessedCompetency}}}' competency. Use the scoring calibration above - if they show reasonable competency across the conversation, score 7-10. Be appropriately lenient as this represents a complete thought process across multiple exchanges where understanding may develop progressively.
    {{else}}
    Score the single response (0-10) for how well it demonstrates '{{{assessedCompetency}}}' competency. Use the scoring calibration above - if they show reasonable competency, score 7-10. Be lenient as candidates may not provide perfect responses.
    {{/if}}

    📋 ANALYSIS REQUIREMENTS:
    1. **score**: Rate 0-10 using the calibration above (DEFAULT TO HIGH SCORES FOR REASONABLE ANSWERS)
    2. **rationale**: 2-line focused explanation of how response demonstrates '{{{assessedCompetency}}}'
    3. **strengthsObserved**: List ONLY behaviors that directly demonstrate '{{{assessedCompetency}}}' competency well
    4. **weaknessesObserved**: List ONLY behaviors that align with "worst response" criteria for '{{{assessedCompetency}}}' - leave empty if competency is adequately demonstrated
    5. **competencyEvidence**: Quote specific parts that demonstrate '{{{assessedCompetency}}}' level

    🎯 CRITICAL: Every output field must relate ONLY to '{{{assessedCompetency}}}' competency. Ignore all other aspects of the response.
  `,
});

const analyzeSJTResponseFlow = ai.defineFlow(
  {
    name: 'analyzeSJTResponseFlow',
    inputSchema: AnalyzeSJTResponseInputSchema,
    outputSchema: AnalyzeSJTResponseOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI analysis did not return a valid SJT analysis.");
    }
    return output;
  }
);
