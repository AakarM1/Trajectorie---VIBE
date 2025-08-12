import { NextRequest, NextResponse } from 'next/server';
import { submissionService, convertFirestoreSubmission } from '@/lib/database';
import { analyzeConversation } from '@/ai/flows/analyze-conversation';
import { analyzeSJTResponse, type AnalyzeSJTResponseInput } from '@/ai/flows/analyze-sjt-response';
import { configurationService } from '@/lib/config-service';
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
      // Enhanced SJT analysis with scenario-based grouping
      const fsSubmission = await submissionService.getById(submissionId);
      if (!fsSubmission) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }
      
      const submission = convertFirestoreSubmission(fsSubmission);
      console.log(`📊 Processing ${submission.history.length} SJT scenarios...`);
      
      // ENHANCED SJT ANALYSIS: Scenario-based consolidation
      const sjtAnalyses: any[] = [];
      const followUpPenalty = 10; // 10% penalty for follow-up questions
      let scenarioNumber = 1;
      
      // Consolidate scenarios by grouping related questions
      const scenarioGroups = new Map<number, any[]>();
      submission.history.forEach((entry, index) => {
        const scenarioNum = Math.floor(index / 3) + 1; // Group every 3 questions as one scenario
        if (!scenarioGroups.has(scenarioNum)) {
          scenarioGroups.set(scenarioNum, []);
        }
        scenarioGroups.get(scenarioNum)!.push({...entry, originalIndex: index});
      });
      
      // Process each scenario group for enhanced analysis
      for (const [scenarioNum, questions] of scenarioGroups.entries()) {
        try {
          // Find main question and follow-ups within this scenario
          const mainQuestion = questions.find(q => q.answer && !q.isFollowUp) || questions[0];
          const followUpQuestions = questions.filter(q => q.answer && q.isFollowUp);
          
          if (mainQuestion?.answer) {
            console.log(`🎯 Analyzing Scenario ${scenarioNum} (${questions.length} questions, ${followUpQuestions.length} follow-ups)`);
            
            // Build consolidated answer for this scenario
            let consolidatedAnswer = mainQuestion.answer;
            if (followUpQuestions.length > 0) {
              consolidatedAnswer += "\n\nFollow-up responses:\n" + 
                followUpQuestions.map((fq, idx) => `${idx + 1}. ${fq.answer}`).join('\n');
            }
            
            const sjtInput: AnalyzeSJTResponseInput = {
              situation: mainQuestion.situation || 'Workplace scenario requiring judgment and decision-making.',
              question: mainQuestion.question,
              bestResponseRationale: mainQuestion.bestResponseRationale || 'Demonstrates strong competency application with clear reasoning and appropriate action.',
              worstResponseRationale: mainQuestion.worstResponseRationale || 'Shows poor judgment with inappropriate actions or reasoning.',
              assessedCompetency: mainQuestion.competency || 'General Decision Making',
              candidateAnswer: consolidatedAnswer,
            };
            
            const analysis = await analyzeSJTResponse(sjtInput);
            
            // ENHANCED PENALTY CALCULATION: Apply penalty for follow-ups
            const prePenaltyScore = analysis.score;
            const hasFollowUp = followUpQuestions.length > 0;
            const penaltyApplied = hasFollowUp ? followUpPenalty : 0;
            const postPenaltyScore = hasFollowUp ? 
              Math.max(0, prePenaltyScore - (prePenaltyScore * penaltyApplied / 100)) : 
              prePenaltyScore;
            
            sjtAnalyses.push({
              questionNumber: scenarioNumber,
              scenarioNumber: scenarioNum,
              competency: sjtInput.assessedCompetency,
              rationale: analysis.rationale,
              prePenaltyScore,
              postPenaltyScore,
              hasFollowUp,
              followUpQuestions: followUpQuestions.length,
              penaltyApplied,
            });
            
            console.log(`✅ Scenario ${scenarioNum} analysis complete (Score: ${prePenaltyScore}${hasFollowUp ? ` → ${postPenaltyScore.toFixed(1)} after ${penaltyApplied}% penalty` : ''})`);
          }
        } catch (analysisError) {
          console.warn(`⚠️ Failed to analyze Scenario ${scenarioNum}:`, analysisError);
        }
        scenarioNumber++;
      }
      
      // Create enhanced result with scenario-based grouping if we got analyses
      if (sjtAnalyses.length > 0) {
        console.log(`🎯 Creating ENHANCED SCENARIO-BASED analysis for ${sjtAnalyses.length} analyses...`);
        
        let strengthsText = "";
        let weaknessesText = "";
        
        // ENHANCED GROUPING: Group by competency for clean output with scenario tracking
        const competencyGroups = new Map<string, {responses: any[], avgScore: number, scenarios: Set<number>}>();
        sjtAnalyses.forEach(response => {
          if (!competencyGroups.has(response.competency)) {
            competencyGroups.set(response.competency, {responses: [], avgScore: 0, scenarios: new Set()});
          }
          const group = competencyGroups.get(response.competency)!;
          group.responses.push(response);
          group.scenarios.add(response.scenarioNumber);
        });
        
        // Calculate average scores for each competency
        competencyGroups.forEach((data, competency) => {
          data.avgScore = data.responses.reduce((sum, r) => sum + r.postPenaltyScore, 0) / data.responses.length;
        });

        // STRENGTHS: Competencies with avg score >= 6 (lenient threshold)
        const strengthCompetencies = Array.from(competencyGroups.entries())
          .filter(([_, data]) => data.avgScore >= 6)
          .sort((a, b) => b[1].avgScore - a[1].avgScore);

        if (strengthCompetencies.length > 0) {
          strengthsText = "COMPETENCY STRENGTHS (Scenario-Based Analysis):\n\n";
          strengthCompetencies.forEach(([competency, data]) => {
            const scenarioList = Array.from(data.scenarios).sort((a, b) => a - b);
            strengthsText += `${competency} (Average: ${data.avgScore.toFixed(1)}/10 across ${scenarioList.length} scenario${scenarioList.length > 1 ? 's' : ''}):\n`;
            
            // CONCISE OUTPUT: Get best rationale and trim to 3-4 lines maximum
            const bestResponse = data.responses.reduce((best, current) => 
              current.postPenaltyScore > best.postPenaltyScore ? current : best
            );
            
            // Trim rationale to 3-4 sentences maximum (user requirement)
            const sentences = bestResponse.rationale.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
            const trimmedRationale = sentences.slice(0, 3).join('.').trim() + (sentences.length > 0 ? '.' : '');
            
            strengthsText += `${trimmedRationale}\n`;
            strengthsText += `Scenarios: ${scenarioList.join(', ')}\n\n`;
          });
        } else {
          strengthsText = "COMPETENCY STRENGTHS:\nContinue developing foundational skills. Focus on improvement areas below.\n\n";
        }

        // WEAKNESSES: Competencies with avg score < 6
        const weaknessCompetencies = Array.from(competencyGroups.entries())
          .filter(([_, data]) => data.avgScore < 6)
          .sort((a, b) => a[1].avgScore - b[1].avgScore);

        if (weaknessCompetencies.length > 0) {
          weaknessesText = "AREAS FOR DEVELOPMENT (Scenario-Based Analysis):\n\n";
          weaknessCompetencies.forEach(([competency, data]) => {
            const scenarioList = Array.from(data.scenarios).sort((a, b) => a - b);
            weaknessesText += `${competency} (Average: ${data.avgScore.toFixed(1)}/10 across ${scenarioList.length} scenario${scenarioList.length > 1 ? 's' : ''}):\n`;
            
            // CONCISE OUTPUT: Get representative rationale and trim to 3-4 lines maximum  
            const representativeResponse = data.responses[0];
            const sentences = representativeResponse.rationale.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
            const trimmedRationale = sentences.slice(0, 3).join('.').trim() + (sentences.length > 0 ? '.' : '');
            
            weaknessesText += `${trimmedRationale}\n`;
            weaknessesText += `Development needed in scenarios: ${scenarioList.join(', ')}\n\n`;
          });
        } else {
          weaknessesText = "AREAS FOR DEVELOPMENT:\nNo significant development areas identified. Continue building on existing strengths.\n\n";
        }

        // Additional analysis for final result construction
        const averageResponses = sjtAnalyses.filter(a => a.postPenaltyScore >= 5 && a.postPenaltyScore < 6);
        const improvementAreas = sjtAnalyses.filter(a => a.postPenaltyScore < 6);
        const strongResponses = sjtAnalyses.filter(a => a.postPenaltyScore >= 7);
        
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
