import { NextRequest, NextResponse } from 'next/server';
import { submissionService, convertFirestoreSubmission } from '@/lib/database';
import { analyzeConversation } from '@/ai/flows/analyze-conversation';
import { analyzeSJTResponse, type AnalyzeSJTResponseInput } from '@/ai/flows/analyze-sjt-response';
import { generateCompetencySummaries } from '@/ai/flows/generate-competency-summaries';
import { configurationService } from '@/lib/config-service';
import type { AnalysisResult, QuestionwiseDetail, Competency } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Background report generation API called');
    
    const { submissionId, type, analysisInput, forceRegenerate = false } = await request.json();
    
    if (!submissionId) {
      return NextResponse.json(
        { error: 'Missing submissionId' },
        { status: 400 }
      );
    }

    console.log(`🤖 Starting AI analysis for submission: ${submissionId}${forceRegenerate ? ' (Force Regenerate)' : ''}`);
    
    let analysisResult: AnalysisResult;
    
    if (analysisInput) {
      // Legacy support: Interview type with analysisInput provided
      console.log('🤖 Processing interview with provided analysisInput');
      analysisResult = await analyzeConversation(analysisInput);
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
      
      analysisResult = await analyzeConversation(builtAnalysisInput);
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
      
      // Get SJT configuration for penalty settings
      const sjtConfig = await configurationService.getSJTConfig();
      const followUpPenalty = sjtConfig?.settings?.followUpPenalty || 0;
      
      console.log(`🤖 Analyzing ${submission.history.length} SJT scenarios with ${followUpPenalty}% follow-up penalty...`);
      const sjtAnalyses: Array<any> = [];
      
      // Process each scenario using admin-defined criteria from the submission
      for (let i = 0; i < submission.history.length; i++) {
        const entry = submission.history[i];
        
        // Skip entries without answers
        if (!entry?.answer) {
          console.log(`⚠️ Skipping scenario ${i + 1} - no answer provided`);
          continue;
        }
        
        // Extract assessedCompetency from the entry - prefer specific admin-defined competency field
        const assessedCompetencyRaw = entry.assessedCompetency || entry.competency || `Situational Judgment ${i+1}`;
        
        // Parse multiple competencies separated by commas
        const assessedCompetencies = assessedCompetencyRaw
          .split(',')
          .map(comp => comp.trim())
          .filter(comp => comp.length > 0);
        
        // If no valid competencies found, use default
        const competenciesToAnalyze = assessedCompetencies.length > 0 ? assessedCompetencies : [`Situational Judgment ${i+1}`];
        
        console.log(`📊 Question ${i + 1} will be analyzed for competencies: ${competenciesToAnalyze.join(', ')}`);
        
        try {
          // Create analysis for each competency
          for (const competency of competenciesToAnalyze) {
            // Create analysis input with all available data from entry
            const sjtAnalysisInput: AnalyzeSJTResponseInput = {
              situation: entry.situation || entry.question || "No situation provided",
              question: entry.question || "No question provided", 
              bestResponseRationale: entry.bestResponseRationale || "No best response criteria provided",
              worstResponseRationale: entry.worstResponseRationale || "No worst response criteria provided",
              assessedCompetency: competency,
              candidateAnswer: entry.answer,
            };
            
            const result = await analyzeSJTResponse(sjtAnalysisInput);
            
            // Calculate penalty if follow-up questions were generated for this scenario
            // Check both the followUpGenerated flag and if there are multiple entries with the same situation
            const scenarioEntries = submission.history.filter(h => h.situation === entry.situation);
            const hasMultipleQuestions = scenarioEntries.length > 1;
            const hasFollowUp = entry.followUpGenerated || hasMultipleQuestions;
            
            if (hasMultipleQuestions) {
              console.log(`🔍 Scenario ${i + 1}: Found ${scenarioEntries.length} questions for this situation - follow-up penalty will be applied`);
            }
            
            const prePenaltyScore = result.score;
            const postPenaltyScore = hasFollowUp && followUpPenalty > 0 
              ? Math.max(0, prePenaltyScore * (1 - followUpPenalty / 100))
              : prePenaltyScore;
            
            sjtAnalyses.push({ 
              ...result, 
              competency: competency,
              prePenaltyScore,
              postPenaltyScore,
              hasFollowUp,
              penaltyApplied: hasFollowUp ? followUpPenalty : 0,
              questionNumber: i + 1, // Add question number for better reporting
              originalCompetencies: assessedCompetencies // Keep track of all competencies for this question
            });
            console.log(`✅ Analysis complete for scenario ${i + 1}, competency "${competency}" (Score: ${prePenaltyScore}${hasFollowUp ? ` → ${postPenaltyScore.toFixed(1)} after ${followUpPenalty}% penalty` : ''})`);
          }
        } catch (analysisError) {
          console.warn(`⚠️ Failed to analyze scenario ${i + 1}:`, analysisError);
        }
      }
      
        // Create enhanced result if we got analyses
        if (sjtAnalyses.length > 0) {
          // Separate responses using post-penalty scores for categorization
          const strongResponses = sjtAnalyses.filter(a => a.postPenaltyScore >= 7);
          const improvementAreas = sjtAnalyses.filter(a => a.postPenaltyScore < 7);
          const averageResponses = sjtAnalyses.filter(a => a.postPenaltyScore >= 5 && a.postPenaltyScore < 7);        // Generate detailed strengths organized by competency - AI driven only
        let strengthsText = "";
        
        // Group all responses by competency (including low scores to check for negligible strengths)
        const allCompetencyResponses = new Map<string, {responses: any[], scores: number[], rationales: string[]}>();
        sjtAnalyses.forEach(response => {
          if (!allCompetencyResponses.has(response.competency)) {
            allCompetencyResponses.set(response.competency, {responses: [], scores: [], rationales: []});
          }
          const data = allCompetencyResponses.get(response.competency)!;
          data.responses.push(response);
          data.scores.push(response.postPenaltyScore); // Use post-penalty scores for categorization
          data.rationales.push(response.rationale);
        });
        
        // Analyze each competency for strengths
        Array.from(allCompetencyResponses.entries()).forEach(([competency, data]) => {
          const avgPrePenaltyScore = (data.responses.reduce((a, b) => a + b.prePenaltyScore, 0) / data.responses.length).toFixed(1);
          const avgPostPenaltyScore = (data.responses.reduce((a, b) => a + b.postPenaltyScore, 0) / data.responses.length).toFixed(1);
          const hasStrengths = data.responses.some(r => r.postPenaltyScore >= 5); // At least some positive performance
          
          // Get unique question numbers for this competency
          const questionNumbers = [...new Set(data.responses.map(r => r.questionNumber))].sort((a, b) => a - b);
          console.log(`📊 Competency "${competency}" analyzed from questions: ${questionNumbers.join(', ')}`);
          
          if (hasStrengths) {
            // Only show competencies where AI found actual strengths
            const strengthResponses = data.responses.filter(r => r.postPenaltyScore >= 5);
            if (strengthResponses.length > 0) {
              const strengthLevel = data.responses.every(r => r.postPenaltyScore >= 8) ? 'Outstanding Performance' : 
                                  data.responses.every(r => r.postPenaltyScore >= 7) ? 'Strong Performance' : 
                                  data.responses.every(r => r.postPenaltyScore >= 5) ? 'Satisfactory Performance' : 
                                  'Developing Performance';
              
              strengthsText += `${competency} (${strengthLevel} - Average: ${avgPrePenaltyScore}/10 pre-penalty, ${avgPostPenaltyScore}/10 post-penalty):\n`;
              
              // Individual question analysis for this competency - only questions with scores >= 5
              // Group by question number to show which specific questions contributed to this competency
              const questionGroups = new Map<number, any[]>();
              strengthResponses.forEach(response => {
                const questionNum = response.questionNumber || 1;
                if (!questionGroups.has(questionNum)) {
                  questionGroups.set(questionNum, []);
                }
                questionGroups.get(questionNum)!.push(response);
              });
              
              // Display analysis grouped by question number
              Array.from(questionGroups.entries()).sort((a, b) => a[0] - b[0]).forEach(([questionNum, responses]) => {
                // If there are multiple competency analyses for the same question, show the best one
                const bestResponse = responses.reduce((best, current) => 
                  current.postPenaltyScore > best.postPenaltyScore ? current : best
                );
                
                const scoreText = bestResponse.hasFollowUp 
                  ? `Pre-penalty: ${bestResponse.prePenaltyScore}/10, Post-penalty: ${bestResponse.postPenaltyScore.toFixed(1)}/10 (${bestResponse.penaltyApplied}% penalty applied)`
                  : `Score: ${bestResponse.postPenaltyScore}/10`;
                strengthsText += `Question ${questionNum}: ${bestResponse.rationale} (${scoreText})\n`;
              });
              
              strengthsText += `\nDevelopment plan for ${competency}: Continue building on demonstrated capabilities. Focus on consistency and advanced application of skills in this competency area.\n\n`;
            }
          } else {
            // AI found no meaningful strengths for this competency
            strengthsText += `${competency} (Negligible Strengths - Average: ${avgPrePenaltyScore}/10 pre-penalty, ${avgPostPenaltyScore}/10 post-penalty):\n`;
            strengthsText += `This candidate shows negligible strengths for ${competency}.\n\n`;
          }
        });
        
        strengthsText += "ADDITIONAL STRENGTHS:\n\n";
        
        // Only add additional strengths if there are actual strong performances (7+)
        if (strongResponses.length > 0) {
          const strongCompetencies = [...new Set(strongResponses.map(r => r.competency))];
          strengthsText += `Demonstrates excellence across ${strongCompetencies.length} competency area${strongCompetencies.length > 1 ? 's' : ''}: ${strongCompetencies.join(', ').replace(/, ([^,]*)$/, ', and $1')}.\n\n`;
        } else {
          strengthsText += "No additional strengths identified beyond individual competency assessments.\n\n";
        }
        
        // Generate detailed weaknesses organized by competency - AI driven only
        let weaknessesText = "";
        
        if (improvementAreas.length > 0) {
          // Group weaknesses by competency for organized analysis
          const competencyWeaknesses = new Map<string, {responses: any[], scores: number[], rationales: string[]}>();
          improvementAreas.forEach(response => {
            if (!competencyWeaknesses.has(response.competency)) {
              competencyWeaknesses.set(response.competency, {responses: [], scores: [], rationales: []});
            }
            const data = competencyWeaknesses.get(response.competency)!;
            data.responses.push(response);
            data.scores.push(response.postPenaltyScore); // Use post-penalty scores
            data.rationales.push(response.rationale);
          });
          
          // Analyze each competency needing development
          Array.from(competencyWeaknesses.entries()).forEach(([competency, data]) => {
            const avgPrePenaltyScore = (data.responses.reduce((a, b) => a + b.prePenaltyScore, 0) / data.responses.length).toFixed(1);
            const avgPostPenaltyScore = (data.responses.reduce((a, b) => a + b.postPenaltyScore, 0) / data.responses.length).toFixed(1);
            const developmentLevel = data.responses.every(r => r.postPenaltyScore < 4) ? 'Priority Development Required' : 
                                   data.responses.every(r => r.postPenaltyScore < 6) ? 'Focused Development Needed' : 
                                   'Minor Enhancement Required';
            
            weaknessesText += `${competency} (${developmentLevel} - Average: ${avgPrePenaltyScore}/10 pre-penalty, ${avgPostPenaltyScore}/10 post-penalty):\n`;
            
            // Individual question analysis for this competency - group by question number
            const questionGroups = new Map<number, any[]>();
            data.responses.forEach(response => {
              const questionNum = response.questionNumber || 1;
              if (!questionGroups.has(questionNum)) {
                questionGroups.set(questionNum, []);
              }
              questionGroups.get(questionNum)!.push(response);
            });
            
            // Display analysis grouped by question number
            Array.from(questionGroups.entries()).sort((a, b) => a[0] - b[0]).forEach(([questionNum, responses]) => {
              // If there are multiple competency analyses for the same question, show the one that needs most development
              const worstResponse = responses.reduce((worst, current) => 
                current.postPenaltyScore < worst.postPenaltyScore ? current : worst
              );
              
              const scoreText = worstResponse.hasFollowUp 
                ? `Pre-penalty: ${worstResponse.prePenaltyScore}/10, Post-penalty: ${worstResponse.postPenaltyScore.toFixed(1)}/10 (${worstResponse.penaltyApplied}% penalty applied)`
                : `Score: ${worstResponse.postPenaltyScore}/10`;
              weaknessesText += `Question ${questionNum}: ${worstResponse.rationale} (${scoreText})\n`;
            });
            
            weaknessesText += `\nDevelopment plan for ${competency}: ${data.responses.every(r => r.postPenaltyScore < 4) ? 'Immediate and intensive development required through structured training, mentoring, and supervised practice.' : data.responses.every(r => r.postPenaltyScore < 6) ? 'Focused development through targeted training programs and practical application opportunities.' : 'Minor improvements through skill refinement and additional practice scenarios.'}\n\n`;
          });
          
          weaknessesText += "ADDITIONAL WEAKNESSES:\n\n";
          
          const improvementCompetencies = [...new Set(improvementAreas.map(r => r.competency))];
          weaknessesText += `Development priorities should focus on: ${improvementCompetencies.join(', ').replace(/, ([^,]*)$/, ', and $1')}.\n\n`;
        } else {
          weaknessesText += "ADDITIONAL WEAKNESSES:\n\n";
          weaknessesText += "No significant development areas identified through AI analysis.\n\n";
        }

        // Process analyses to combine scores for the same competency using post-penalty scores
        const competencyMap = new Map<string, { totalPrePenaltyScore: number, totalPostPenaltyScore: number, count: number }>();
        
        sjtAnalyses.forEach((analysis) => {
          const competencyName = analysis.competency;
          if (!competencyMap.has(competencyName)) {
            competencyMap.set(competencyName, { totalPrePenaltyScore: 0, totalPostPenaltyScore: 0, count: 0 });
          }
          
          const record = competencyMap.get(competencyName)!;
          record.totalPrePenaltyScore += analysis.prePenaltyScore;
          record.totalPostPenaltyScore += analysis.postPenaltyScore;
          record.count += 1;
        });
        
        // Convert map to array of unique competencies with averaged scores
        const uniqueCompetencies = Array.from(competencyMap.entries()).map(([name, data]) => ({
          name,
          score: Math.round((data.totalPostPenaltyScore / data.count) * 10) / 10, // Use post-penalty as main score
          prePenaltyScore: Math.round((data.totalPrePenaltyScore / data.count) * 10) / 10,
          postPenaltyScore: Math.round((data.totalPostPenaltyScore / data.count) * 10) / 10
        }));

        // Get unique competency names for the summary text
        const uniqueStrongCompetencies = [...new Set(strongResponses.map(r => r.competency))];
        const uniqueImprovementCompetencies = [...new Set(improvementAreas.map(r => r.competency))];

        // Enhanced comprehensive summary
        const overallAvgPrePenaltyScore = (sjtAnalyses.reduce((acc, a) => acc + a.prePenaltyScore, 0) / (sjtAnalyses.length || 1));
        const overallAvgPostPenaltyScore = (sjtAnalyses.reduce((acc, a) => acc + a.postPenaltyScore, 0) / (sjtAnalyses.length || 1));
        const scenariosWithPenalty = sjtAnalyses.filter(a => a.hasFollowUp).length;
        
        const performanceLevel = overallAvgPostPenaltyScore >= 8 ? 'Excellent' : 
                               overallAvgPostPenaltyScore >= 7 ? 'Very Good' : 
                               overallAvgPostPenaltyScore >= 6 ? 'Good' : 
                               overallAvgPostPenaltyScore >= 5 ? 'Satisfactory' : 'Needs Improvement';
        
        const summaryText = `COMPREHENSIVE ASSESSMENT SUMMARY:

The candidate completed ${sjtAnalyses.length} of ${submission.history.length} situational judgment scenarios with detailed AI analysis. 

OVERALL PERFORMANCE: ${performanceLevel}
- Pre-penalty Average: ${overallAvgPrePenaltyScore.toFixed(1)}/10
- Post-penalty Average: ${overallAvgPostPenaltyScore.toFixed(1)}/10
${scenariosWithPenalty > 0 ? `- Follow-up Penalties Applied: ${scenariosWithPenalty} scenario(s) with ${followUpPenalty}% penalty` : '- No Follow-up Penalties Applied'}

PERFORMANCE DISTRIBUTION (Post-Penalty):
- ${strongResponses.length} scenario(s) with strong performance (7+ scores)
- ${averageResponses.length} scenario(s) with satisfactory performance (5-6.9 scores)  
- ${improvementAreas.length} scenario(s) requiring development (<5 scores)

COMPETENCY OVERVIEW: 
${uniqueCompetencies.map(comp => {
  const competencyScores = sjtAnalyses.filter(a => a.competency === comp.name);
  const competencyPreAvg = (competencyScores.reduce((a, b) => a + b.prePenaltyScore, 0) / competencyScores.length).toFixed(1);
  const competencyPostAvg = (competencyScores.reduce((a, b) => a + b.postPenaltyScore, 0) / competencyScores.length).toFixed(1);
  const competencyLevel = competencyScores.every(s => s.postPenaltyScore >= 7) ? 'Strong' : 
                         competencyScores.every(s => s.postPenaltyScore >= 5) ? 'Developing' : 'Needs Focus';
  const penaltiesInCompetency = competencyScores.filter(s => s.hasFollowUp).length;
  return `- ${comp.name}: ${competencyLevel} (Pre: ${competencyPreAvg}/10, Post: ${competencyPostAvg}/10 across ${competencyScores.length} scenario(s)${penaltiesInCompetency > 0 ? `, ${penaltiesInCompetency} with penalties` : ''})`;
}).join('\n')}

OVERALL ASSESSMENT: ${strongResponses.length > improvementAreas.length ? 
  'The candidate demonstrates solid situational judgment capabilities with particular strengths that outweigh areas for development. With targeted improvement in identified areas, they show strong potential for success.' :
  improvementAreas.length > strongResponses.length ?
  'The candidate shows engagement with complex workplace scenarios but would benefit from focused development in key competency areas before advancing. A structured development plan is recommended.' :
  'The candidate shows balanced performance across assessed competencies with equal strengths and development opportunities. Continued growth and targeted skill enhancement will support their professional advancement.'}`;

        // Generate question-wise details for Section 3
        const questionwiseDetails: QuestionwiseDetail[] = sjtAnalyses.map((analysis, index) => ({
          questionNumber: index + 1,
          question: submission.history[index]?.question || 'Question not recorded',
          candidateAnswer: submission.history[index]?.answer || 'No answer provided',
          competency: analysis.competency,
          prePenaltyScore: analysis.prePenaltyScore,
          postPenaltyScore: analysis.postPenaltyScore,
          penaltyApplied: analysis.penaltyApplied,
          hasFollowUp: analysis.hasFollowUp,
          rationale: analysis.rationale,
          // TODO: Add follow-up questions and answers from conversation history
          followUpQuestions: [], // These would come from the enhanced conversation tracking
          followUpAnswers: []
        }));

        // Generate qualitative summaries for each competency (Section 2)
        console.log('🤖 Generating competency-specific qualitative summaries...');
        const competencyQualitativeSummary: Competency[] = [];
        
        for (const [competencyName, data] of competencyMap.entries()) {
          try {
            // Get all responses for this competency
            const competencyResponses = sjtAnalyses
              .map((analysis, index) => ({
                questionNumber: index + 1,
                question: submission.history[index]?.question || 'Question not recorded',
                candidateAnswer: submission.history[index]?.answer || 'No answer provided',
                prePenaltyScore: analysis.prePenaltyScore,
                postPenaltyScore: analysis.postPenaltyScore,
                penaltyApplied: analysis.penaltyApplied,
                hasFollowUp: analysis.hasFollowUp,
                rationale: analysis.rationale,
                followUpQuestions: [], // TODO: Extract from conversation history
                followUpAnswers: []
              }))
              .filter((_, index) => sjtAnalyses[index].competency === competencyName);

            const overallScore = Math.round((data.totalPostPenaltyScore / data.count) * 10) / 10;
            
            const summaries = await generateCompetencySummaries({
              competencyName,
              candidateName: submission.candidateName,
              questionResponses: competencyResponses,
              overallScore
            });

            competencyQualitativeSummary.push({
              name: competencyName,
              score: overallScore,
              prePenaltyScore: Math.round((data.totalPrePenaltyScore / data.count) * 10) / 10,
              postPenaltyScore: overallScore,
              strengthSummary: summaries.strengthSummary,
              weaknessSummary: summaries.weaknessSummary
            });
            
          } catch (error) {
            console.error(`❌ Failed to generate summary for competency ${competencyName}:`, error);
            // Fallback with basic data
            competencyQualitativeSummary.push({
              name: competencyName,
              score: Math.round((data.totalPostPenaltyScore / data.count) * 10) / 10,
              prePenaltyScore: Math.round((data.totalPrePenaltyScore / data.count) * 10) / 10,
              postPenaltyScore: Math.round((data.totalPostPenaltyScore / data.count) * 10) / 10,
              strengthSummary: `The candidate demonstrated engagement with ${competencyName.toLowerCase()} scenarios.`,
              weaknessSummary: `The candidate could benefit from more detailed consideration of ${competencyName.toLowerCase()}-related factors.`
            });
          }
        }

        // Generate scores summary for Section 1
        const scoresSummary = {
          overallPerformance: performanceLevel,
          competencyScores: uniqueCompetencies,
          penaltySummary: scenariosWithPenalty > 0 
            ? `Follow-up penalties applied to ${scenariosWithPenalty} scenario(s) with ${followUpPenalty}% penalty reduction`
            : 'No follow-up penalties applied'
        };

        analysisResult = {
          strengths: strengthsText,
          weaknesses: weaknessesText,
          summary: summaryText,
          competencyAnalysis: [{
            name: "Situational Competencies",
            competencies: uniqueCompetencies.sort((a,b) => a.name.localeCompare(b.name)),
          }],
          // New chunked analysis sections
          scoresSummary,
          competencyQualitativeSummary: competencyQualitativeSummary.sort((a,b) => a.name.localeCompare(b.name)),
          questionwiseDetails
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
      analysisCompletedAt: new Date(),
      ...(forceRegenerate && { regeneratedAt: new Date() })
    });
    
    console.log(`✅ Submission ${submissionId} updated with AI analysis${forceRegenerate ? ' (regenerated)' : ''}`);
    
    return NextResponse.json({ 
      success: true, 
      message: forceRegenerate ? 'Background analysis regenerated successfully' : 'Background analysis completed',
      submissionId,
      type: type || 'interview',
      regenerated: forceRegenerate
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
