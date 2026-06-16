"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Plus, X, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Task {
  id: string;
  name: string;
  sort_order: number;
  completed: boolean;
}

export default function DailyTasks() {
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [newName,  setNewName]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/baby/tasks");
    if (res.ok) {
      const json = await res.json();
      setTasks(json.tasks ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Realtime — reload when either parent changes tasks or completions
  useEffect(() => {
    const supabase = createClient();
    const channel  = supabase
      .channel("baby_daily_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "baby_tasks" },             loadTasks)
      .on("postgres_changes", { event: "*", schema: "public", table: "baby_task_completions" },  loadTasks)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTasks]);

  async function toggleTask(taskId: string) {
    setToggling(taskId);
    try {
      const res = await fetch(`/api/baby/tasks/${taskId}/toggle`, { method: "POST" });
      if (res.ok) {
        const { completed } = await res.json();
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completed } : t));
      }
    } finally {
      setToggling(null);
    }
  }

  async function addTask() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/baby/tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name }),
      });
      if (res.ok) {
        const { task } = await res.json();
        setTasks((prev) => [...prev, task]);
        setNewName("");
        setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/baby/tasks/${taskId}`, { method: "DELETE" });
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/70">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-bold text-white">Daily Tasks</span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-slate-500 font-mono tabular-nums">
              {completedCount}/{tasks.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { setAdding(true); setNewName(""); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Task list */}
      <div className="px-4 py-2">
        {loading ? (
          <div className="py-4 flex justify-center">
            <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
          </div>
        ) : tasks.length === 0 && !adding ? (
          <p className="text-center text-slate-600 text-xs py-4">
            No tasks yet — press + to add one
          </p>
        ) : (
          <div className="space-y-0.5">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-2.5 group">
                {/* Checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border transition-all flex items-center justify-center ${
                    task.completed
                      ? "bg-rose-500/70 border-rose-500"
                      : "border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {toggling === task.id
                    ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                    : task.completed
                      ? <Check className="w-3 h-3 text-white" />
                      : null
                  }
                </button>

                {/* Name */}
                <span className={`flex-1 text-sm transition-colors ${
                  task.completed ? "line-through text-slate-500" : "text-slate-200"
                }`}>
                  {task.name}
                </span>

                {/* Delete — visible on hover */}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add task inline */}
        {adding && (
          <div className="flex items-center gap-2 py-2 mt-1 border-t border-slate-700/40 pt-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  addTask();
                if (e.key === "Escape") { setAdding(false); setNewName(""); }
              }}
              placeholder="Task name..."
              autoFocus
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60"
            />
            <button
              onClick={addTask}
              disabled={saving || !newName.trim()}
              className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-sm hover:bg-rose-500/30 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setAdding(false); setNewName(""); }}
              className="w-8 h-8 flex items-center justify-center bg-slate-700/50 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <p className="text-[10px] text-slate-600 text-right px-5 pb-3">resets midnight CST</p>
      )}
    </div>
  );
}
