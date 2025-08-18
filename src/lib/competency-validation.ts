/**
 * @fileOverview Competency validation utilities for SJT scenarios
 * Provides functions to validate and standardize competency usage across the application
 */

import { getCompetencyDefinition, getAllCompetencyNames, isValidCompetency } from './competency-definitions';

/**
 * Validates competencies in SJT scenarios and provides suggestions for invalid ones
 */
export interface CompetencyValidationResult {
  isValid: boolean;
  competencyName: string;
  suggestions?: string[];
  standardizedName?: string;
}

/**
 * Validates and normalizes a competency name
 * @param competencyName - The competency name to validate
 * @returns Validation result with suggestions if invalid
 */
export function validateCompetency(competencyName: string): CompetencyValidationResult {
  if (!competencyName || competencyName.trim() === '') {
    return {
      isValid: false,
      competencyName: competencyName,
      suggestions: getAllCompetencyNames().slice(0, 5) // Show first 5 as examples
    };
  }

  const trimmedName = competencyName.trim();
  
  // Check exact match (case insensitive)
  if (isValidCompetency(trimmedName)) {
    const definition = getCompetencyDefinition(trimmedName);
    return {
      isValid: true,
      competencyName: trimmedName,
      standardizedName: definition?.name
    };
  }

  // Find similar competencies for suggestions
  const allCompetencies = getAllCompetencyNames();
  const suggestions = allCompetencies.filter(comp => 
    comp.toLowerCase().includes(trimmedName.toLowerCase()) ||
    trimmedName.toLowerCase().includes(comp.toLowerCase()) ||
    levenshteinDistance(comp.toLowerCase(), trimmedName.toLowerCase()) <= 2
  ).slice(0, 3);

  return {
    isValid: false,
    competencyName: trimmedName,
    suggestions: suggestions.length > 0 ? suggestions : allCompetencies.slice(0, 3)
  };
}

/**
 * Validates multiple competencies (for scenarios with multiple assessments)
 * @param competencyNames - Array of competency names
 * @returns Array of validation results
 */
export function validateCompetencies(competencyNames: string[]): CompetencyValidationResult[] {
  return competencyNames.map(name => validateCompetency(name));
}

/**
 * Gets formatted competency information for display
 * @param competencyName - The competency name
 * @returns Formatted competency info or null if not found
 */
export function getCompetencyDisplayInfo(competencyName: string): {
  name: string;
  description: string;
  isStandardized: boolean;
} | null {
  const definition = getCompetencyDefinition(competencyName);
  
  if (definition) {
    return {
      name: definition.name,
      description: definition.description,
      isStandardized: true
    };
  }

  return {
    name: competencyName,
    description: `Custom competency: ${competencyName} (no standardized definition available)`,
    isStandardized: false
  };
}

/**
 * Simple Levenshtein distance calculation for competency matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}
