import { NextRequest, NextResponse } from 'next/server';
import { submissionService, convertFirestoreSubmission } from '@/lib/database';
import { analyzeConversation } from '@/ai/flows/analyze-conversation';
import { analyzeSJTResponse, type AnalyzeSJTResponseInput } from '@/ai/flows/analyze-sjt-response';
import type { AnalysisResult } from '@/types';

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
      
      console.log(`🤖 Analyzing ${submission.history.length} SJT scenarios...`);
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
        const assessedCompetency = entry.assessedCompetency || entry.competency || `Situational Judgment ${i+1}`;
        
        try {
          // Create analysis input with all available data from entry
          const sjtAnalysisInput: AnalyzeSJTResponseInput = {
            situation: entry.situation || entry.question || "No situation provided",
            question: entry.question || "No question provided", 
            bestResponseRationale: entry.bestResponseRationale || "No best response criteria provided",
            worstResponseRationale: entry.worstResponseRationale || "No worst response criteria provided",
            assessedCompetency: assessedCompetency,
            candidateAnswer: entry.answer,
          };
          
          const result = await analyzeSJTResponse(sjtAnalysisInput);
          
          sjtAnalyses.push({ ...result, competency: assessedCompetency });
          console.log(`✅ Analysis complete for scenario ${i + 1}`);
        } catch (analysisError) {
          console.warn(`⚠️ Failed to analyze scenario ${i + 1}:`, analysisError);
        }
      }
      
      // Create enhanced result if we got analyses
      if (sjtAnalyses.length > 0) {
        // Separate high and low performing responses
        const strongResponses = sjtAnalyses.filter(a => a.score >= 7);
        const improvementAreas = sjtAnalyses.filter(a => a.score < 7);
        const averageResponses = sjtAnalyses.filter(a => a.score >= 5 && a.score < 7);
        
        // Generate detailed strengths organized by competency - AI driven only
        let strengthsText = "";
        
        // Group all responses by competency (including low scores to check for negligible strengths)
        const allCompetencyResponses = new Map<string, {responses: any[], scores: number[], rationales: string[]}>();
        sjtAnalyses.forEach(response => {
          if (!allCompetencyResponses.has(response.competency)) {
            allCompetencyResponses.set(response.competency, {responses: [], scores: [], rationales: []});
          }
          const data = allCompetencyResponses.get(response.competency)!;
          data.responses.push(response);
          data.scores.push(response.score);
          data.rationales.push(response.rationale);
        });
        
        // Analyze each competency for strengths
        Array.from(allCompetencyResponses.entries()).forEach(([competency, data]) => {
          const avgScore = (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1);
          const hasStrengths = data.responses.some(r => r.score >= 5); // At least some positive performance
          
          if (hasStrengths) {
            // Only show competencies where AI found actual strengths
            const strengthResponses = data.responses.filter(r => r.score >= 5);
            if (strengthResponses.length > 0) {
              const strengthLevel = data.scores.every(s => s >= 8) ? 'Outstanding Performance' : 
                                  data.scores.every(s => s >= 7) ? 'Strong Performance' : 
                                  data.scores.every(s => s >= 5) ? 'Satisfactory Performance' : 
                                  'Developing Performance';
              
              strengthsText += `${competency} (${strengthLevel} - Average: ${avgScore}/10):\n`;
              
              // Individual question analysis for this competency - only questions with scores >= 5
              strengthResponses.forEach(response => {
                const questionNum = sjtAnalyses.findIndex(a => a === response) + 1;
                strengthsText += `Question ${questionNum}: ${response.rationale} (Score: ${response.score}/10)\n`;
              });
              
              strengthsText += `\nDevelopment plan for ${competency}: Continue building on demonstrated capabilities. Focus on consistency and advanced application of skills in this competency area.\n\n`;
            }
          } else {
            // AI found no meaningful strengths for this competency
            strengthsText += `${competency} (Negligible Strengths - Average: ${avgScore}/10):\n`;
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
            data.scores.push(response.score);
            data.rationales.push(response.rationale);
          });
          
          // Analyze each competency needing development
          Array.from(competencyWeaknesses.entries()).forEach(([competency, data]) => {
            const avgScore = (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1);
            const developmentLevel = data.scores.every(s => s < 4) ? 'Priority Development Required' : 
                                   data.scores.every(s => s < 6) ? 'Focused Development Needed' : 
                                   'Minor Enhancement Required';
            
            weaknessesText += `${competency} (${developmentLevel} - Average: ${avgScore}/10):\n`;
            
            // Individual question analysis for this competency
            data.responses.forEach(response => {
              const questionNum = sjtAnalyses.findIndex(a => a === response) + 1;
              weaknessesText += `Question ${questionNum}: ${response.rationale} (Score: ${response.score}/10)\n`;
            });
            
            weaknessesText += `\nDevelopment plan for ${competency}: ${data.scores.every(s => s < 4) ? 'Immediate and intensive development required through structured training, mentoring, and supervised practice.' : data.scores.every(s => s < 6) ? 'Focused development through targeted training programs and practical application opportunities.' : 'Minor improvements through skill refinement and additional practice scenarios.'}\n\n`;
          });
          
          weaknessesText += "ADDITIONAL WEAKNESSES:\n\n";
          
          const improvementCompetencies = [...new Set(improvementAreas.map(r => r.competency))];
          weaknessesText += `Development priorities should focus on: ${improvementCompetencies.join(', ').replace(/, ([^,]*)$/, ', and $1')}.\n\n`;
        } else {
          weaknessesText += "ADDITIONAL WEAKNESSES:\n\n";
          weaknessesText += "No significant development areas identified through AI analysis.\n\n";
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

        // Get unique competency names for the summary text
        const uniqueStrongCompetencies = [...new Set(strongResponses.map(r => r.competency))];
        const uniqueImprovementCompetencies = [...new Set(improvementAreas.map(r => r.competency))];

        // Enhanced comprehensive summary
        const overallAvgScore = (sjtAnalyses.reduce((acc, a) => acc + a.score, 0) / (sjtAnalyses.length || 1));
        const performanceLevel = overallAvgScore >= 8 ? 'Excellent' : 
                               overallAvgScore >= 7 ? 'Very Good' : 
                               overallAvgScore >= 6 ? 'Good' : 
                               overallAvgScore >= 5 ? 'Satisfactory' : 'Needs Improvement';
        
        const summaryText = `COMPREHENSIVE ASSESSMENT SUMMARY:

The candidate completed ${sjtAnalyses.length} of ${submission.history.length} situational judgment scenarios with detailed AI analysis. 

OVERALL PERFORMANCE: ${performanceLevel} (Average Score: ${overallAvgScore.toFixed(1)}/10)

PERFORMANCE DISTRIBUTION:
- ${strongResponses.length} scenario(s) with strong performance (7+ scores)
- ${averageResponses.length} scenario(s) with satisfactory performance (5-6.9 scores)  
- ${improvementAreas.length} scenario(s) requiring development (<5 scores)

COMPETENCY OVERVIEW: 
${uniqueCompetencies.map(comp => {
  const competencyScores = sjtAnalyses.filter(a => a.competency === comp.name).map(a => a.score);
  const competencyAvg = (competencyScores.reduce((a, b) => a + b, 0) / competencyScores.length).toFixed(1);
  const competencyLevel = competencyScores.every(s => s >= 7) ? 'Strong' : 
                         competencyScores.every(s => s >= 5) ? 'Developing' : 'Needs Focus';
  return `- ${comp.name}: ${competencyLevel} (${competencyAvg}/10 across ${competencyScores.length} scenario(s))`;
}).join('\n')}

OVERALL ASSESSMENT: ${strongResponses.length > improvementAreas.length ? 
  'The candidate demonstrates solid situational judgment capabilities with particular strengths that outweigh areas for development. With targeted improvement in identified areas, they show strong potential for success.' :
  improvementAreas.length > strongResponses.length ?
  'The candidate shows engagement with complex workplace scenarios but would benefit from focused development in key competency areas before advancing. A structured development plan is recommended.' :
  'The candidate shows balanced performance across assessed competencies with equal strengths and development opportunities. Continued growth and targeted skill enhancement will support their professional advancement.'}`;

        analysisResult = {
          strengths: strengthsText,
          weaknesses: weaknessesText,
          summary: summaryText,
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
