
"use client";

import React from 'react';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ConversationEntry, AnalysisResult, MetaCompetency } from '@/types';
import { MessageSquare, ThumbsUp, ThumbsDown, BarChartHorizontal, RefreshCcw, Download, Loader2, BrainCircuit } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface ConversationSummaryProps {
  analysisResult: AnalysisResult;
  history: ConversationEntry[];
  onReattempt: () => void;
  reattemptText?: string;
}

const CompetencyChart = ({ metaCompetency }: { metaCompetency: MetaCompetency }) => (
  <div className="mb-6">
    <h4 className="text-lg font-semibold mb-2 text-primary">{metaCompetency.name}</h4>
    <div className="h-40 w-full">
       <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={metaCompetency.competencies}
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <XAxis type="number" domain={[0, 10]} hide />
          <YAxis
            type="category"
            dataKey="name"
            stroke="hsl(var(--foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={120}
            tick={{ dx: -5 }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--secondary))' }}
            contentStyle={{
              background: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: 'var(--radius)',
            }}
             formatter={(value: number) => [`${value}/10`, 'Score']}
          />
          <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
             <LabelList dataKey="score" position="right" style={{ fill: 'hsl(var(--foreground))' }} formatter={(value: number) => `${value}/10`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);


const ConversationSummary: React.FC<ConversationSummaryProps> = ({ analysisResult, history, onReattempt, reattemptText = "Re-attempt" }) => {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const isAdminView = reattemptText !== "Re-attempt";

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        let page = pdfDoc.addPage();

        const { width, height } = page.getSize();
        const FONT_SIZE = 10;
        const PADDING = 40;
        let y = height - PADDING;

        const primaryColor = rgb(0/255, 128/255, 0/255); // Green
        const textColor = rgb(0,0,0);
        const mutedColor = rgb(0.3, 0.3, 0.3);

        const checkY = (spaceNeeded: number) => {
            if (y - spaceNeeded < PADDING) {
                page = pdfDoc.addPage();
                y = height - PADDING;
            }
        };

        const drawWrappedText = (text: string, font: PDFFont, size: number, x: number, maxWidth: number, color: any, lineHeight: number) => {
            const words = text.split(' ');
            let line = '';
            for(const word of words) {
                const testLine = line + word + ' ';
                const testWidth = font.widthOfTextAtSize(testLine, size);
                if (testWidth > maxWidth) {
                    checkY(lineHeight);
                    page.drawText(line, { x, y, font, size, color });
                    y -= lineHeight;
                    line = word + ' ';
                } else {
                    line = testLine;
                }
            }
            checkY(lineHeight);
            page.drawText(line, { x, y, font, size, color });
            y -= lineHeight;
        }

        // Title with Logo
        try {
            // Using a reliable placeholder for PDF generation to avoid fetch issues.
            const logoUrl = 'https://placehold.co/280x60/FFFFFF/000000.png?text=Logo'; 
            const logoImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
            const logoImage = await pdfDoc.embedPng(logoImageBytes);
            const logoHeight = 25;
            const logoWidth = 120;
            checkY(logoHeight + 20);
            page.drawImage(logoImage, { x: PADDING, y: y - logoHeight + 10, width: logoWidth, height: logoHeight });
            page.drawText('Verbal Insights Report', { x: width - PADDING - helveticaBoldFont.widthOfTextAtSize('Verbal Insights Report', 18), y, font: helveticaBoldFont, size: 18, color: primaryColor });
            y -= (logoHeight + 20);
        } catch (e) {
             console.error("Could not load logo for PDF, using text fallback.", e);
             checkY(40);
             page.drawText('Verbal Insights Report', { x: PADDING, y, font: helveticaBoldFont, size: 24, color: primaryColor });
             y -= 30;
        }


        // Summary
        checkY(20);
        page.drawText('Overall Summary', { x: PADDING, y, font: helveticaBoldFont, size: 16 });
        y -= 20;
        drawWrappedText(analysisResult.summary, helveticaFont, FONT_SIZE, PADDING, width - 2 * PADDING, textColor, 15);
        y -= 20;
        
        // Strengths
        checkY(20);
        page.drawText('Strengths', { x: PADDING, y, font: helveticaBoldFont, size: 16 });
        y -= 20;
        drawWrappedText(analysisResult.strengths, helveticaFont, FONT_SIZE, PADDING, width - 2 * PADDING, textColor, 15);
        y -= 20;

        // Weaknesses
        checkY(20);
        page.drawText('Weaknesses', { x: PADDING, y, font: helveticaBoldFont, size: 16 });
        y -= 20;
        drawWrappedText(analysisResult.weaknesses, helveticaFont, FONT_SIZE, PADDING, width - 2 * PADDING, textColor, 15);
        y -= 20;

        // Competency Scores
        checkY(40);
        page.drawText('Competency Scores', { x: PADDING, y, font: helveticaBoldFont, size: 16 });
        y -= 20;

        analysisResult.competencyAnalysis.forEach(meta => {
            checkY(20);
            page.drawText(meta.name, { x: PADDING, y, font: helveticaBoldFont, size: 12 });
            y -= 15;
            meta.competencies.forEach(comp => {
                checkY(15);
                page.drawText(`${comp.name}: ${comp.score}/10`, { x: PADDING + 15, y, font: helveticaFont, size: FONT_SIZE });
                y -= 15;
            });
        });
        y -= 20;
        
        // Transcript
        checkY(40);
        page.drawText('Full Conversation Transcript', { x: PADDING, y, font: helveticaBoldFont, size: 16 });
        y -= 25;

        history.forEach((entry, index) => {
            checkY(40);
            drawWrappedText(`Q${index + 1}: ${entry.question}`, helveticaBoldFont, FONT_SIZE, PADDING, width - 2 * PADDING, textColor, 15);
            y -= 10;
            drawWrappedText(`A: ${entry.answer || "No answer recorded."}`, helveticaFont, FONT_SIZE, PADDING + 15, width - 2 * PADDING - 15, mutedColor, 15);
            y -= 20;
        });

        // Disclaimer
        const disclaimerText = "This AI-powered assessment is designed to provide behavioral insights for HR purposes and is not the sole basis for employment decisions. Your participation helps us improve our system.";
        const disclaimerLines = Math.ceil(helveticaFont.widthOfTextAtSize(disclaimerText, FONT_SIZE - 1) / (width - 2 * PADDING)) + 1;
        checkY(30 + disclaimerLines * 12);
        y -= 20;
        page.drawText('Disclaimer', { x: PADDING, y, font: helveticaBoldFont, size: 12, color: mutedColor });
        y -= 15;
        drawWrappedText(disclaimerText, helveticaFont, FONT_SIZE - 1, PADDING, width - 2 * PADDING, mutedColor, 12);


        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Verbal-Insights-Report.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);

        toast({
            title: "PDF Generated",
            description: "Your report has been downloaded.",
        });
    } catch(error) {
        console.error("Error generating PDF:", error);
        toast({
            variant: "destructive",
            title: "PDF Generation Failed",
            description: "There was an issue creating the PDF file.",
        });
    } finally {
        setIsGeneratingPdf(false);
    }
  };


  return (
    <div className="w-full max-w-4xl">       
       <Card className="bg-card backdrop-blur-xl border-border shadow-xl animate-fadeIn">
        <CardHeader className="text-center border-b pb-4">
          <div className="flex justify-center items-center mb-4 gap-2">
              <BrainCircuit className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl">Analysis Report</CardTitle>
          </div>
          <CardDescription>A detailed analysis of the conversation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
            <div className="space-y-4">
                <h3 className="text-xl font-semibold mb-3 text-foreground font-headline flex items-center">
                <BarChartHorizontal className="mr-2 h-6 w-6 text-primary" />
                Competency Scores
                </h3>
                <div className="p-4 border rounded-lg bg-secondary/30 shadow-inner">
                {analysisResult.competencyAnalysis.map(mc => (
                    <CompetencyChart key={mc.name} metaCompetency={mc} />
                ))}
                </div>
            </div>
            <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-secondary/30 shadow-inner">
                <h3 className="text-xl font-semibold mb-2 text-green-600 font-headline flex items-center">
                    <ThumbsUp className="mr-2 h-6 w-6" /> Strengths
                </h3>
                <p className="text-foreground whitespace-pre-wrap text-sm">{analysisResult.strengths}</p>
                </div>
                <div className="p-4 border rounded-lg bg-secondary/30 shadow-inner">
                <h3 className="text-xl font-semibold mb-2 text-red-600 font-headline flex items-center">
                    <ThumbsDown className="mr-2 h-6 w-6" /> Weaknesses
                </h3>
                <p className="text-foreground whitespace-pre-wrap text-sm">{analysisResult.weaknesses}</p>
                </div>
                <div className="p-4 border rounded-lg bg-secondary/30 shadow-inner">
                <h3 className="text-xl font-semibold mb-2 text-foreground font-headline">Overall Summary:</h3>
                <p className="text-foreground whitespace-pre-wrap text-sm">{analysisResult.summary}</p>
                </div>
            </div>
             <div>
              <h3 className="text-xl font-semibold mb-3 text-foreground font-headline flex items-center">
              <MessageSquare className="mr-2 h-6 w-6 text-primary" />
              Full Conversation Transcript:
              </h3>
              <Accordion type="single" collapsible className="w-full">
              {history.map((entry, index) => (
                  <AccordionItem value={`item-${index}`} key={index} className="border-b border-border/50 last:border-b-0">
                  <AccordionTrigger className="text-left hover:no-underline">
                      <span className="font-semibold text-primary mr-2">Q{index + 1}:</span> {entry.question}
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4 px-4 bg-secondary/20 rounded-b-md space-y-4">
                      <div>
                      <p className="font-semibold text-sm mb-1">Candidate's Answer:</p>
                      <p className="text-muted-foreground italic">
                          {entry.answer ? `"${entry.answer}"` : "No answer recorded."}
                      </p>
                      </div>
                      {entry.videoDataUri && (
                      <div>
                          <p className="font-semibold text-sm mb-1">Recording:</p>
                          {entry.videoDataUri.startsWith('data:video') ? (
                              <video controls src={entry.videoDataUri} className="mt-2 w-full rounded-md" />
                          ) : (
                              <audio controls src={entry.videoDataUri} className="mt-2 w-full" />
                          )}
                      </div>
                      )}
                  </AccordionContent>
                  </AccordionItem>
              ))}
              </Accordion>
          </div>
        </CardContent>
          <CardFooter className="flex-col sm:flex-row items-center justify-between gap-4 pt-6">
              <p className="text-xs text-muted-foreground">This analysis is AI-generated and intended to provide insights based on the conversation.</p>
              <div className="flex gap-2">
                <Button onClick={handleDownloadPdf} variant="outline" disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                </Button>
                <Button onClick={onReattempt} variant="outline">
                    <RefreshCcw className="mr-2 h-4 w-4" /> {reattemptText}
                </Button>
                {isAdminView && (
                    <Link href="/admin" className={cn(buttonVariants({ variant: 'default' }))}>
                        Back to Dashboard
                    </Link>
                )}
              </div>
          </CardFooter>
      </Card>
    </div>
  );
};

export default ConversationSummary;

    