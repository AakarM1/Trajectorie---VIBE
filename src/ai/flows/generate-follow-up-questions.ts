
'use server';
/**
 * @fileOverview Generates a set of interview questions for a given role.
 *
 * - generateInterviewQuestions - A function that generates interview questions.
 * - GenerateInterviewQuestionsInput - The input type for the function.
 * - GenerateInterviewQuestionsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInterviewQuestionsInputSchema = z.object({
  name: z.string().optional().describe('The name of the candidate.'),
  roleCategory: z.string().describe('The role category the candidate is applying for.'),
  jobDescription: z.string().optional().describe('The full job description for the role.'),
  numberOfQuestions: z.number().describe('The total number of questions to generate for the interview.'),
  isFollowUp: z.boolean().optional().describe('Whether these are follow-up questions or the start of an interview.'),
});
export type GenerateInterviewQuestionsInput = z.infer<typeof GenerateInterviewQuestionsInputSchema>;

const GenerateInterviewQuestionsOutputSchema = z.object({
  questions: z.array(z.string()).describe('An array of interview questions.'),
});
export type GenerateInterviewQuestionsOutput = z.infer<typeof GenerateInterviewQuestionsOutputSchema>;

export async function generateInterviewQuestions(input: GenerateInterviewQuestionsInput): Promise<GenerateInterviewQuestionsOutput> {
  return generateInterviewQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInterviewQuestionsPrompt',
  input: {schema: GenerateInterviewQuestionsInputSchema},
  output: {schema: GenerateInterviewQuestionsOutputSchema},
  model: 'googleai/gemini-2.0-flash',
  prompt: `You are an expert AI interviewer. Your task is to generate a set of {{numberOfQuestions}} diverse and insightful interview questions for a {{{roleCategory}}} role.
The questions should be based on the provided job description to assess the candidate's suitability.

**Job Description:**
"{{{jobDescription}}}"

{{#if isFollowUp}}
Generate {{numberOfQuestions}} follow-up questions that dig deeper into the skills and responsibilities mentioned. Do not include introductory questions like "tell me about yourself".
{{else}}
The first question should always be a friendly introduction. For example: "Hello {{#if name}}{{{name}}}{{else}}candidate{{/if}}, thank you for your interest in the {{{roleCategory}}} role. To start, please introduce yourself and tell me a bit about why you're applying for this position."
The subsequent questions should be varied and cover different aspects to holistically assess the candidate's suitability, such as behavioral examples, situational judgment, technical depth, and problem-solving skills relevant to the role and job description.
{{/if}}

Return exactly {{numberOfQuestions}} questions in the 'questions' array. Do not add any other commentary.
  `,
});

const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateInterviewQuestionsFlow',
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async (input: GenerateInterviewQuestionsInput): Promise<GenerateInterviewQuestionsOutput> => {
    const {output} = await prompt(input);
    if (output && output.questions && output.questions.length > 0) {
      return output;
    }
    // Fallback if AI fails
    const fallbackQuestions = [
      `Hello ${input.name || 'candidate'}, thank you for your interest in the ${input.roleCategory} role. To start, please introduce yourself and tell me a bit about why you're applying for this position.`,
      `Could you describe a challenging project you worked on and how you approached it?`,
      `What do you know about our company and this ${input.roleCategory} role?`,
      `Where do you see yourself in five years?`,
      `Do you have any questions for us?`,
    ];
    return { questions: fallbackQuestions.slice(0, input.numberOfQuestions) };
  }
);
