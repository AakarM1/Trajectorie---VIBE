
'use server';

/**
 * @fileOverview Analyzes a conversation for a given role, providing a qualitative report and quantitative competency scores.
 *
 * - analyzeConversation - A function that analyzes the conversation.
 * - AnalyzeConversationInput - The input type for the analyzeConversation function.
 * - AnalyzeConversationOutput - The return type for the analyzeConversation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  preferredAnswer: z.string().optional().describe("Guidance on what constitutes a good answer for this specific question."),
  competency: z.string().optional().describe("The competency this question is designed to assess."),
});

const AnalyzeConversationInputSchema = z.object({
  conversationHistory: z.array(QuestionAnswerSchema).describe('The history of the conversation, including questions, answers, and AI guidance.'),
  name: z.string().describe('The name of the candidate.'),
  roleCategory: z.string().describe('The role category the candidate applied for (e.g., Sales Manager, Software Engineer).'),
  jobDescription: z.string().optional().describe('The job description for the role.'),
});
export type AnalyzeConversationInput = z.infer<typeof AnalyzeConversationInputSchema>;


// Schema for individual competency scoring
const CompetencySchema = z.object({
  name: z.string().describe("The name of the competency, e.g., 'Problem Solving'."),
  score: z.number().min(0).max(10).describe("The score for the competency, from 0 to 10."),
});

// Schema for grouping competencies under a meta-competency
const MetaCompetencySchema = z.object({
  name: z.string().describe("The name of the meta-competency, e.g., 'Core Skills'."),
  competencies: z.array(CompetencySchema).describe("An array of competencies under this meta-competency."),
});

const AnalyzeConversationOutputSchema = z.object({
  strengths: z.string().describe("A paragraph detailing the candidate's key strengths, supported by specific examples from the conversation. This should be in natural language and not use lists or special characters."),
  weaknesses: z.string().describe("A paragraph detailing the candidate's areas for improvement or weaknesses, supported by specific examples from the conversation. This should be in natural language and not use lists or special characters."),
  summary: z.string().describe("An overall summary of the candidate's suitability and performance for the specified role, written in natural language without special characters."),
  competencyAnalysis: z.array(MetaCompetencySchema).describe("A detailed, scored analysis of various competencies, grouped by meta-competencies and sorted alphabetically.")
});
export type AnalyzeConversationOutput = z.infer<typeof AnalyzeConversationOutputSchema>;

export async function analyzeConversation(input: AnalyzeConversationInput): Promise<AnalyzeConversationOutput> {
  // Dynamically determine competencies from the input
  const uniqueCompetencies = [...new Set(input.conversationHistory.map(h => h.competency).filter(Boolean) as string[])];
  
  const augmentedInput = {
    ...input,
    competenciesToAssess: uniqueCompetencies.join(', '),
  };

  return analyzeConversationFlow(augmentedInput);
}

const prompt = ai.definePrompt({
  name: 'analyzeConversationPrompt',
  input: {schema: AnalyzeConversationInputSchema.extend({ competenciesToAssess: z.string() })},
  output: {schema: AnalyzeConversationOutputSchema},
  model: 'googleai/gemini-2.0-flash',
  prompt: `You are an expert AI hiring analyst for a top-tier recruitment firm. Your task is to evaluate a candidate named {{{name}}} for a {{{roleCategory}}} position based on the provided job description and interview transcript.

**Job Description Context:**
"{{{jobDescription}}}"

**Interview Transcript & Analysis Guidance:**
For each question, evaluate the candidate's response based on the specific guidance provided.

{{#each conversationHistory}}
---
**Question: {{{this.question}}}**
*AI Guidance for this question (Competency: {{{this.competency}}}):* The ideal answer should align with these characteristics: "{{{this.preferredAnswer}}}"

**Candidate's Answer:** "{{{this.answer}}}"
---
{{/each}}

ANALYSIS REQUIRED:

Based *only* on the conversation and guidance provided, provide the following analysis in the specified JSON format:

PART 1: QUALITATIVE REPORT
- **strengths**: A detailed paragraph identifying the key strengths demonstrated by {{{name}}}.
- **weaknesses**: A detailed paragraph identifying areas where {{{name}}} could improve based on their responses.
- **summary**: An overall summary of {{{name}}}'s suitability for the {{{roleCategory}}} role, considering the job description.
- **IMPORTANT**: For each section, use specific examples from the conversation to support your observations. Write in natural language using full sentences. Do NOT use bullet points or special characters.

PART 2: COMPETENCY ANALYSIS
- You must assess the candidate on the following competencies: {{{competenciesToAssess}}}.
- For each competency, derive a score from 0 (no evidence) to 10 (excellent evidence).
- Base your score *strictly* on how the candidate's answer for the corresponding question matches the provided AI guidance.
- Group all assessed competencies under a single meta-competency named "Job-Specific Competencies".
- The competencies within the group MUST be sorted alphabetically in the final output.

Return the entire analysis in the specified JSON format.
`,
});

const analyzeConversationFlow = ai.defineFlow(
  {
    name: 'analyzeConversationFlow',
    inputSchema: AnalyzeConversationInputSchema.extend({ competenciesToAssess: z.string() }),
    outputSchema: AnalyzeConversationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || !output.strengths || !output.weaknesses || !output.summary || !output.competencyAnalysis) {
      throw new Error("AI analysis did not return a valid structured report.");
    }
    return output;
  }
);
