/**
 * @fileOverview Standardized competency definitions for consistent AI evaluation
 * This file contains the official definitions and descriptions for all competencies
 * used in SJT analysis to ensure consistent scoring across scenarios.
 */

export interface CompetencyDefinition {
  name: string;
  description: string;
}

/**
 * Official competency definitions used for AI evaluation
 * Each competency has a clear, specific description that the AI will use
 * to judge candidate responses strictly against these criteria.
 */
export const COMPETENCY_DEFINITIONS: Record<string, CompetencyDefinition> = {
  "Adaptability": {
    name: "Adaptability",
    description: "Demonstrates flexibility and resilience when facing changing circumstances, new challenges, or unexpected situations. Shows willingness to adjust approaches, learn new methods, and maintain effectiveness despite uncertainty or disruption."
  },
  
  "Aligning": {
    name: "Aligning", 
    description: "Ability to coordinate efforts, build consensus, and ensure that individual and team actions are synchronized with organizational goals and priorities. Shows skill in bringing people together toward common objectives."
  },
  
  "Analytical skills": {
    name: "Analytical skills",
    description: "Demonstrates systematic thinking, logical reasoning, and the ability to break down complex problems into manageable components. Shows proficiency in gathering, evaluating, and interpreting information to make sound decisions."
  },
  
  "Coaching and developing others": {
    name: "Coaching and developing others",
    description: "Shows commitment to helping others grow professionally by providing guidance, feedback, and learning opportunities. Demonstrates ability to identify development needs and support skill building in team members."
  },
  
  "Communication": {
    name: "Communication",
    description: "Effectively exchanges information, ideas, and feedback through various channels and formats. Demonstrates clear, concise, and appropriate communication that facilitates understanding and achieves desired outcomes."
  },
  
  "Creativity and innovation": {
    name: "Creativity and innovation",
    description: "Generates original ideas, approaches problems from unique angles, and develops novel solutions. Shows willingness to challenge conventional thinking and explore new possibilities for improvement or advancement."
  },
  
  "Customer Focus": {
    name: "Customer Focus",
    description: "Actively seeks to understand customer needs, responds promptly and appropriately to customer concerns, and consistently delivers solutions that exceed customer expectations while maintaining positive relationships."
  },
  
  "Decision making": {
    name: "Decision making",
    description: "Makes timely, well-informed decisions by considering available information, potential consequences, and stakeholder impacts. Shows confidence in choosing appropriate courses of action even under pressure or uncertainty."
  },
  
  "Delegation": {
    name: "Delegation",
    description: "Effectively assigns tasks and responsibilities to others while providing appropriate authority, resources, and support. Demonstrates trust in team members and ability to maintain accountability without micromanaging."
  },
  
  "Emotional intelligence": {
    name: "Emotional intelligence",
    description: "Demonstrates self-awareness, empathy, and social skills in managing emotions and relationships. Shows ability to understand and respond appropriately to emotional cues from self and others."
  },
  
  "Empathy": {
    name: "Empathy",
    description: "Shows genuine understanding and consideration for others' perspectives, feelings, and experiences. Demonstrates ability to connect with people and respond compassionately to their needs and concerns."
  },
  
  "Integrity": {
    name: "Integrity",
    description: "Consistently demonstrates honesty, ethical behavior, and adherence to moral principles. Shows reliability in keeping commitments and maintaining trust through transparent and principled actions."
  },
  
  "Leadership": {
    name: "Leadership",
    description: "Inspires and guides others toward achieving goals, provides direction during challenges, and takes responsibility for team outcomes. Demonstrates ability to influence positive change and motivate others to perform at their best."
  },
  
  "Managing conflict": {
    name: "Managing conflict",
    description: "Effectively addresses disagreements and tensions by facilitating constructive dialogue, finding mutually acceptable solutions, and maintaining positive relationships. Shows skill in de-escalating situations and preventing conflicts from escalating."
  },
  
  "Planning and organizing": {
    name: "Planning and organizing",
    description: "Systematically structures tasks, resources, and timelines to achieve objectives efficiently. Demonstrates ability to prioritize activities, coordinate efforts, and maintain organization in complex or dynamic environments."
  },
  
  "Problem solving": {
    name: "Problem solving",
    description: "Identifies issues, analyzes root causes, and develops effective solutions through systematic thinking. Shows persistence in addressing challenges and creativity in finding workable approaches to overcome obstacles."
  },
  
  "Resilience": {
    name: "Resilience",
    description: "Maintains composure and effectiveness under pressure, bounces back from setbacks, and continues pursuing goals despite obstacles. Shows mental toughness and ability to recover quickly from difficulties."
  },
  
  "Teamwork": {
    name: "Teamwork",
    description: "Collaborates effectively with others, contributes positively to group dynamics, and supports collective success. Shows willingness to share responsibilities, assist team members, and work toward common goals."
  },
  
  "Time management": {
    name: "Time management",
    description: "Efficiently organizes and prioritizes tasks to meet deadlines and maximize productivity. Demonstrates ability to balance multiple responsibilities and allocate time appropriately to different activities."
  }
};

/**
 * Gets the standardized definition for a competency
 * @param competencyName - The name of the competency
 * @returns The competency definition or null if not found
 */
export function getCompetencyDefinition(competencyName: string): CompetencyDefinition | null {
  // Normalize the competency name for lookup (handle case variations)
  const normalizedName = Object.keys(COMPETENCY_DEFINITIONS).find(
    key => key.toLowerCase() === competencyName.toLowerCase()
  );
  
  if (normalizedName) {
    return COMPETENCY_DEFINITIONS[normalizedName];
  }
  
  return null;
}

/**
 * Gets all available competency names
 * @returns Array of all competency names
 */
export function getAllCompetencyNames(): string[] {
  return Object.keys(COMPETENCY_DEFINITIONS);
}

/**
 * Validates if a competency name exists in the definitions
 * @param competencyName - The competency name to validate
 * @returns True if the competency exists, false otherwise
 */
export function isValidCompetency(competencyName: string): boolean {
  return getCompetencyDefinition(competencyName) !== null;
}
