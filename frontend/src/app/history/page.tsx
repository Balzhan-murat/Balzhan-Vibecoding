"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Users, ChevronRight, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { vacancyApi } from "@/lib/api";
import type { SearchSession } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  analyzing: "bg-blue-100 text-blue-700",
  searching: "bg-blue-100 text-blue-700",
  scoring: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "В очереди",
  analyzing: "Анализ",
  searching: "Поиск",
  scoring: "Скоринг",
  completed: "Завершён",
  error: "Ошибка",
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vacancyApi.listSessions().then(({ data }) => {
      setSessions(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">История поисков</h1>
            <p className="text-gray-500 mt-1">Все ваши поисковые сессии</p>
          </div>
          <Link href="/dashboard" className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" />
            Новый поиск
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="card p-16 text-center">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Нет поисков</p>
            <p className="text-gray-400 text-sm mt-1">Создайте первый поиск кандидатов</p>
            <Link href="/dashboard" className="btn-primary inline-flex mt-4">
              Начать поиск
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <div className="card p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[session.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[session.status] || session.status}
                      </span>
                      <h3 className="font-semibold text-gray-900 truncate">{session.title}</h3>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(session.created_at).toLocaleDateString("ru-RU", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </span>
                      {session.status === "completed" && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {session.total_found} кандидатов
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
