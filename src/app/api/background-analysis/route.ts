import { NextRequest, NextResponse } from 'next/server';
import { submissionService, convertFirestoreSubmission } from '@/lib/database';
import { analyzeConversation } from '@/ai/flows/analyze-conversation';
import { analyzeSJTResponse, type AnalyzeSJTResponseInput } from '@/ai/flows/analyze-sjt-response';
import type { AnalysisResult, ConversationEntry } from '@/types';

// Retry wrapper for AI calls to handle API overload
async function retryAIOperation<T>(
  operation: () => Promise<T>, 
  operationName: string,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🤖 ${operationName} - Attempt ${attempt}/${maxAttempts}`);
      const result = await operation();
      if (attempt > 1) {
        console.log(`✅ ${operationName} - Successful after ${attempt} attempts`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message.toLowerCase();
      
      // Check if it's a retryable error (API overload, rate limit, etc.)
      const isRetryable = errorMessage.includes('model overload') || 
                          errorMessage.includes('rate limit') || 
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('429') ||
                          errorMessage.includes('503') ||
                          errorMessage.includes('502');
      
      if (!isRetryable || attempt === maxAttempts) {
        console.error(`❌ ${operationName} - Failed after ${attempt} attempts:`, errorMessage);
        throw lastError;
      }
      
      // Exponential backoff: 2s, 4s, 8s...
      const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
      console.warn(`⚠️ ${operationName} - Attempt ${attempt} failed (${errorMessage}), retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError!;
}

// Helper function to group conversation entries by scenario
function groupEntriesByScenario(history: ConversationEntry[]): {
  groups: Map<string, ConversationEntry[]>;
  ungrouped: ConversationEntry[];
} {
  const groups = new Map<string, ConversationEntry[]>();
  const ungrouped: ConversationEntry[] = [];
  
  for (const entry of history) {
    // Skip entries without answers
    if (!entry?.answer) continue;
    
    try {
      const scenarioId = extractBaseScenarioId(entry.question || "");
      
      if (scenarioId) {
        if (!groups.has(scenarioId)) {
          groups.set(scenarioId, []);
        }
        groups.get(scenarioId)!.push(entry);
        console.log(`📌 Grouped "${entry.question?.substring(0, 50)}..." into scenario ${scenarioId}`);
      } else {
        ungrouped.push(entry);
        console.log(`⚠️ Could not group question "${entry.question?.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.warn(`Failed to group entry:`, error);
      ungrouped.push(entry);
    }
  }
  
  // Convert hash-based IDs to sequential numbers for cleaner display
  const sortedGroups = new Map<string, ConversationEntry[]>();
  let scenarioCounter = 1;
  
  groups.forEach((entries, hashId) => {
    sortedGroups.set(scenarioCounter.toString(), entries);
    console.log(`📊 Renaming scenario ${hashId} -> ${scenarioCounter} (${entries.length} entries)`);
    scenarioCounter++;
  });
  
  return { groups: sortedGroups, ungrouped };
}

// Helper function to extract base scenario ID from question text
function extractBaseScenarioId(question: string): string | null {
  if (!question) return null;
  
  // NEW APPROACH: Group by question stem/beginning (content-based grouping)
  const questionStem = question.trim().toLowerCase();
  
  // Remove common prefixes to get the core question content
  const cleanStem = questionStem
    .replace(/^(question \d+[:\.]?\s*)/i, '') // Remove "Question 1:" etc
    .replace(/^(scenario \d+[:\.]?\s*)/i, '') // Remove "Scenario 1:" etc
    .replace(/^(situation \d+[:\.]?\s*)/i, '') // Remove "Situation 1:" etc
    .replace(/^\d+[\.\)]\s*/, '') // Remove "1.", "2)", etc
    .replace(/^\d+[a-z][\.\)]\s*/i, '') // Remove "1a.", "2b)", etc
    .replace(/^[-\*\•]\s*/, '') // Remove bullet points
    .trim();
  
  // Get the first 30 characters of actual question content as grouping key
  const groupingKey = cleanStem.substring(0, 30).trim();
  
  if (groupingKey.length < 5) return null; // Too short to be meaningful
  
  // Create a simple hash from the content for consistent grouping
  let hash = 0;
  for (let i = 0; i < groupingKey.length; i++) {
    const char = groupingKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to positive number and use as scenario ID
  const scenarioId = Math.abs(hash).toString().substring(0, 2);
  console.log(`🔍 Content-based grouping: "${groupingKey}" -> Scenario ${scenarioId}`);
  return scenarioId;
}

// Helper function to detect if a question is a follow-up
function isFollowUpQuestion(question: string): boolean {
  const followUpPatterns = [
    /\d+\.[a-z]\)/,                      // "1.a)", "2.b)" format
    /follow.?up/i,                       // Contains "follow up" or "follow-up"
    /additional/i,                       // Contains "additional"  
    /furthermore/i,                      // Contains "furthermore"
    /^(also|and|then|next|now),?\s+/i,  // Starts with transitional words
    /^(what|how).*(else|other|additional)/i, // "What else would you...", "How would you additionally..."
    /in addition/i,                      // "In addition to..."
    /building on/i,                      // "Building on your previous answer..."
    /continuing/i,                       // "Continuing with..."
    /given your (previous )?response/i   // "Given your response..." or "Given your previous response..."
  ];
  
  return followUpPatterns.some(pattern => pattern.test(question));
}

// Helper function to process individual entry (fallback for ungrouped entries)
async function processIndividualEntry(entry: ConversationEntry, scenarioId?: string): Promise<any> {
  const assessedCompetency = entry.assessedCompetency || entry.competency || 'General Assessment';
  
  const sjtAnalysisInput: AnalyzeSJTResponseInput = {
    situation: entry.situation || entry.question || "No situation provided",
    question: entry.question || "No question provided",
    candidateAnswer: entry.answer || "",
    bestResponseRationale: entry.bestResponseRationale || "No best response criteria provided",
    worstResponseRationale: entry.worstResponseRationale || "No worst response criteria provided",
    assessedCompetency: assessedCompetency,
  };
  
  const result = await retryAIOperation(
    () => analyzeSJTResponse(sjtAnalysisInput),
    `Individual SJT Analysis for ${assessedCompetency}`
  );
  return { 
    ...result, 
    competency: assessedCompetency,
    scenarioId: scenarioId || 'Unknown',
    scenarioSituation: entry.situation || entry.question || "No situation provided"
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Background report generation API called');
    
    const { submissionId, type, analysisInput, forceRegenerate } = await request.json();
    
    if (!submissionId) {
      return NextResponse.json(
        { error: 'Missing submissionId' },
        { status: 400 }
      );
    }

    console.log(`🤖 ${forceRegenerate ? 'Regenerating' : 'Starting'} AI analysis for submission: ${submissionId}`);
    
    let analysisResult: AnalysisResult;
    
    if (analysisInput) {
      // Legacy support: Interview type with analysisInput provided
      console.log('🤖 Processing interview with provided analysisInput');
      analysisResult = await retryAIOperation(
        () => analyzeConversation(analysisInput),
        'Interview Analysis (legacy)'
      );
    } else if (type === 'interview') {
      // New approach: Get submission and build analysisInput
      const fsSubmission = await submissionService.getById(submissionId);
      if (!fsSubmission) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      
      const submission = convertFirestoreSubmission(fsSubmission);
      
      // Build analysisInput from submission data
      const builtAnalysisInput = {
        conversationHistory: submission.history.map(h => ({
          question: h.question,
          answer: h.answer!,
          preferredAnswer: h.preferredAnswer,
          competency: h.competency
        })).filter(h => h.answer), // Only include answered questions
        name: submission.candidateName,
        roleCategory: 'General', // Default since we don't store this in submission
        jobDescription: '', // Default since we don't store this in submission
      };
      
      analysisResult = await retryAIOperation(
        () => analyzeConversation(builtAnalysisInput),
        'Interview Analysis (built from submission)'
      );
    } else if (type === 'sjt') {
      // New approach: SJT analysis
      const fsSubmission = await submissionService.getById(submissionId);
      if (!fsSubmission) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      
      const submission = convertFirestoreSubmission(fsSubmission);
      
      console.log(`🤖 Analyzing ${submission.history.length} SJT scenarios...`);
      const sjtAnalyses: Array<any> = [];
      
      // Group conversation entries by scenario to handle follow-ups properly
      const groupedScenarios = groupEntriesByScenario(submission.history);
      console.log(`📊 Grouped into ${groupedScenarios.groups.size} scenarios, ${groupedScenarios.ungrouped.length} individual entries`);
      
      // Process grouped scenarios (enhanced logic for follow-up conversations)
      for (const [scenarioId, entries] of groupedScenarios.groups) {
        console.log(`🔍 Processing scenario ${scenarioId} with ${entries.length} entries`);
        
        // CRITICAL FIX: Check if all entries have the same competency
        const competencies = entries.map(entry => entry.assessedCompetency || entry.competency || `Scenario ${scenarioId}`);
        const uniqueCompetencies = [...new Set(competencies)];
        
        if (uniqueCompetencies.length === 1) {
          // All entries assess the same competency - process as a holistic conversation
          const primaryEntry = entries[0];
          const hasMultipleResponses = entries.length > 1;
          const assessedCompetency = uniqueCompetencies[0];
          
          try {
            const sjtAnalysisInput: AnalyzeSJTResponseInput = {
              // Backwards compatibility fields
              situation: primaryEntry.situation || primaryEntry.question || "No situation provided",
              question: primaryEntry.question || "No question provided",
              candidateAnswer: primaryEntry.answer || "",
              bestResponseRationale: primaryEntry.bestResponseRationale || "No best response criteria provided",
              worstResponseRationale: primaryEntry.worstResponseRationale || "No worst response criteria provided",
              assessedCompetency: assessedCompetency,
              
              // Enhanced context for follow-up conversations
              conversationThread: entries.map((entry: ConversationEntry) => ({
                question: entry.question || "",
                answer: entry.answer || "",
                isFollowUp: isFollowUpQuestion(entry.question || "")
              })),
              hasMultipleResponses
            };
            
            const result = await retryAIOperation(
              () => analyzeSJTResponse(sjtAnalysisInput),
              `SJT Analysis for scenario ${scenarioId} (${assessedCompetency})`
            );
            sjtAnalyses.push({ 
              ...result, 
              competency: assessedCompetency,
              scenarioId: scenarioId,
              scenarioSituation: primaryEntry.situation || primaryEntry.question || "No situation provided"
            });
            
            console.log(`✅ Holistic analysis complete for scenario ${scenarioId} (${assessedCompetency})`);
          } catch (analysisError) {
            console.warn(`⚠️ Holistic analysis failed for scenario ${scenarioId}:`, analysisError);
            
            // Fallback: Process entries individually
            for (const entry of entries) {
              try {
                const fallbackResult = await processIndividualEntry(entry, scenarioId);
                sjtAnalyses.push(fallbackResult);
              } catch (fallbackError) {
                console.warn(`⚠️ Fallback analysis also failed for entry in scenario ${scenarioId}:`, fallbackError);
              }
            }
          }
        } else {
          // Different competencies - each entry must be evaluated separately for its specific competency
          console.log(`🔄 Scenario ${scenarioId} has multiple competencies: ${uniqueCompetencies.join(', ')} - processing individually`);
          
          for (const entry of entries) {
            try {
              const result = await processIndividualEntry(entry, scenarioId);
              result.isMultipleCompetency = true;
              result.totalCompetenciesInScenario = uniqueCompetencies.length;
              sjtAnalyses.push(result);
              console.log(`✅ Individual analysis complete for ${entry.assessedCompetency || entry.competency} in scenario ${scenarioId}`);
            } catch (error) {
              console.warn(`⚠️ Individual entry analysis failed for scenario ${scenarioId}:`, error);
            }
          }
        }
      }
      
      // Process ungrouped entries using existing individual logic (fallback)
      let ungroupedCounter = 1;
      for (const entry of groupedScenarios.ungrouped) {
        try {
          // Try to extract scenario number from question or assign sequential number
          const questionText = entry.question || "";
          const extractedNumber = questionText.match(/(?:Question|Scenario)\s*(\d+)/i)?.[1];
          const scenarioNumber = extractedNumber || `${groupedScenarios.groups.size + ungroupedCounter}`;
          
          const fallbackResult = await processIndividualEntry(entry, scenarioNumber);
          sjtAnalyses.push(fallbackResult);
          ungroupedCounter++;
        } catch (error) {
          console.warn(`⚠️ Individual entry analysis failed:`, error);
        }
      }
      
      // Create enhanced result if we got analyses
      if (sjtAnalyses.length > 0) {
        console.log(`🧮 Processing ${sjtAnalyses.length} analyses for scenario-based insights`);
        
        // NEW APPROACH: Scenario-based analysis instead of competency-based
        const scenarioAnalyses = new Map<string, any[]>();
        
        // Group analyses by scenario
        sjtAnalyses.forEach((analysis) => {
          const scenarioKey = analysis.scenarioId || "Individual";
          if (!scenarioAnalyses.has(scenarioKey)) {
            scenarioAnalyses.set(scenarioKey, []);
          }
          scenarioAnalyses.get(scenarioKey)!.push(analysis);
        });
        
        // Generate scenario-based strengths
        let strengthsText = "The candidate demonstrates notable performance across the assessed scenarios:\n\n";
        
        scenarioAnalyses.forEach((analyses, scenarioId) => {
          // For each scenario, create a 3-4 line summary
          const scenario = analyses[0]; // Get scenario info from first analysis
          const scenarioTitle = `Scenario ${scenarioId}`;
          
          // Collect all strengths for this scenario
          const allStrengths: string[] = [];
          const allWeaknesses: string[] = [];
          let totalScore = 0;
          let competenciesAssessed: string[] = [];
          
          analyses.forEach(analysis => {
            totalScore += analysis.score;
            competenciesAssessed.push(analysis.competency);
            
            // Enhanced AI output
            if (analysis.strengthsObserved?.length > 0) {
              allStrengths.push(...analysis.strengthsObserved);
            }
            if (analysis.weaknessesObserved?.length > 0) {
              allWeaknesses.push(...analysis.weaknessesObserved);
            }
            
            // Fallback from rationale
            if (!analysis.strengthsObserved && analysis.score >= 7) {
              allStrengths.push(`Strong ${analysis.competency.toLowerCase()} demonstrated`);
            }
            if (!analysis.weaknessesObserved && analysis.score < 7) {
              allWeaknesses.push(`${analysis.competency} needs development`);
            }
          });
          
          const avgScore = Math.round((totalScore / analyses.length) * 10) / 10;
          const uniqueCompetencies = [...new Set(competenciesAssessed)];
          
          // Create 3-4 line summary for strengths
          if (allStrengths.length > 0) {
            const topStrengths = [...new Set(allStrengths)].slice(0, 3); // Top 3 unique strengths
            const strengthsSummary = topStrengths.join('. ').replace(/\.\./g, '.');
            strengthsText += `**${scenarioTitle}** (${uniqueCompetencies.join(', ')} - Score: ${avgScore}/10):\n`;
            strengthsText += `${strengthsSummary}. This scenario demonstrates effective professional judgment and competency application.\n\n`;
          }
        });
        
        // Generate scenario-based weaknesses/development areas
        let weaknessesText = "Development opportunities identified across scenarios:\n\n";
        
        scenarioAnalyses.forEach((analyses, scenarioId) => {
          const scenarioTitle = `Scenario ${scenarioId}`;
          
          // Collect all weaknesses for this scenario
          const allWeaknesses: string[] = [];
          let totalScore = 0;
          let competenciesAssessed: string[] = [];
          
          analyses.forEach(analysis => {
            totalScore += analysis.score;
            competenciesAssessed.push(analysis.competency);
            
            // Enhanced AI output
            if (analysis.weaknessesObserved?.length > 0) {
              allWeaknesses.push(...analysis.weaknessesObserved);
            }
            
            // Fallback from rationale for lower scores
            if (!analysis.weaknessesObserved && analysis.score < 7) {
              allWeaknesses.push(`Could strengthen ${analysis.competency.toLowerCase()} approach`);
            }
          });
          
          const avgScore = Math.round((totalScore / analyses.length) * 10) / 10;
          const uniqueCompetencies = [...new Set(competenciesAssessed)];
          
          // Create 3-4 line summary for development areas
          if (allWeaknesses.length > 0) {
            const topWeaknesses = [...new Set(allWeaknesses)].slice(0, 3); // Top 3 unique areas
            const weaknessesSummary = topWeaknesses.join('. ').replace(/\.\./g, '.');
            weaknessesText += `**${scenarioTitle}** (${uniqueCompetencies.join(', ')} - Score: ${avgScore}/10):\n`;
            weaknessesText += `${weaknessesSummary}. Focused development in these areas would enhance scenario handling capabilities.\n\n`;
          }
        });
        
        // Add fallback if no development areas found
        if (scenarioAnalyses.size > 0 && !weaknessesText.includes("**Scenario")) {
          weaknessesText += "Overall, the candidate demonstrates solid competency understanding across scenarios. Focus should be on refining response depth and ensuring comprehensive situation analysis.\n\n";
        }
        
        // Process analyses to combine scores for the same competency
        const competencyMap = new Map<string, { totalScore: number, count: number }>();
        
        sjtAnalyses.forEach((analysis) => {
          const competencyName = analysis.competency;
          if (!competencyMap.has(competencyName)) {
            competencyMap.set(competencyName, { totalScore: 0, count: 0 });
          }
          
          const record = competencyMap.get(competencyName)!;
          record.totalScore += analysis.score;
          record.count += 1;
        });
        
        // Convert map to array of unique competencies with averaged scores
        const uniqueCompetencies = Array.from(competencyMap.entries()).map(([name, data]) => ({
          name,
          score: Math.round((data.totalScore / data.count) * 10) / 10 // Round to 1 decimal place
        }));
        
        // Calculate overall statistics
        const averageScore = Math.round((sjtAnalyses.reduce((acc, a) => acc + a.score, 0) / sjtAnalyses.length) * 10) / 10;
        const highPerformingCount = sjtAnalyses.filter(a => a.score >= 7).length;
        const competencyCount = uniqueCompetencies.length;

        analysisResult = {
          strengths: strengthsText,
          weaknesses: weaknessesText,
          summary: `The candidate completed ${sjtAnalyses.length} of ${submission.history.length} scenarios with AI analysis. The average competency score was ${averageScore}/10. ${highPerformingCount > 0 ? `Strong performance in ${highPerformingCount} assessment(s).` : ''} ${competencyCount > 0 ? `Analysis covered ${competencyCount} core competency area(s).` : ''}`,
          competencyAnalysis: [{
            name: "Situational Competencies",
            competencies: uniqueCompetencies.sort((a,b) => a.name.localeCompare(b.name)),
          }]
        };
      } else {
        // Fall back to basic result if no AI analysis
        const fsSubmission = await submissionService.getById(submissionId);
        const submission = convertFirestoreSubmission(fsSubmission!);
        analysisResult = submission.report || {
          strengths: "Basic analysis completed.",
          weaknesses: "Full AI analysis was not available.",
          summary: `The candidate completed ${submission.history.length} scenarios.`,
          competencyAnalysis: []
        };
      }
    } else {
      return NextResponse.json(
        { error: 'Must provide either analysisInput or type ("interview" or "sjt")' },
        { status: 400 }
      );
    }
    
    console.log('✅ AI analysis completed, updating submission...');
    
    // Update the submission with the new analysis result
    await submissionService.update(submissionId, {
      report: analysisResult,
      analysisCompleted: true,
      analysisCompletedAt: new Date()
    });
    
    console.log(`✅ Submission ${submissionId} updated with AI analysis`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Background analysis completed',
      submissionId,
      type: type || 'interview'
    });
    
  } catch (error) {
    console.error('❌ Background report generation failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate background report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
