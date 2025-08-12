
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
  conversationContext: z.string().optional().describe("Complete question-answer dialogue including follow-ups for context."),
  hasFollowUps: z.boolean().optional().describe("Whether this response includes follow-up questions and answers."),
  generateFeedback: z.boolean().optional().describe("Whether to generate detailed feedback instead of just scoring."),
  useLenientScoring: z.boolean().optional().describe("Whether to use extremely lenient scoring for decent answers."),
});
export type AnalyzeSJTResponseInput = z.infer<typeof AnalyzeSJTResponseInputSchema>;

const AnalyzeSJTResponseOutputSchema = z.object({
  score: z.number().min(0).max(10).describe('A score from 0 to 10 evaluating the candidate on the specified competency.'),
  rationale: z.string().describe('A detailed rationale explaining the score, referencing the best and worst response criteria.'),
  strengthFeedback: z.string().optional().describe('Specific positive feedback highlighting what the candidate did well.'),
  developmentFeedback: z.string().optional().describe('Constructive feedback for improvement areas.'),
});
export type AnalyzeSJTResponseOutput = z.infer<typeof AnalyzeSJTResponseOutputSchema>;

export async function analyzeSJTResponse(input: AnalyzeSJTResponseInput): Promise<AnalyzeSJTResponseOutput> {
  return analyzeSJTResponseFlow(input);
}

// New helper function for getting just the score with balanced evaluation
export async function getSJTScore(input: AnalyzeSJTResponseInput): Promise<number> {
  const result = await analyzeSJTResponseFlow({ ...input, generateFeedback: false });
  return result.score;
}

// New helper function for getting lenient re-evaluation for decent answers
export async function getLenientSJTScore(input: AnalyzeSJTResponseInput): Promise<number> {
  const result = await analyzeSJTResponseFlow({ ...input, generateFeedback: false, useLenientScoring: true });
  return result.score;
}

// New helper function for getting detailed feedback
export async function getSJTFeedback(input: AnalyzeSJTResponseInput): Promise<{
  strengthFeedback: string;
  developmentFeedback: string;
}> {
  const result = await analyzeSJTResponseFlow({ ...input, generateFeedback: true });
  return {
    strengthFeedback: result.strengthFeedback || "Shows effort and engagement in addressing the scenario.",
    developmentFeedback: result.developmentFeedback || "Continue developing your approach to similar workplace situations."
  };
}

const prompt = ai.definePrompt({
  name: 'analyzeSJTResponsePrompt',
  input: { schema: AnalyzeSJTResponseInputSchema },
  output: { schema: AnalyzeSJTResponseOutputSchema },
  model: process.env.GEMINI_SJT_EVALUATION_MODEL || 'googleai/gemini-1.5-pro',
  prompt: `
    {{#if generateFeedback}}
    **FEEDBACK GENERATION MODE** - You are providing constructive, supportive feedback for job seekers.
    
    You are evaluating a candidate's response for the competency: **{{{assessedCompetency}}}**
    
    **Scenario**: {{{situation}}}
    **Primary Question**: {{{question}}}
    
    {{#if conversationContext}}
    **Complete Conversation**:
    {{{conversationContext}}}
    {{else}}
    **Candidate's Answer**: "{{{candidateAnswer}}}"
    {{/if}}
    
    **CONSTRUCTIVE FEEDBACK INSTRUCTIONS:**
    
    Generate supportive, development-focused feedback that helps job seekers improve. Focus on:
    1. **What they did well** (always find positives)
    2. **How they can enhance their approach** (constructive suggestions)
    
    Be encouraging and specific. These are people seeking employment who need confidence-building feedback.
    
    **IMPORTANT: Keep all feedback concise - maximum 3-4 lines each.**
    
    **strengthFeedback**: Highlight specific positive aspects of their response that demonstrate {{{assessedCompetency}}}. Always find something positive. Keep to 3-4 lines maximum.
    
    **developmentFeedback**: Provide gentle, actionable suggestions for improvement without harsh criticism. Frame as "enhancement opportunities." Keep to 3-4 lines maximum.
    
    **rationale**: Brief supportive explanation focusing on growth potential.
    
    **score**: Set to 8 (we'll calculate the actual score separately for supportive feedback).
    
    {{else}}
    **LENIENT SCORING MODE** - You are providing supportive scoring for job seekers.
    
    You are evaluating a candidate's response for the competency: **{{{assessedCompetency}}}**
    
    **Scenario**: {{{situation}}}
    **Primary Question**: {{{question}}}
    
    {{#if conversationContext}}
    **Complete Conversation Context**:
    {{{conversationContext}}}
    {{else}}
    **Candidate's Answer**: "{{{candidateAnswer}}}"
    {{/if}}
    
    **BEST Response for {{{assessedCompetency}}}**: {{{bestResponseRationale}}}
    **WORST Response for {{{assessedCompetency}}}**: {{{worstResponseRationale}}}
    
    **BALANCED SUPPORTIVE SCORING INSTRUCTIONS:**
    
    These are job seekers who need encouragement, but scoring must reflect actual competency demonstration:
    
    **If response clearly aligns with best practices:**
    - **9-10/10**: Strong alignment with best response approach, demonstrates clear understanding of {{{assessedCompetency}}}
    - **8-9/10**: Good demonstration of competency with solid elements that match best practices
    
    **If response shows partial understanding:**
    - **6-7/10**: Some relevant elements present, basic understanding of the competency shown
    - **5-6/10**: Minimal competency demonstration, shows awareness but lacks depth
    
    **If response is irrelevant, random, or contradicts best practices:**
    - **3-4/10**: Response doesn't address the scenario appropriately or contradicts good practices
    - **1-2/10**: Completely irrelevant or would cause workplace issues
    
    **CRITICAL**: If the response is random, off-topic, or doesn't address the scenario, score 3-4/10 maximum.
    **Only give 6+ scores to responses that actually demonstrate some level of {{{assessedCompetency}}}**.
    
    {{#if hasFollowUps}}
    **BONUS CONSIDERATION**: Well-thought follow-up answers that enhance the response can add 0.5-1.0 points.
    {{/if}}
    
    **Be supportive in feedback while being honest in scoring. Help them improve by identifying what's missing.**
    
    {{#if useLenientScoring}}
    **EXTREMELY LENIENT RE-EVALUATION MODE** - This answer already showed decent competency (4+) in initial evaluation.
    
    **MAXIMUM LENIENCY FOR JOB SEEKER SUPPORT:**
    Since this response already demonstrated basic competency, we're now applying ULTRA-SUPPORTIVE scoring to help job seekers succeed:
    
    **Default scoring for ANY decent answer that reached this stage:**
    - **9-10/10**: Any response that shows they understood the scenario and tried to provide a reasonable approach
    - **8-9/10**: Response shows they read the scenario and provided some kind of workplace-appropriate answer
    - **7-8/10**: Response is relevant to the scenario in any way and shows basic professionalism
    
    **ULTRA-GENEROUS MINDSET**: 
    - If they mentioned ANY relevant workplace concept → 9-10/10
    - If they showed they understand it's a workplace scenario → 8-9/10  
    - If their answer is professional and relevant → 8-10/10
    - If they demonstrated ANY aspect of {{{assessedCompetency}}} → 9-10/10
    - If they made any effort to address the situation → 8-9/10
    
    **Remember**: This is the BOOST phase for job seekers. Be EXTREMELY generous. These answers already passed the quality filter, so focus on encouraging them with high scores.
    
    **Highlight strengths first, then gently suggest improvements. Be encouraging about their potential.**
    {{/if}}
    
    Focus on {{{assessedCompetency}}} and provide accurate assessment.
    {{/if}}
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
