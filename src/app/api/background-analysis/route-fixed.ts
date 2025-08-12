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
      const followUpPenalty = 5; // 5% penalty for follow-up questions (reduced since we want high scores for good competency alignment)
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
      
      // Create enhanced result with individual scenario analysis if we got analyses
      if (sjtAnalyses.length > 0) {
        console.log(`🎯 Creating INDIVIDUAL SCENARIO analysis for ${sjtAnalyses.length} analyses...`);
        
        let strengthsText = "";
        let weaknessesText = "";
        
        // INDIVIDUAL SCENARIO ANALYSIS: Show each scenario separately
        // STRENGTHS: Scenarios with score >= 3 (VERY generous - any reasonable attempt)
        const strengthScenarios = sjtAnalyses.filter(analysis => analysis.postPenaltyScore >= 3)
          .sort((a, b) => b.postPenaltyScore - a.postPenaltyScore);

        if (strengthScenarios.length > 0) {
          strengthsText = "SCENARIO STRENGTHS:\n\n";
          strengthScenarios.forEach((analysis) => {
            strengthsText += `Scenario ${analysis.scenarioNumber} - ${analysis.competency} (Score: ${analysis.postPenaltyScore.toFixed(1)}/10):\n`;
            
            // CONCISE OUTPUT: Trim rationale to 3-4 sentences maximum
            const sentences = analysis.rationale.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
            const trimmedRationale = sentences.slice(0, 3).join('.').trim() + (sentences.length > 0 ? '.' : '');
            
            strengthsText += `${trimmedRationale}\n`;
            if (analysis.hasFollowUp) {
              strengthsText += `Note: ${analysis.penaltyApplied}% penalty applied for ${analysis.followUpQuestions} follow-up question(s).\n`;
            }
            strengthsText += '\n';
          });
        } else {
          strengthsText = "SCENARIO STRENGTHS:\nNo scenarios met the strength threshold. Focus on development areas below.\n\n";
        }

        // WEAKNESSES: Scenarios with score < 3 (very generous threshold)
        const weaknessScenarios = sjtAnalyses.filter(analysis => analysis.postPenaltyScore < 3)
          .sort((a, b) => a.postPenaltyScore - b.postPenaltyScore);

        if (weaknessScenarios.length > 0) {
          weaknessesText = "AREAS FOR DEVELOPMENT:\n\n";
          weaknessScenarios.forEach((analysis) => {
            weaknessesText += `Scenario ${analysis.scenarioNumber} - ${analysis.competency} (Score: ${analysis.postPenaltyScore.toFixed(1)}/10):\n`;
            
            // CONCISE OUTPUT: Trim rationale to 3-4 sentences maximum  
            const sentences = analysis.rationale.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
            const trimmedRationale = sentences.slice(0, 3).join('.').trim() + (sentences.length > 0 ? '.' : '');
            
            weaknessesText += `${trimmedRationale}\n`;
            if (analysis.hasFollowUp) {
              weaknessesText += `Note: ${analysis.penaltyApplied}% penalty applied for ${analysis.followUpQuestions} follow-up question(s).\n`;
            }
            weaknessesText += '\n';
          });
        } else {
          weaknessesText = "AREAS FOR DEVELOPMENT:\nAll scenarios met acceptable performance standards. Continue building on existing strengths.\n\n";
        }

        // Simple competency scoring
        const competencyMap = new Map<string, { totalPostPenaltyScore: number, count: number }>();
        
        sjtAnalyses.forEach((analysis) => {
          const competencyName = analysis.competency;
          if (!competencyMap.has(competencyName)) {
            competencyMap.set(competencyName, { totalPostPenaltyScore: 0, count: 0 });
          }
          
          const record = competencyMap.get(competencyName)!;
          record.totalPostPenaltyScore += analysis.postPenaltyScore;
          record.count += 1;
        });
        
        // Convert map to array of unique competencies with averaged scores
        const uniqueCompetencies = Array.from(competencyMap.entries()).map(([name, data]) => ({
          name,
          score: Math.round((data.totalPostPenaltyScore / data.count) * 10) / 10,
        }));

        // Simple summary without overwhelming details
        const overallAvgPostPenaltyScore = (sjtAnalyses.reduce((acc, a) => acc + a.postPenaltyScore, 0) / (sjtAnalyses.length || 1));
        const scenariosWithPenalty = sjtAnalyses.filter(a => a.hasFollowUp).length;
        
        const performanceLevel = overallAvgPostPenaltyScore >= 7 ? 'Excellent' : 
                               overallAvgPostPenaltyScore >= 5 ? 'Strong' : 
                               overallAvgPostPenaltyScore >= 3 ? 'Good' : 'Developing';
        
        const summaryText = `ASSESSMENT SUMMARY:

The candidate completed ${sjtAnalyses.length} situational judgment scenarios.

OVERALL PERFORMANCE: ${performanceLevel} (Average: ${overallAvgPostPenaltyScore.toFixed(1)}/10)
${scenariosWithPenalty > 0 ? `${scenariosWithPenalty} scenario(s) required follow-up questions.` : 'All scenarios were completed without follow-ups.'}

Review the individual scenario feedback above for specific strengths and development areas.`;

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
