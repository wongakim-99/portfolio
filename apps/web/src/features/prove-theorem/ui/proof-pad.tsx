'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EASIER_PROBLEMS, gradeProof, problemFor } from '../lib/problems';
import './proof-pad.css';

const GRADING_MS = 1400;

interface ProofPadProps {
  postId: string;
  /** 더 쉬운 문제를 다 넘기고 나면 누르는 '그냥 부탁할게요'. 요청하기 칸으로 보냄 */
  onGiveUp: () => void;
}

type Grade = { state: 'idle' } | { state: 'grading' } | { state: 'graded'; verdict: string };

/** 잠긴 글 대신 놓이는 문제지와 노란 메모장. 무엇을 써 내든 빨간 펜으로 0점을 받음 */
export function ProofPad({ postId, onGiveUp }: ProofPadProps) {
  // -1 은 글마다 정해진 첫 문제, 0부터는 '더 쉬운 문제'
  const [level, setLevel] = useState(-1);
  const [proof, setProof] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [grade, setGrade] = useState<Grade>({ state: 'idle' });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const problem = level < 0 ? problemFor(postId) : (EASIER_PROBLEMS[level] ?? problemFor(postId));
  const lastLevel = level >= EASIER_PROBLEMS.length - 1;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const verdict = gradeProof(proof, attempts, postId);
    setAttempts((count) => count + 1);
    setGrade({ state: 'grading' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setGrade({ state: 'graded', verdict }), GRADING_MS);
  }

  function easier() {
    if (lastLevel) {
      onGiveUp();
      return;
    }
    window.clearTimeout(timer.current);
    setLevel((value) => value + 1);
    setProof('');
    setGrade({ state: 'idle' });
  }

  return (
    <section className="proof" aria-labelledby="proof-ask">
      <p className="hand proof-number">문제 {level + 2}.</p>
      <h3 id="proof-ask" className="proof-ask">
        {problem.ask}
      </h3>
      <p className="proof-note">{problem.note}</p>

      <form className="proof-form" onSubmit={submit}>
        <label className="sr" htmlFor="proof-pad">
          증명 메모장
        </label>
        <div className="proof-pad">
          <textarea
            id="proof-pad"
            value={proof}
            rows={6}
            maxLength={4000}
            spellCheck={false}
            placeholder="증명."
            onChange={(event) => setProof(event.target.value)}
          />
        </div>
        <div className="proof-actions">
          <button className="tape tape-lg" type="submit" disabled={grade.state === 'grading'}>
            증명 제출
          </button>
          <button className="text-btn" type="button" onClick={easier}>
            {lastLevel ? '그냥 주인장에게 부탁할게요' : '더 쉬운 문제 주세요'}
          </button>
          {attempts > 0 && <span className="community-meta">제출 {attempts}번, 통과 0번</span>}
        </div>
      </form>

      <div className="proof-grade" aria-live="polite">
        {grade.state === 'grading' && <p className="proof-grading">채점하는 중</p>}
        {grade.state === 'graded' && (
          <>
            <span className="proof-score" aria-label="0점">
              0
            </span>
            <p className="hand proof-verdict">{grade.verdict}</p>
          </>
        )}
      </div>
    </section>
  );
}
