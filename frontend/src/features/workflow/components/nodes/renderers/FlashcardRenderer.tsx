"use client";

/**
 * FlashcardRenderer — renders Q&A flashcards with flip animation.
 * Parses JSON output from the flashcard node into interactive cards.
 */

import React, { useState, useMemo } from "react";
import type { NodeRendererProps } from "../index";

interface Flashcard {
    question: string;
    answer: string;
}

export const FlashcardRenderer: React.FC<NodeRendererProps> = ({
    output,
    isStreaming,
    compact = false,
}) => {
    const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

    const cards: Flashcard[] = useMemo(() => {
        if (!output) return [];
        try {
            const parsed = JSON.parse(output);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [];
        }
    }, [output]);

    const toggleCard = (index: number) => {
        setFlippedCards((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    if (isStreaming && cards.length === 0) {
        return <div className="text-gray-400 text-sm italic">闪卡生成中...</div>;
    }

    if (cards.length === 0) {
        return <div className="text-gray-400 text-sm italic">等待执行</div>;
    }

    if (compact) {
        const firstCard = cards[0];
        return (
            <div className="text-xs text-gray-600">
                共 {cards.length} 张闪卡
                {firstCard ? ` · 示例：${firstCard.question.slice(0, 40)}${firstCard.question.length > 40 ? '…' : ''}` : ''}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="text-xs text-gray-500 mb-2">
                共 {cards.length} 张闪卡 · 点击翻转
            </div>
            {cards.map((card, i) => (
                <div
                    key={i}
                    onClick={() => toggleCard(i)}
                    className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-all duration-300 hover:shadow-md"
                    style={{
                        background: flippedCards.has(i)
                            ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
                            : "linear-gradient(135deg, #eff6ff, #dbeafe)",
                    }}
                >
                    <div className="text-xs font-medium text-gray-500 mb-1">
                        {flippedCards.has(i) ? "💡 答案" : `❓ 问题 ${i + 1}`}
                    </div>
                    <div className="text-sm text-gray-800">
                        {flippedCards.has(i) ? card.answer : card.question}
                    </div>
                </div>
            ))}
        </div>
    );
};
