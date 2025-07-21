
'use server';
/**
 * @fileOverview A Genkit flow to translate text into a specified language.
 *
 * - translateText - A function that translates a given text string.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TranslateTextInputSchema = z.object({
  textToTranslate: z.string().describe('The text that needs to be translated.'),
  targetLanguage: z.string().describe('The language to translate the text into (e.g., "Spanish", "French").'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

const TranslateTextOutputSchema = z.object({
  translatedText: z.string().describe('The resulting translated text.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;


export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: { schema: TranslateTextInputSchema },
  output: { schema: TranslateTextOutputSchema },
  model: 'googleai/gemini-2.0-flash',
  prompt: `
    Translate the following text into {{{targetLanguage}}}.
    Return only the translated text, with no additional commentary or explanations.

    Text to translate: "{{{textToTranslate}}}"
  `,
});

const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    // If the target language is English, no need to call the AI
    if (input.targetLanguage.toLowerCase() === 'english') {
      return { translatedText: input.textToTranslate };
    }

    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI translation did not return a valid response.');
    }
    return output;
  }
);
