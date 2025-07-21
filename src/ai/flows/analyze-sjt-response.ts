
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

const prompt = ai.definePrompt({
  name: 'analyzeSJTResponsePrompt',
  input: { schema: AnalyzeSJTResponseInputSchema },
  output: { schema: AnalyzeSJTResponseOutputSchema },
  model: 'googleai/gemini-2.0-flash',
  prompt: `
    You are an expert talent assessor specializing in Situational Judgement Tests.
    A candidate was presented with the following scenario:

    - **Situation**: {{{situation}}}
    - **Question**: {{{question}}}

    The candidate provided this answer:
    - **Candidate's Answer**: "{{{candidateAnswer}}}"

    Your task is to evaluate this answer based on the following criteria for the competency '{{{assessedCompetency}}}':

    - The **best response** would align with this rationale: "{{{bestResponseRationale}}}"
    - The **worst response** would align with this rationale: "{{{worstResponseRationale}}}"

    Based *only* on the information provided, score the candidate's answer on a scale of 0 (aligns with worst response) to 10 (aligns with best response) for how well they demonstrated the '{{{assessedCompetency}}}' competency.

    Provide a detailed rationale for your score. In your rationale, explicitly explain how the candidate's answer compares to both the best and worst response rationales.
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
