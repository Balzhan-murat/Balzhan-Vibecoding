"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Download, RefreshCw, Users, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import ScoreRing from "@/components/ScoreRing";
import RecommendationBadge from "@/components/RecommendationBadge";
import { vacancyApi, candidateApi } from "@/lib/api";
import type { SearchSession, Candidate } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "В очереди...",
  analyzing: "AI анализирует вакансию...",
  searching: "Поиск кандидатов на hh.kz...",
  scoring: "Оцениваю кандидатов...",
  completed: "Поиск завершён",
  error: "Ошибка",
};

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id);

  const [session, setSession] = useState<SearchSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [view, setView] = useState<"list" | "compare">("list");

  const pollSession = async () => {
    try {
      const { data } = await vacancyApi.getSession(sessionId);
      setSession(data);
      if (data.status === "completed" || data.status === "error") {
        setLoading(false);
        if (data.status === "completed") {
          const { data: cands } = await candidateApi.list(sessionId);
          setCandidates(cands);
        }
        return true;
      }
      return false;
    } catch {
      setLoading(false);
      return true;
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const start = async () => {
      const done = await pollSession();
      if (!done) {
        interval = setInterval(async () => {
          const done = await pollSession();
          if (done) clearInterval(interval);
        }, 5000);
      }
    };
    start();
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleExport = async (format: "excel" | "word" | "pdf") => {
    setExportLoading(true);
    try {
      const { data } = await candidateApi.export(sessionId, format);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `candidates_${sessionId}.${format === "excel" ? "xlsx" : format === "word" ? "docx" : "pdf"}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setExportLoading(false);
    }
  };

  const handleGenerateQuestions = async (candidate: Candidate) => {
    setGeneratingQuestions(true);
    try {
      const { data } = await candidateApi.generateQuestions(candidate.id);
      setSelectedCandidate(data);
      setCandidates((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    } catch {
      toast.error("Ошибка генерации вопросов");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const greenCandidates = candidates.filter((c) => c.recommendation === "green");
  const yellowCandidates = candidates.filter((c) => c.recommendation === "yellow");
  const redCandidates = candidates.filter((c) => c.recommendation === "red");

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/history" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" />
              История поисков
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{session?.title || "Загрузка..."}</h1>
            {session && (
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-sm ${session.status === "completed" ? "text-green-600" : session.status === "error" ? "text-red-600" : "text-amber-600"}`}>
                  {STATUS_LABELS[session.status] || session.status}
                </span>
                {session.status === "completed" && (
                  <span className="text-sm text-gray-500">Найдено: {candidates.length} кандидатов</span>
                )}
              </div>
            )}
          </div>

          {session?.status === "completed" && (
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button
                  disabled={exportLoading}
                  className="btn-secondary flex items-center gap-2"
                  onClick={() => handleExport("excel")}
                >
                  {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Экспорт
                </button>
              </div>
              <button onClick={() => handleExport("excel")} className="btn-secondary text-xs px-2 py-1">Excel</button>
              <button onClick={() => handleExport("word")} className="btn-secondary text-xs px-2 py-1">Word</button>
              <button onClick={() => handleExport("pdf")} className="btn-secondary text-xs px-2 py-1">PDF</button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="card p-16 text-center">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">{STATUS_LABELS[session?.status || "pending"]}</p>
            <p className="text-gray-400 text-sm mt-2">Обновляю каждые 5 секунд...</p>
          </div>
        )}

        {/* Completed */}
        {!loading && session?.status === "completed" && candidates.length > 0 && (
          <>
            {/* Recommendation summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 border-l-4 border-green-500">
                <div className="text-2xl font-bold text-green-600">{greenCandidates.length}</div>
                <div className="text-sm text-gray-600 mt-0.5">🟢 Пригласить немедленно</div>
              </div>
              <div className="card p-4 border-l-4 border-yellow-500">
                <div className="text-2xl font-bold text-yellow-600">{yellowCandidates.length}</div>
                <div className="text-sm text-gray-600 mt-0.5">🟡 Рассмотреть дополнительно</div>
              </div>
              <div className="card p-4 border-l-4 border-red-400">
                <div className="text-2xl font-bold text-red-500">{redCandidates.length}</div>
                <div className="text-sm text-gray-600 mt-0.5">🔴 Низкий приоритет</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setView("list")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "list" ? "bg-brand-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                Список кандидатов
              </button>
              <button
                onClick={() => setView("compare")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "compare" ? "bg-brand-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
              >
                Сравнение ТОП-20
              </button>
            </div>

            {view === "list" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {candidates.map((candidate, i) => (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(selectedCandidate?.id === candidate.id ? null : candidate)}
                    className={`card p-5 cursor-pointer transition-shadow hover:shadow-md ${selectedCandidate?.id === candidate.id ? "ring-2 ring-brand-500" : ""}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-sm text-gray-400 font-medium w-6 shrink-0">#{i + 1}</div>
                      <ScoreRing score={candidate.match_score || 0} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{candidate.full_name}</div>
                        <div className="text-sm text-gray-500 truncate">{candidate.position}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {candidate.city && <span>{candidate.city}</span>}
                          {candidate.experience_years && <span>{candidate.experience_years} лет опыта</span>}
                          {candidate.salary_expected && <span>{candidate.salary_expected.toLocaleString()} ₸</span>}
                        </div>
                        <div className="mt-2">
                          <RecommendationBadge rec={candidate.recommendation} />
                        </div>
                      </div>
                      {candidate.hh_url && (
                        <a
                          href={candidate.hh_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-brand-500 hover:underline shrink-0"
                        >
                          Резюме ↗
                        </a>
                      )}
                    </div>

                    {/* Expanded */}
                    {selectedCandidate?.id === candidate.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        {/* Score breakdown */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "Опыт", value: candidate.experience_score, weight: "35%" },
                            { label: "Навыки", value: candidate.skills_score, weight: "30%" },
                            { label: "Отрасль", value: candidate.industry_score, weight: "20%" },
                            { label: "Образование", value: candidate.education_score, weight: "15%" },
                          ].map(({ label, value, weight }) => (
                            <div key={label} className="text-center">
                              <div className="text-lg font-bold text-brand-500">{value?.toFixed(0) ?? "—"}</div>
                              <div className="text-xs text-gray-500">{label}</div>
                              <div className="text-xs text-gray-400">{weight}</div>
                            </div>
                          ))}
                        </div>

                        {candidate.pros && candidate.pros.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-700 mb-1">Почему подходит</div>
                            {candidate.pros.map((p) => (
                              <div key={p} className="text-xs text-green-700 flex items-start gap-1">
                                <span>✅</span> {p}
                              </div>
                            ))}
                          </div>
                        )}

                        {candidate.cons && candidate.cons.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-700 mb-1">Риски</div>
                            {candidate.cons.map((c) => (
                              <div key={c} className="text-xs text-amber-700 flex items-start gap-1">
                                <span>⚠️</span> {c}
                              </div>
                            ))}
                          </div>
                        )}

                        {candidate.ai_summary && (
                          <p className="text-xs text-gray-600 italic">{candidate.ai_summary}</p>
                        )}

                        {/* Skills */}
                        {candidate.skills && candidate.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills.slice(0, 12).map((s) => (
                              <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>
                            ))}
                          </div>
                        )}

                        {/* Interview questions */}
                        {candidate.interview_questions ? (
                          <div className="pt-2">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Вопросы для собеседования</div>
                            {Object.entries({
                              "По компетенциям": candidate.interview_questions.competency_questions,
                              "Технические": candidate.interview_questions.technical_questions,
                              "По ценностям": candidate.interview_questions.values_questions,
                            }).map(([label, questions]) => (
                              <div key={label} className="mb-2">
                                <div className="text-xs text-gray-500 mb-1">{label}:</div>
                                {questions.map((q, qi) => (
                                  <div key={qi} className="text-xs text-gray-700 ml-2">• {q}</div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleGenerateQuestions(candidate); }}
                            disabled={generatingQuestions}
                            className="btn-secondary text-xs flex items-center gap-1"
                          >
                            {generatingQuestions ? <Loader2 className="w-3 h-3 animate-spin" /> : "✨"}
                            Сгенерировать вопросы для собеседования
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {view === "compare" && (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-brand-500 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left">№</th>
                      <th className="px-4 py-3 text-left">ФИО</th>
                      <th className="px-4 py-3 text-left">Должность</th>
                      <th className="px-4 py-3 text-center">Опыт</th>
                      <th className="px-4 py-3 text-center">Навыки</th>
                      <th className="px-4 py-3 text-center">Отрасль</th>
                      <th className="px-4 py-3 text-center">Образование</th>
                      <th className="px-4 py-3 text-center">Match</th>
                      <th className="px-4 py-3 text-center">Рекомендация</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, 20).map((c, i) => (
                      <tr
                        key={c.id}
                        className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}
                        onClick={() => setSelectedCandidate(c)}
                      >
                        <td className="px-4 py-3 text-gray-500">#{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.full_name}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-40 truncate">{c.position}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${(c.experience_score || 0) >= 80 ? "text-green-600" : (c.experience_score || 0) >= 60 ? "text-amber-600" : "text-red-500"}`}>
                            {c.experience_score?.toFixed(0) ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${(c.skills_score || 0) >= 80 ? "text-green-600" : (c.skills_score || 0) >= 60 ? "text-amber-600" : "text-red-500"}`}>
                            {c.skills_score?.toFixed(0) ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${(c.industry_score || 0) >= 80 ? "text-green-600" : (c.industry_score || 0) >= 60 ? "text-amber-600" : "text-red-500"}`}>
                            {c.industry_score?.toFixed(0) ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${(c.education_score || 0) >= 80 ? "text-green-600" : (c.education_score || 0) >= 60 ? "text-amber-600" : "text-red-500"}`}>
                            {c.education_score?.toFixed(0) ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ScoreRing score={c.match_score || 0} size={44} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <RecommendationBadge rec={c.recommendation} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!loading && session?.status === "error" && (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">❌</div>
            <p className="text-gray-700 font-medium">Произошла ошибка при поиске</p>
            <p className="text-gray-500 text-sm mt-1">Проверьте настройки аккаунта hh.kz и попробуйте снова</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
