'use client';

import React from 'react';
import type { NodeRendererProps } from '../index';
import { QuizCompletionPanel } from './QuizCompletionPanel';
import { QuizQuestionView } from './QuizQuestionView';
import { useQuizSession } from './use-quiz-session';
import { parseQuizQuestions } from './quiz-utils';

export const QuizRenderer: React.FC<NodeRendererProps> = ({ output, isStreaming, compact = false }) => {
  const questions = parseQuizQuestions(output);
  const {
    state,
    stats,
    wrongQuestions,
    fillInput,
    setFillInput,
    dispatch,
    currentQuestion,
    isRevealed,
    userAnswer,
    handleAnswer,
    handleFillSubmit,
    handleNext,
  } = useQuizSession(questions);

  if (isStreaming && questions.length === 0) {
    return <div className="text-sm italic text-gray-400">测验题目生成中...</div>;
  }
  if (questions.length === 0 || !currentQuestion) {
    return <div className="text-sm italic text-gray-400">等待执行</div>;
  }
  if (compact) {
    return <div className="text-xs text-gray-600">共 {questions.length} 道题 · 展开视图可交互作答</div>;
  }
  if (state.completed) {
    return (
      <QuizCompletionPanel
        questions={questions}
        state={state}
        stats={stats}
        wrongQuestions={wrongQuestions}
        onToggleReview={() => dispatch({ type: 'TOGGLE_REVIEW' })}
        onReset={() => dispatch({ type: 'RESET' })}
      />
    );
  }

  return (
    <QuizQuestionView
      currentIndex={state.currentIndex}
      fillInput={fillInput}
      isRevealed={isRevealed}
      question={currentQuestion}
      questionCount={questions.length}
      stats={stats}
      userAnswer={userAnswer}
      setFillInput={setFillInput}
      onAnswer={handleAnswer}
      onFillSubmit={handleFillSubmit}
      onNext={handleNext}
      dispatch={dispatch}
    />
  );
};
