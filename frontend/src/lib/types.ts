export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface VacancyAnalysis {
  position: string;
  experience_required: string;
  education: string;
  hard_skills: string[];
  soft_skills: string[];
  required: string[];
  preferred: string[];
  location: string;
  salary_from: number | null;
  salary_to: number | null;
  search_synonyms: string[];
}

export interface SearchSession {
  id: number;
  title: string;
  status: "pending" | "analyzing" | "searching" | "scoring" | "completed" | "error";
  vacancy_analysis: VacancyAnalysis | null;
  total_found: number;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: number;
  hh_url: string | null;
  full_name: string;
  position: string | null;
  city: string | null;
  experience_years: number | null;
  salary_expected: number | null;
  education: string | null;
  skills: string[] | null;
  match_score: number | null;
  experience_score: number | null;
  skills_score: number | null;
  industry_score: number | null;
  education_score: number | null;
  pros: string[] | null;
  cons: string[] | null;
  recommendation: "green" | "yellow" | "red" | null;
  ai_summary: string | null;
  interview_questions: {
    competency_questions: string[];
    technical_questions: string[];
    values_questions: string[];
    red_flag_questions: string[];
  } | null;
}
