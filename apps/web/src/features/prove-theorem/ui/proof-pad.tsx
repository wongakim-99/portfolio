'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { keepPhrases, prefersReducedMotion, warmFont } from '@shared/lib';
import { streamProofGrade } from '@entities/blog-post';
import { gradeProof, problemSequence } from '../lib/problems';
import './proof-pad.css';

// 빈 종이처럼 AI 에게 보내지 않는 채점, AI 를 못 써서 미리 적어 둔 채점평을 낼 때 기다리는 척하는 시간
const GRADING_MS = 1400;
const FALLBACK_MIN_MS = 900;
// 첫 글자를 기다리는 동안 돌아가며 보여 주는 줄
const WAITING = ['답안지를 받는 중', 'Lean 4 에 넣어 보는 중', '심사위원 2번을 깨우는 중', '빨간 펜 뚜껑을 여는 중', '반례를 찾는 중', '클레이 연구소에 전화하는 중'];
const WAITING_MS = 900;
// 받은 채점평을 펜으로 쓰듯 한 글자씩. 받은 글자보다 많이 밀리면 몇 글자씩 따라잡음
const PEN_MS = 30;
// 메모장 손글씨 글꼴 (shared/styles/tokens.css 의 --font-hand 첫 글꼴)
const HAND_FONT = 'Nanum Pen Script';

/** 문제를 다 넘기고 항복할 때까지의 기록. 항복 문서에 적힘 */
export interface ProofRecord {
  attempts: number;
  problems: number;
}

interface ProofPadProps {
  postId: string;
  /** 마지막 문제까지 넘기고 누르는 '그냥 부탁할게요' */
  onGiveUp: (record: ProofRecord) => void;
}

type Grade = { state: 'idle' } | { state: 'waiting' } | { state: 'graded'; verdict: string; done: boolean };

/** 잠긴 글 대신 놓이는 문제지와 노란 메모장. AI 가 빨간 펜으로 채점평을 쓰지만 무엇을 써 내든 0점 */
export function ProofPad({ postId, onGiveUp }: ProofPadProps) {
  // 0 은 글마다 정해진 첫 문제, 1부터는 '더 쉬운 문제'
  const [level, setLevel] = useState(0);
  const [proof, setProof] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [grade, setGrade] = useState<Grade>({ state: 'idle' });
  const [waitingLine, setWaitingLine] = useState(0);
  const [shown, setShown] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    request.current?.abort();
  }, []);

  useEffect(() => {
    if (grade.state !== 'waiting') return;
    const id = window.setInterval(() => setWaitingLine((line) => line + 1), WAITING_MS);
    return () => window.clearInterval(id);
  }, [grade.state]);

  const verdict = grade.state === 'graded' ? grade.verdict : '';
  useEffect(() => {
    if (shown >= verdict.length) return;
    const id = window.setTimeout(() => {
      const left = verdict.length - shown;
      setShown(shown + (prefersReducedMotion() ? left : left > 24 ? 3 : 1));
    }, PEN_MS);
    return () => window.clearTimeout(id);
  }, [shown, verdict]);

  const sequence = problemSequence(postId);
  const problem = sequence[Math.min(level, sequence.length - 1)]!;
  const lastLevel = level >= sequence.length - 1;
  const writing = grade.state === 'graded' && (!grade.done || shown < verdict.length);
  const busy = grade.state === 'waiting' || writing;

  function stop() {
    window.clearTimeout(timer.current);
    request.current?.abort();
    request.current = null;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    stop();
    const attempt = attempts + 1;
    const fallback = gradeProof(proof, attempts, postId);
    setAttempts(attempt);
    setGrade({ state: 'waiting' });
    setWaitingLine(0);
    setShown(0);
    // 빈 종이는 AI 에게 보내지 않음
    if (!proof.trim()) {
      timer.current = window.setTimeout(() => setGrade({ state: 'graded', verdict: fallback, done: true }), GRADING_MS);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    // AI 를 못 쓰면(하루 한도, 서버 오류) 미리 적어 둔 채점평을 냄. 바로 튀어나오지 않게 제출하고 적어도 이만큼은 기다림
    const settled = new Promise((resolve) => window.setTimeout(resolve, FALLBACK_MIN_MS));
    let written = '';
    void streamProofGrade(postId, { problem: problem.id, proof, attempt }, (text) => {
      written += text;
      setGrade({ state: 'graded', verdict: written, done: false });
    }, controller.signal).then(async (received) => {
      if (controller.signal.aborted) return;
      if (received) {
        setGrade({ state: 'graded', verdict: written, done: true });
        return;
      }
      await settled;
      if (!controller.signal.aborted) setGrade({ state: 'graded', verdict: fallback, done: true });
    });
  }

  function easier() {
    if (lastLevel) {
      onGiveUp({ attempts, problems: sequence.length });
      return;
    }
    stop();
    setLevel((value) => value + 1);
    setProof('');
    setGrade({ state: 'idle' });
  }

  return (
    <section className="proof" aria-labelledby="proof-ask">
      <p className="hand proof-number">문제 {level + 1}.</p>
      <h3 id="proof-ask" className="proof-ask">
        {keepPhrases(problem.ask)}
      </h3>
      <p className="proof-note">{keepPhrases(problem.note)}</p>

      <form className="proof-form" onSubmit={submit}>
        <label className="sr" htmlFor="proof-pad">
          증명 메모장
        </label>
        {/* 메모장에 손을 올리거나 누르면 손글씨 글꼴 조각을 미리 받아, 쓰는 동안 글자가 다른 글꼴로 보였다 바뀌지 않게 함 */}
        <div className="proof-pad" onPointerEnter={() => warmFont(HAND_FONT)} onFocus={() => warmFont(HAND_FONT)}>
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
          <button className="tape tape-lg" type="submit" disabled={busy}>
            증명 제출
          </button>
          <button className="text-btn" type="button" onClick={easier}>
            {lastLevel ? '그냥 주인장에게 부탁할게요' : '더 쉬운 문제 주세요'}
          </button>
          {attempts > 0 && <span className="community-meta">제출 {attempts}번, 통과 0번</span>}
        </div>
        <p className="proof-fineprint">적어 낸 답안은 채점에만 쓰고 남기지 않습니다.</p>
      </form>

      <div className="proof-grade" aria-live="polite" aria-busy={busy}>
        {grade.state === 'waiting' && <p className="proof-grading">{WAITING[waitingLine % WAITING.length]}</p>}
        {grade.state === 'graded' && (
          <>
            <span className="proof-score" aria-label="0점">
              0
            </span>
            <p className="hand proof-verdict">
              {keepPhrases(verdict.slice(0, shown))}
              {writing && <span className="proof-pen" aria-hidden="true" />}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
