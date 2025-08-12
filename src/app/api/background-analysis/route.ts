import { NextRequest, NextResponse } from 'next/server';
import { submissionService, convertFirestoreSubmission } from '@/lib/database';
import { analyzeConversation } from '@/ai/flows/analyze-conversation';
import { analyzeSJTResponse, getSJTScore, getLenientSJTScore, getSJTFeedback, type AnalyzeSJTResponseInput } from '@/ai/flows/analyze-sjt-response';
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
      
      // ENHANCED SJT ANALYSIS: Dynamic scenario-based consolidation with full context
      const sjtAnalyses: any[] = [];
      const followUpPenalty = 0; // REMOVED: No penalty for comprehensive responses
      let scenarioNumber = 1;
      
      // DYNAMIC SCENARIO GROUPING: Group by shared situation or competency
      const scenarioGroups = new Map<string, any[]>();
      
      submission.history.forEach((entry, index) => {
        // Create unique scenario key based on ACTUAL situation content (not index)
        let scenarioKey;
        if (entry.situation && entry.situation.trim().length > 0) {
          // Use first 50 characters of situation to group same scenarios
          const situationHash = entry.situation.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
          scenarioKey = situationHash;
        } else {
          // Fallback to index-based grouping only if no situation provided
          scenarioKey = `default-scenario-${Math.floor(index / 3) + 1}`;
        }
        
        if (!scenarioGroups.has(scenarioKey)) {
          scenarioGroups.set(scenarioKey, []);
        }
        scenarioGroups.get(scenarioKey)!.push({
          ...entry, 
          originalIndex: index,
          isFollowUp: entry.isFollowUp || entry.question.match(/\d+\.[a-z]\)/) // Unified detection
        });
      });
      
      // Process each scenario group for comprehensive analysis
      for (const [scenarioKey, questions] of scenarioGroups.entries()) {
        try {
          // ENHANCED QUESTION ORGANIZATION: Separate main and follow-ups properly
          const mainQuestion = questions.find(q => q.answer && !q.isFollowUp) || questions[0];
          const followUpQuestions = questions.filter(q => q.answer && q.isFollowUp);
          
          if (mainQuestion?.answer) {
            console.log(`🎯 Analyzing Scenario ${scenarioNumber} [${scenarioKey}] (${questions.length} questions, ${followUpQuestions.length} follow-ups)`);
            
            // BUILD COMPLETE CONVERSATION CONTEXT: Include questions and answers
            let conversationContext = `Main Question: "${mainQuestion.question}"\nMain Answer: "${mainQuestion.answer}"`;
            
            if (followUpQuestions.length > 0) {
              conversationContext += "\n\nFollow-up Conversation:";
              followUpQuestions.forEach((fq, idx) => {
                conversationContext += `\nQ${idx + 1}: "${fq.question}"\nA${idx + 1}: "${fq.answer}"`;
              });
            }
            
            // CONSOLIDATED ANSWER: For backward compatibility
            let consolidatedAnswer = mainQuestion.answer;
            if (followUpQuestions.length > 0) {
              consolidatedAnswer += "\n\nFollow-up responses:\n" + 
                followUpQuestions.map((fq, idx) => `Q: ${fq.question}\nA: ${fq.answer}`).join('\n\n');
            }
            
            // ENHANCED SJT INPUT: Include full context
            const sjtInput: AnalyzeSJTResponseInput = {
              situation: mainQuestion.situation || 'Workplace scenario requiring judgment and decision-making.',
              question: mainQuestion.question,
              bestResponseRationale: mainQuestion.bestResponseRationale || 'Demonstrates strong competency application with clear reasoning and appropriate action.',
              worstResponseRationale: mainQuestion.worstResponseRationale || 'Shows poor judgment with inappropriate actions or reasoning.',
              assessedCompetency: mainQuestion.assessedCompetency || mainQuestion.competency || 'General Decision Making',
              candidateAnswer: consolidatedAnswer, // Backward compatibility
              conversationContext: conversationContext, // NEW: Full context
              hasFollowUps: followUpQuestions.length > 0, // NEW: Context flag
            };
            
            // TWO-STAGE SCORING SYSTEM: Balanced first, then extremely lenient for decent answers
            // Stage 1: Balanced scoring to filter truly poor answers
            const balancedScore = await getSJTScore(sjtInput);
            
            let finalScore = balancedScore;
            let scoringMode = 'balanced';
            
            // Stage 2: If answer is decent (4+), re-evaluate with extremely lenient scoring
            if (balancedScore >= 4) {
              const lenientScore = await getLenientSJTScore(sjtInput);
              finalScore = lenientScore;
              scoringMode = 'lenient-boost';
              console.log(`🔄 Re-evaluated with lenient scoring: ${balancedScore} → ${lenientScore}`);
            }
            
            const feedback = await getSJTFeedback(sjtInput); // Separate feedback generation
            const hasFollowUp = followUpQuestions.length > 0;
            
            // Helper function to trim feedback to 3-4 lines max
            const trimFeedback = (text: string): string => {
              const lines = text.split('\n').filter(line => line.trim().length > 0);
              return lines.slice(0, 4).join('\n'); // Max 4 lines
            };
            
            sjtAnalyses.push({
              questionNumber: scenarioNumber,
              scenarioNumber: scenarioNumber,
              scenarioKey: scenarioKey,
              competency: sjtInput.assessedCompetency,
              rationale: `Score: ${finalScore}/10 (${scoringMode}${balancedScore !== finalScore ? `, was ${balancedScore}` : ''})`, // Enhanced rationale
              prePenaltyScore: finalScore,
              postPenaltyScore: finalScore, // Same as pre-penalty
              finalScore: finalScore,
              hasFollowUp,
              followUpQuestions: followUpQuestions.length,
              penaltyApplied: 0, // No penalty
              conversationContext: conversationContext, // Store for debugging
              strengthFeedback: trimFeedback(feedback.strengthFeedback), // NEW: Trimmed dedicated feedback
              developmentFeedback: trimFeedback(feedback.developmentFeedback), // NEW: Trimmed dedicated feedback
            });
            
            console.log(`✅ Scenario ${scenarioNumber} analysis complete (Score: ${finalScore}/10${hasFollowUp ? ` with ${followUpQuestions.length} follow-ups` : ''})`);
          }
        } catch (analysisError) {
          console.warn(`⚠️ Failed to analyze Scenario ${scenarioNumber} [${scenarioKey}]:`, analysisError);
        }
        scenarioNumber++;
      }
      
      // Create enhanced result with individual scenario analysis if we got analyses
      if (sjtAnalyses.length > 0) {
        console.log(`🎯 Creating INDIVIDUAL SCENARIO analysis for ${sjtAnalyses.length} analyses...`);
        
        // INDIVIDUAL SCENARIO ANALYSIS: ALL scenarios appear in BOTH sections using dedicated feedback
        let strengthsText = "SCENARIO STRENGTHS:\n\n";
        let weaknessesText = "AREAS FOR DEVELOPMENT:\n\n";
        
        // Process ALL scenarios for BOTH strengths and weaknesses using dedicated feedback
        sjtAnalyses.forEach((analysis) => {
          // STRENGTHS SECTION: Use dedicated strength feedback
          strengthsText += `Scenario ${analysis.scenarioNumber} - ${analysis.competency} (Score: ${analysis.finalScore.toFixed(1)}/10):\n`;
          
          if (analysis.strengthFeedback && analysis.strengthFeedback.trim().length > 0) {
            strengthsText += `${analysis.strengthFeedback}\n`;
          } else {
            strengthsText += `Shows effort and engagement in addressing this scenario.\n`;
          }
          
          if (analysis.hasFollowUp) {
            strengthsText += `Note: Comprehensive response included ${analysis.followUpQuestions} follow-up answer(s).\n`;
          }
          strengthsText += '\n';
          
          // WEAKNESSES SECTION: Use dedicated development feedback
          weaknessesText += `Scenario ${analysis.scenarioNumber} - ${analysis.competency} (Score: ${analysis.finalScore.toFixed(1)}/10):\n`;
          
          if (analysis.developmentFeedback && analysis.developmentFeedback.trim().length > 0) {
            weaknessesText += `${analysis.developmentFeedback}\n`;
          } else {
            weaknessesText += `No notable areas for development identified for this scenario.\n`;
          }
          
          if (analysis.hasFollowUp) {
            weaknessesText += `Note: Response included ${analysis.followUpQuestions} follow-up answer(s).\n`;
          }
          weaknessesText += '\n';
        });

        // Simple competency scoring with final scores (no complex analysis needed)
        const competencyMap = new Map<string, { totalFinalScore: number, count: number }>();
        
        sjtAnalyses.forEach((analysis) => {
          const competencyName = analysis.competency;
          if (!competencyMap.has(competencyName)) {
            competencyMap.set(competencyName, { totalFinalScore: 0, count: 0 });
          }
          
          const record = competencyMap.get(competencyName)!;
          record.totalFinalScore += analysis.finalScore;
          record.count += 1;
        });
        
        // Convert map to array of unique competencies with averaged final scores
        const uniqueCompetencies = Array.from(competencyMap.entries()).map(([name, data]) => ({
          name,
          score: Math.round((data.totalFinalScore / data.count) * 10) / 10,
        }));

        // NO SUMMARY - Only strengths and weaknesses as requested
        analysisResult = {
          strengths: strengthsText,
          weaknesses: weaknessesText,
          summary: "", // Empty summary as requested
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
          summary: "", // Empty summary as requested
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
