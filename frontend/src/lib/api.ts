import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string }>("/api/auth/login", { email, password }),
  register: (data: { email: string; full_name: string; password: string; role: string }) =>
    api.post("/api/auth/register", data),
  me: () => api.get("/api/auth/me"),
};

// Vacancies
export const vacancyApi = {
  analyze: (text: string) => api.post("/api/vacancies/analyze", { text }),
  analyzeFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/api/vacancies/analyze", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  startSearch: (title: string, vacancy_text: string) =>
    api.post("/api/vacancies/search", { title, vacancy_text }),
  listSessions: () => api.get("/api/vacancies/sessions"),
  getSession: (id: number) => api.get(`/api/vacancies/sessions/${id}`),
};

// Candidates
export const candidateApi = {
  list: (sessionId: number) => api.get(`/api/candidates/session/${sessionId}`),
  get: (id: number) => api.get(`/api/candidates/${id}`),
  generateQuestions: (id: number) => api.post(`/api/candidates/${id}/interview-questions`),
  export: (sessionId: number, format: "excel" | "word" | "pdf") =>
    api.get(`/api/candidates/session/${sessionId}/export?format=${format}`, { responseType: "blob" }),
};
