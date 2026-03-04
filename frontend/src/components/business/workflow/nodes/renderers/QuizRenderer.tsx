"use client";

/**
 * QuizRenderer — interactive quiz answering experience.
 *
 * Features:
 * - Sequential question display (one at a time)
 * - Instant ✅❌ feedback on answer selection
 * - Expandable explanation panel
 * - Bottom progress bar + accuracy rate
 * - "Wrong answers review" panel on completion
 *
 * Expected JSON structure:
 * [
 *   {
 *     "type": "choice" | "true_false" | "fill_blank",
 *     "question": "...",
 *     "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
 *     "answer": "B",
 *     "explanation": "...",
 *     "difficulty": "easy" | "medium" | "hard",
 *     "source_concept": "..."
 *   }
 * ]
 */

import React, { useState, useMemo, useReducer, useCallback } from "react";
import type { NodeRendererProps } from "../index";

interface QuizQuestion {
    type: string;
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    difficulty: string;
    source_concept: string;
}

// State management via useReducer for complex quiz state
interface QuizState {
    currentIndex: number;
    answers: Record<number, string>; // questionIndex -> userAnswer
    revealed: Set<number>; // questions whose answers have been revealed
    completed: boolean;
    showReview: boolean;
}

type QuizAction =
    | { type: "ANSWER"; index: number; answer: string }
    | { type: "NEXT" }
    | { type: "PREV" }
    | { type: "COMPLETE" }
    | { type: "TOGGLE_REVIEW" }
    | { type: "RESET" };

function quizReducer(state: QuizState, action: QuizAction): QuizState {
    switch (action.type) {
        case "ANSWER":
            return {
                ...state,
                answers: { ...state.answers, [action.index]: action.answer },
                revealed: new Set([...state.revealed, action.index]),
            };
        case "NEXT":
            return { ...state, currentIndex: state.currentIndex + 1 };
        case "PREV":
            return { ...state, currentIndex: Math.max(0, state.currentIndex - 1) };
        case "COMPLETE":
            return { ...state, completed: true };
        case "TOGGLE_REVIEW":
            return { ...state, showReview: !state.showReview };
        case "RESET":
            return {
                currentIndex: 0,
                answers: {},
                revealed: new Set(),
                completed: false,
                showReview: false,
            };
        default:
            return state;
    }
}

const DIFFICULTY_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    easy: { label: "基础", color: "#059669", bg: "#d1fae5" },
    medium: { label: "进阶", color: "#d97706", bg: "#fef3c7" },
    hard: { label: "挑战", color: "#dc2626", bg: "#fee2e2" },
};

const TYPE_LABELS: Record<string, string> = {
    choice: "选择题",
    true_false: "判断题",
    fill_blank: "填空题",
};

export const QuizRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
}) => {
    const questions: QuizQuestion[] = useMemo(() => {
        if (!output) return [];
        try {
            const parsed = JSON.parse(output);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [];
        }
    }, [output]);

    const [state, dispatch] = useReducer(quizReducer, {
        currentIndex: 0,
        answers: {},
        revealed: new Set<number>(),
        completed: false,
        showReview: false,
    });

    const [fillInput, setFillInput] = useState("");

    // Calculate stats
    const stats = useMemo(() => {
        let correct = 0;
        let answered = 0;
        for (const [idx, userAnswer] of Object.entries(state.answers)) {
            answered++;
            const q = questions[Number(idx)];
            if (q && isCorrect(q, userAnswer)) correct++;
        }
        return { correct, answered, total: questions.length };
    }, [state.answers, questions]);

    const wrongQuestions = useMemo(() => {
        return Object.entries(state.answers)
            .filter(([idx, userAnswer]) => {
                const q = questions[Number(idx)];
                return q && !isCorrect(q, userAnswer);
            })
            .map(([idx]) => Number(idx));
    }, [state.answers, questions]);

    const handleAnswer = useCallback(
        (answer: string) => {
            if (state.revealed.has(state.currentIndex)) return; // Already answered
            dispatch({ type: "ANSWER", index: state.currentIndex, answer });
        },
        [state.currentIndex, state.revealed]
    );

    const handleFillSubmit = useCallback(() => {
        if (fillInput.trim()) {
            handleAnswer(fillInput.trim());
            setFillInput("");
        }
    }, [fillInput, handleAnswer]);

    const handleNext = useCallback(() => {
        if (state.currentIndex < questions.length - 1) {
            dispatch({ type: "NEXT" });
        } else {
            dispatch({ type: "COMPLETE" });
        }
    }, [state.currentIndex, questions.length]);

    // Loading state
    if (isStreaming && questions.length === 0) {
        return <div className="text-gray-400 text-sm italic">测验题目生成中...</div>;
    }
    if (questions.length === 0) {
        return <div className="text-gray-400 text-sm italic">等待执行</div>;
    }

    const currentQ = questions[state.currentIndex];
    const isRevealed = state.revealed.has(state.currentIndex);
    const userAnswer = state.answers[state.currentIndex];
    const diffBadge = DIFFICULTY_BADGES[currentQ?.difficulty] || DIFFICULTY_BADGES.medium;

    // Completion view
    if (state.completed) {
        const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        return (
            <div className="space-y-4">
                {/* Score card */}
                <div
                    className="rounded-xl p-4 text-center"
                    style={{
                        background:
                            accuracy >= 80
                                ? "linear-gradient(135deg, #d1fae5, #a7f3d0)"
                                : accuracy >= 60
                                    ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                                    : "linear-gradient(135deg, #fee2e2, #fecaca)",
                    }}
                >
                    <div className="text-3xl font-bold mb-1">{accuracy}%</div>
                    <div className="text-sm text-gray-700">
                        答对 {stats.correct} / {stats.total} 题
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {accuracy >= 80 ? "🎉 太棒了！" : accuracy >= 60 ? "👍 继续加油！" : "📚 建议复习后重试"}
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                    {wrongQuestions.length > 0 && (
                        <button
                            onClick={() => dispatch({ type: "TOGGLE_REVIEW" })}
                            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                            📋 错题回顾 ({wrongQuestions.length})
                        </button>
                    )}
                    <button
                        onClick={() => dispatch({ type: "RESET" })}
                        className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                        🔄 重新答题
                    </button>
                </div>

                {/* Wrong questions review */}
                {state.showReview && (
                    <div className="space-y-3">
                        <div className="text-xs font-semibold text-red-600">错题回顾</div>
                        {wrongQuestions.map((qIdx) => {
                            const q = questions[qIdx];
                            return (
                                <div key={qIdx} className="rounded-lg border border-red-200 p-3 bg-red-50/50">
                                    <div className="text-xs text-gray-500 mb-1">第 {qIdx + 1} 题</div>
                                    <div className="text-sm font-medium text-gray-800 mb-2">{q.question}</div>
                                    <div className="text-xs text-red-600 mb-1">
                                        你的答案：{state.answers[qIdx]}
                                    </div>
                                    <div className="text-xs text-green-600 mb-1">
                                        正确答案：{q.answer}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded">
                                        💡 {q.explanation}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // Question view
    return (
        <div className="space-y-3">
            {/* Progress bar */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${((state.currentIndex + (isRevealed ? 1 : 0)) / questions.length) * 100}%`,
                            background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                        }}
                    />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                    {state.currentIndex + 1}/{questions.length}
                </span>
            </div>

            {/* Question header */}
            <div className="flex items-center gap-2">
                <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: diffBadge.bg, color: diffBadge.color }}
                >
                    {diffBadge.label}
                </span>
                <span className="text-[10px] text-gray-400">
                    {TYPE_LABELS[currentQ.type] || currentQ.type}
                </span>
                {currentQ.source_concept && (
                    <span className="text-[10px] text-gray-400">
                        · {currentQ.source_concept}
                    </span>
                )}
            </div>

            {/* Question text */}
            <div className="text-sm font-medium text-gray-800">{currentQ.question}</div>

            {/* Answer options */}
            {currentQ.type === "fill_blank" ? (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={fillInput}
                        onChange={(e) => setFillInput(e.target.value)}
                        disabled={isRevealed}
                        onKeyDown={(e) => e.key === "Enter" && handleFillSubmit()}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
                        placeholder="输入你的答案..."
                    />
                    {!isRevealed && (
                        <button
                            onClick={handleFillSubmit}
                            className="px-3 py-2 text-xs font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                        >
                            提交
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {currentQ.options.map((option, i) => {
                        const isSelected = userAnswer === option;
                        const isCorrectOption = isRevealed && isOptionCorrect(currentQ, option);
                        const isWrongSelection = isRevealed && isSelected && !isCorrectOption;

                        let borderColor = "#e5e7eb";
                        let bgColor = "white";
                        let textColor = "#374151";

                        if (isRevealed) {
                            if (isCorrectOption) {
                                borderColor = "#10b981";
                                bgColor = "#d1fae5";
                                textColor = "#059669";
                            } else if (isWrongSelection) {
                                borderColor = "#ef4444";
                                bgColor = "#fee2e2";
                                textColor = "#dc2626";
                            }
                        } else if (isSelected) {
                            borderColor = "#6366f1";
                            bgColor = "#eef2ff";
                            textColor = "#4f46e5";
                        }

                        return (
                            <button
                                key={i}
                                onClick={() => handleAnswer(option)}
                                disabled={isRevealed}
                                className="w-full text-left px-3 py-2 rounded-lg border text-sm transition-all duration-200"
                                style={{
                                    borderColor,
                                    backgroundColor: bgColor,
                                    color: textColor,
                                    cursor: isRevealed ? "default" : "pointer",
                                }}
                            >
                                <span className="flex items-center gap-2">
                                    {isRevealed && isCorrectOption && <span>✅</span>}
                                    {isRevealed && isWrongSelection && <span>❌</span>}
                                    {option}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Explanation (shown after answer) */}
            {isRevealed && currentQ.explanation && (
                <div
                    className="rounded-lg p-3 text-xs text-gray-700"
                    style={{
                        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                        borderLeft: isCorrect(currentQ, userAnswer!)
                            ? "3px solid #10b981"
                            : "3px solid #ef4444",
                    }}
                >
                    <div className="font-semibold text-gray-800 mb-1">
                        {isCorrect(currentQ, userAnswer!)
                            ? "✅ 回答正确！"
                            : `❌ 正确答案：${currentQ.answer}`}
                    </div>
                    💡 {currentQ.explanation}
                </div>
            )}

            {/* Navigation */}
            {isRevealed && (
                <div className="flex justify-between">
                    {state.currentIndex > 0 ? (
                        <button
                            onClick={() => dispatch({ type: "PREV" })}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            ← 上一题
                        </button>
                    ) : (
                        <div />
                    )}
                    <button
                        onClick={handleNext}
                        className="px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                    >
                        {state.currentIndex < questions.length - 1 ? "下一题 →" : "查看结果 🎯"}
                    </button>
                </div>
            )}

            {/* Current stats */}
            {stats.answered > 0 && (
                <div className="text-[10px] text-gray-400 text-center">
                    已答 {stats.answered} 题 · 正确 {stats.correct} 题 ·
                    正确率 {stats.total > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0}%
                </div>
            )}
        </div>
    );
};

// Helper: check if user answer is correct
function isCorrect(q: QuizQuestion, userAnswer: string): boolean {
    if (!userAnswer) return false;
    const normalizedAnswer = q.answer.trim().toLowerCase();
    const normalizedUser = userAnswer.trim().toLowerCase();

    // For choice questions, compare just the letter
    if (q.type === "choice") {
        const answerLetter = normalizedAnswer.charAt(0);
        const userLetter = normalizedUser.charAt(0);
        return answerLetter === userLetter;
    }

    return normalizedAnswer === normalizedUser;
}

// Helper: check if a specific option is the correct one
function isOptionCorrect(q: QuizQuestion, option: string): boolean {
    const answerLetter = q.answer.trim().toLowerCase().charAt(0);
    const optionLetter = option.trim().toLowerCase().charAt(0);
    return answerLetter === optionLetter;
}
