"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Loader2, Upload, FileText, Sparkles, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { vacancyApi } from "@/lib/api";
import type { VacancyAnalysis } from "@/lib/types";

type Step = "upload" | "analysis" | "searching";

export default function DashboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [vacancyText, setVacancyText] = useState("");
  const [analysis, setAnalysis] = useState<VacancyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await vacancyApi.analyzeFile(file);
      setAnalysis(data);
      setSessionTitle(data.position || file.name);
      setStep("analysis");
    } catch {
      toast.error("Не удалось обработать файл");
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxFiles: 1,
  });

  const handleAnalyzeText = async () => {
    if (!vacancyText.trim()) return;
    setLoading(true);
    try {
      const { data } = await vacancyApi.analyze(vacancyText);
      setAnalysis(data);
      setSessionTitle(data.position || "Поиск кандидатов");
      setStep("analysis");
    } catch {
      toast.error("Ошибка анализа вакансии");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSearch = async () => {
    if (!analysis || !vacancyText) return;
    setLoading(true);
    try {
      const { data } = await vacancyApi.startSearch(sessionTitle, vacancyText);
      toast.success("Поиск запущен! Это займёт несколько минут.");
      router.push(`/sessions/${data.id}`);
    } catch {
      toast.error("Не удалось запустить поиск");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Новый поиск кандидатов</h1>
          <p className="text-gray-500 mt-1">Загрузите вакансию — AI найдёт лучших кандидатов на hh.kz</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {[
            { key: "upload", label: "1. Загрузка вакансии" },
            { key: "analysis", label: "2. AI-анализ" },
            { key: "searching", label: "3. Поиск" },
          ].map(({ key, label }, i) => (
            <div key={key} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
              <span className={step === key ? "text-brand-500 font-semibold" : step > key ? "text-green-600" : "text-gray-400"}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div className="space-y-6">
            {/* File dropzone */}
            <div
              {...getRootProps()}
              className={`card p-8 border-2 border-dashed cursor-pointer text-center transition-colors ${
                isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-brand-300"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="font-medium text-gray-700">Перетащите файл или нажмите для выбора</p>
              <p className="text-sm text-gray-500 mt-1">Поддерживаются PDF и Word (.docx)</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-500">или вставьте текст вакансии</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <textarea
              value={vacancyText}
              onChange={(e) => setVacancyText(e.target.value)}
              className="input min-h-48 resize-none"
              placeholder="Вставьте текст вакансии здесь..."
            />

            <button
              onClick={handleAnalyzeText}
              disabled={!vacancyText.trim() || loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Анализировать вакансию
            </button>
          </div>
        )}

        {step === "analysis" && analysis && (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{analysis.position}</h2>
                  <p className="text-gray-500 text-sm mt-1">{analysis.location} · {analysis.experience_required}</p>
                </div>
                {(analysis.salary_from || analysis.salary_to) && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Зарплата</div>
                    <div className="font-semibold text-gray-900">
                      {analysis.salary_from?.toLocaleString()} — {analysis.salary_to?.toLocaleString()} ₸
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Hard Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.hard_skills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Soft Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.soft_skills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {analysis.search_synonyms.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Также будет искать по синонимам</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.search_synonyms.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Название поиска</label>
              <input
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className="input"
                placeholder="Главный технолог маслозавода — май 2025"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("upload")} className="btn-secondary">
                Назад
              </button>
              <button
                onClick={handleStartSearch}
                disabled={loading || !sessionTitle}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Начать поиск на hh.kz
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
