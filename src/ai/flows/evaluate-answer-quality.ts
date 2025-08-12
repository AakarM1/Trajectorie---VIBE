'use server';
/**
 * @fileOverview Evaluates the quality of a candidate's answer to determine if follow-up questions are needed.
 *
 * - evaluateAnswerQuality - A function that evaluates a candidate's answer quality and generates follow-up questions if needed.
 * - EvaluateAnswerQualityInput - The input type for the function.
 * - EvaluateAnswerQualityOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluateAnswerQualityInputSchema = z.object({
  situation: z.string().describe('The workplace scenario that was presented to the candidate.'),
  question: z.string().describe('The specific question asked to the candidate about the situation.'),
  bestResponseRationale: z.string().describe('How much it matches the description of the best possible response or its key elements.'),
  assessedCompetency: z.string().describe('The main competency being measured by this scenario (e.g., "Problem Solving").'),
  candidateAnswer: z.string().describe("The candidate's transcribed answer to the question."),
  questionNumber: z.number().describe("The number of the main question (e.g. 1, 2, etc.)"),
  followUpCount: z.number().describe("The current number of follow-up questions that have been asked for this scenario."),
  maxFollowUps: z.number().describe("The maximum number of follow-up questions allowed per scenario."),
});
export type EvaluateAnswerQualityInput = z.infer<typeof EvaluateAnswerQualityInputSchema>;

const EvaluateAnswerQualityOutputSchema = z.object({
  isComplete: z.boolean().describe('Whether the answer matches the ideal response criteria, or if a follow-up question is needed.'),
  completionScore: z.number().min(0).max(10).describe('A score (lenient) from 0-10 indicating how complete and thorough the answer is.'),
  missingAspects: z.array(z.string()).describe('Key aspects that are missing from the candidate\'s answer (eg. did not answer based on the ideal response criteria or completely unrelated).'),
  followUpQuestion: z.string().optional().describe('A follow-up question to ask if the answer is not complete.'),
  rationale: z.string().describe('Explanation for why the answer is complete or incomplete and why a follow-up was generated.'),
});
export type EvaluateAnswerQualityOutput = z.infer<typeof EvaluateAnswerQualityOutputSchema>;

export async function evaluateAnswerQuality(input: EvaluateAnswerQualityInput): Promise<EvaluateAnswerQualityOutput> {
  return evaluateAnswerQualityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateAnswerQualityPrompt',
  input: {schema: EvaluateAnswerQualityInputSchema},
  output: {schema: EvaluateAnswerQualityOutputSchema},
  model: 'googleai/gemini-2.0-flash',
  prompt: `You are an expert talent assessor evaluating candidate responses in a Situational Judgment Test.
Your task is to determine if a candidate's answer matches the ideal response criteria or if follow-up questions are needed.

CONTEXT:
- Scenario: {{situation}}
- Question {{questionNumber}}: {{question}}
- Ideal response criteria: {{bestResponseRationale}}
- Competency being assessed: {{assessedCompetency}}
- Current follow-up count: {{followUpCount}} out of {{maxFollowUps}} maximum allowed

CANDIDATE'S ANSWER:
"{{candidateAnswer}}"

EVALUATION INSTRUCTIONS:
1. Assess the candidate's answer for alignment with the ideal response criteria
2. If the answer is highly detailed and covers most key aspects of the ideal response, mark it as complete
3. If the answer lacks depth, clarity, specific details, or misses important aspects of the ideal response, mark it as incomplete
4. If incomplete and follow-ups are still available (current count < max), generate ONE targeted follow-up question
5. The follow-up question should:
   - Be directly related to the scenario and original question
   - Target specific missing aspects or areas that need more depth
   - Use this exact format for numbering: "{{questionNumber}}.a)" if this is the first follow-up, "{{questionNumber}}.b)" if this is the second
   - Encourage the candidate to provide more specific details

IMPORTANT:
- Only generate a follow-up if genuinely needed - don't force unnecessary questions
- If the candidate's answer is already thorough, mark as complete even if max follow-ups haven't been used
- If follow-ups have reached the maximum limit, do NOT generate another follow-up question
`,
});

const evaluateAnswerQualityFlow = ai.defineFlow(
  {
    name: 'evaluateAnswerQualityFlow',
    inputSchema: EvaluateAnswerQualityInputSchema,
    outputSchema: EvaluateAnswerQualityOutputSchema,
  },
  async (input: EvaluateAnswerQualityInput): Promise<EvaluateAnswerQualityOutput> => {
    try {
      console.log('🔍 Evaluating answer quality for question', input.questionNumber);
      
      // Check if we've reached the maximum follow-ups
      if (input.followUpCount >= input.maxFollowUps) {
        console.log('⚠️ Maximum follow-up questions reached, not generating more');
        return {
          isComplete: true, // Force complete when max follow-ups reached
          completionScore: 7, // Default middle-high score
          missingAspects: ["Maximum follow-up limit reached"],
          rationale: "The maximum number of follow-up questions has been reached for this scenario."
        };
      }
      
      // Generate the assessment
      const {output} = await prompt(input);
      if (output) {
        console.log(`✅ Answer quality evaluation complete: score=${output.completionScore}, isComplete=${output.isComplete}`);
        
        // If there's a follow-up question, ensure it has the correct letter format
        if (output.followUpQuestion) {
          // Convert follow-up count to letter (0 -> 'a', 1 -> 'b', etc.)
          const followUpLetter = String.fromCharCode(97 + input.followUpCount);
          
          // Check if the follow-up question already has the correct format
          const expectedPrefix = `${input.questionNumber}.${followUpLetter})`;
          if (!output.followUpQuestion.startsWith(expectedPrefix)) {
            // Replace any existing numbering pattern or add the correct prefix
            output.followUpQuestion = output.followUpQuestion.replace(
              /^\d+\.[a-z]\)\s*/i, 
              `${expectedPrefix} `
            );
            
            // If no replacement was made, add the prefix
            if (!output.followUpQuestion.startsWith(expectedPrefix)) {
              output.followUpQuestion = `${expectedPrefix} ${output.followUpQuestion}`;
            }
          }
        }
        
        return output;
      }
      
      // Fallback if AI fails
      console.warn('⚠️ AI evaluation failed, using fallback');
      return {
        isComplete: true, // Default to complete to avoid system getting stuck
        completionScore: 5, // Middle score when uncertain
        missingAspects: ["Could not evaluate answer properly"],
        rationale: "Unable to properly evaluate the answer quality due to technical limitations. Proceeding without follow-up."
      };
    } catch (error) {
      console.error('❌ Error in answer quality evaluation:', error);
      return {
        isComplete: true, // Default to complete on error
        completionScore: 5, // Middle score when uncertain
        missingAspects: ["Error during evaluation"],
        rationale: "An error occurred during answer evaluation. Proceeding without follow-up."
      };
    }
  }
);
