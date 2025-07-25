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
      const sjtAnalyses: any[] = [];
      
      // Get SJT scenarios with complete data needed for analysis
      const sjtScenarios = [
        {
          situation: "You're working on a group project with a tight deadline, and one team member consistently misses meetings and doesn't contribute their fair share of work.",
          question: "How would you handle this situation with your team member?",
          bestResponseRationale: "The best response would involve direct but respectful communication with the team member, offering support while establishing clear expectations, and involving appropriate stakeholders if needed.",
          worstResponseRationale: "The worst response would be to ignore the situation, publicly shame the team member, or take on all their work without addressing the underlying issue.",
          assessedCompetency: "Teamwork"
        },
        {
          situation: "Your manager asks you to complete a task that you believe goes against company policy or ethical guidelines.",
          question: "What would be your approach to handling this request?",
          bestResponseRationale: "The best response involves respectfully raising concerns with the manager, seeking clarification on policies, and escalating through proper channels if necessary while maintaining professionalism.",
          worstResponseRationale: "The worst response would be to blindly follow instructions without question, or to refuse outright without proper communication or following appropriate escalation procedures.",
          assessedCompetency: "Integrity"
        },
        {
          situation: "You receive harsh criticism from a supervisor about your work during a team meeting in front of your colleagues.",
          question: "How would you respond to this situation?",
          bestResponseRationale: "The best response involves staying calm, listening actively, asking for specific feedback, and requesting a private follow-up discussion to understand improvement areas.",
          worstResponseRationale: "The worst response would be to become defensive, argue publicly, shut down emotionally, or dismiss the feedback without consideration.",
          assessedCompetency: "Resilience"
        },
        {
          situation: "You're assigned a project that requires skills and knowledge you don't currently possess, with a deadline that seems unrealistic.",
          question: "How would you approach this challenging assignment?",
          bestResponseRationale: "The best response involves honest assessment of capabilities, creating a learning plan, seeking appropriate resources and mentorship, and communicating realistic timelines with stakeholders.",
          worstResponseRationale: "The worst response would be to panic, avoid the task, promise unrealistic deliverables, or attempt the work without seeking necessary support and guidance.",
          assessedCompetency: "Adaptability"
        }
      ];
      
      // Process each scenario
      for (let i = 0; i < Math.min(submission.history.length, sjtScenarios.length); i++) {
        const entry = submission.history[i];
        const scenario = sjtScenarios[i];
        
        if (entry?.answer && scenario) {
          const sjtAnalysisInput = {
            situation: scenario.situation,
            question: scenario.question,
            bestResponseRationale: scenario.bestResponseRationale,
            worstResponseRationale: scenario.worstResponseRationale,
            assessedCompetency: scenario.assessedCompetency,
            candidateAnswer: entry.answer,
          };
          
          try {
            const result = await analyzeSJTResponse(sjtAnalysisInput);
            
            sjtAnalyses.push({ ...result, competency: scenario.assessedCompetency });
            console.log(`✅ Analysis complete for scenario ${i + 1}`);
          } catch (analysisError) {
            console.warn(`⚠️ Failed to analyze scenario ${i + 1}:`, analysisError);
          }
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

        analysisResult = {
          strengths: strengthsText,
          weaknesses: weaknessesText,
          summary: `The candidate completed ${sjtAnalyses.length} of ${submission.history.length} scenarios with AI analysis. The average competency score was ${(sjtAnalyses.reduce((acc, a) => acc + a.score, 0) / (sjtAnalyses.length || 1)).toFixed(1)}/10. ${strongResponses.length > 0 ? `Strong performance in ${strongResponses.length} scenario(s).` : ''} ${improvementAreas.length > 0 ? `${improvementAreas.length} area(s) identified for development.` : ''}`,
          competencyAnalysis: [{
            name: "Situational Competencies",
            competencies: sjtAnalyses.map((a) => ({
              name: a.competency,
              score: a.score
            })).sort((a,b) => a.name.localeCompare(b.name)),
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
