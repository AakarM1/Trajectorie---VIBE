import { NextRequest, NextResponse } from 'next/server';
import { submissionService, convertFirestoreSubmission } from '@/lib/database';
import { analyzeConversation } from '@/ai/flows/analyze-conversation';
import { analyzeSJTResponse, type AnalyzeSJTResponseInput } from '@/ai/flows/analyze-sjt-response';
import type { AnalysisResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Background report generation API called');
    
    const { submissionId, type, analysisInput } = await request.json();
    
    if (!submissionId) {
      return NextResponse.json(
        { error: 'Missing submissionId' },
        { status: 400 }
      );
    }

    console.log(`🤖 Starting AI analysis for submission: ${submissionId}`);
    
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
        
        // Generate detailed strengths
        let strengthsText = "The candidate demonstrates several notable strengths in their situational judgment responses:\n\n";
        
        if (strongResponses.length > 0) {
          strongResponses.forEach((response, index) => {
            strengthsText += `**${response.competency} Excellence**: ${response.rationale} This demonstrates strong ${response.competency.toLowerCase()} skills and professional maturity.\n\n`;
          });
          
          // Add summary of competencies excelled in
          const strongCompetencies = strongResponses.map(r => r.competency);
          strengthsText += `The candidate particularly excels in ${strongCompetencies.join(', ').replace(/, ([^,]*)$/, ', and $1')}, showing consistent professional judgment in these areas.`;
        } else if (averageResponses.length > 0) {
          strengthsText += "While no responses scored exceptionally high, the candidate shows solid foundational understanding in several areas:\n\n";
          averageResponses.forEach((response, index) => {
            strengthsText += `**${response.competency} Foundation**: Shows basic competency with room for growth. ${response.rationale}\n\n`;
          });
        } else {
          strengthsText += "The candidate shows engagement with the assessment process and demonstrates effort in responding to complex workplace scenarios. With focused development, there is potential for growth in professional judgment and decision-making skills.";
        }
        
        // Generate detailed weaknesses  
        let weaknessesText = "Areas for professional development and improvement:\n\n";
        
        if (improvementAreas.length > 0) {
          improvementAreas.forEach((response, index) => {
            weaknessesText += `**${response.competency} Development**: ${response.rationale} Consider developing stronger ${response.competency.toLowerCase()} skills through targeted training and practice.\n\n`;
          });
          
          // Add developmental recommendations
          const improvementCompetencies = improvementAreas.map(r => r.competency);
          weaknessesText += `Priority development areas include ${improvementCompetencies.join(', ').replace(/, ([^,]*)$/, ', and $1')}. Focused training in these competencies would significantly enhance professional effectiveness.`;
        } else {
          weaknessesText += "No significant areas of concern identified. The candidate demonstrates consistent professional judgment across all assessed scenarios.";
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

        // Update the strength text to use unique competencies
        if (strongResponses.length > 0 && uniqueStrongCompetencies.length > 0) {
          // Replace the last part of the strengths text with unique competencies
          const lastSentenceStart = strengthsText.lastIndexOf("The candidate particularly excels in");
          if (lastSentenceStart !== -1) {
            strengthsText = strengthsText.substring(0, lastSentenceStart) + 
              `The candidate particularly excels in ${uniqueStrongCompetencies.join(', ').replace(/, ([^,]*)$/, ', and $1')}, showing consistent professional judgment in these areas.`;
          }
        }

        // Update the weaknesses text to use unique competencies
        if (improvementAreas.length > 0 && uniqueImprovementCompetencies.length > 0) {
          // Replace the last part of the weaknesses text with unique competencies
          const lastSentenceStart = weaknessesText.lastIndexOf("Priority development areas include");
          if (lastSentenceStart !== -1) {
            weaknessesText = weaknessesText.substring(0, lastSentenceStart) + 
              `Priority development areas include ${uniqueImprovementCompetencies.join(', ').replace(/, ([^,]*)$/, ', and $1')}. Focused training in these competencies would significantly enhance professional effectiveness.`;
          }
        }

        analysisResult = {
          strengths: strengthsText,
          weaknesses: weaknessesText,
          summary: `The candidate completed ${sjtAnalyses.length} of ${submission.history.length} scenarios with AI analysis. The average competency score was ${(sjtAnalyses.reduce((acc, a) => acc + a.score, 0) / (sjtAnalyses.length || 1)).toFixed(1)}/10. ${strongResponses.length > 0 ? `Strong performance in ${uniqueStrongCompetencies.length} competency area(s).` : ''} ${improvementAreas.length > 0 ? `${uniqueImprovementCompetencies.length} competency area(s) identified for development.` : ''}`,
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
