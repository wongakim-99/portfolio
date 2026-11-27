import { BadRequestException, Injectable } from '@nestjs/common';
import type { Identity } from '../../identity/index.js';
import { isVisible } from '../domain/blog.js';
import { BlogPostRepository, WritingLogRepository } from '../domain/blog.ports.js';
import { minutesByDay, MONTH, monthRange, seoulDayOf } from '../domain/writing.js';
import { readerOf } from './reader-access.js';

/** 달력 하루. minutes 는 그날 글을 고친 분 수, posts 는 그날 올린 글 가운데 보는 사람에게 보이는 것 */
export interface CalendarDay {
  day: string;
  minutes: number;
  posts: { id: string; title: string }[];
}

// 블로그 첫 화면의 책상 달력. 글을 올린 날에는 도장, 글을 쓴 날에는 쓴 시간만큼 진한 커피 자국
// 쓴 시간은 누구에게나 보이는 합계(무엇을 썼는지는 모름)이고, 나만 보기 글의 도장은 주인장에게만 보임
@Injectable()
export class BlogCalendarService {
  constructor(
    private readonly posts: BlogPostRepository,
    private readonly writing: WritingLogRepository,
  ) {}

  /** 글쓰기 화면이 임시저장할 때마다 보내는 '글을 고친 분'을 서울 날짜별로 남김 */
  async log(author: Identity, minutes: number[]): Promise<void> {
    await this.writing.add(author.id, minutesByDay(minutes, Date.now()));
  }

  async month(viewer: Identity | null, month: string): Promise<{ month: string; days: CalendarDay[] }> {
    if (!MONTH.test(month)) throw new BadRequestException('달은 2026-11 처럼 보내 주세요.');
    const reader = readerOf(viewer);
    const { first, last, from, to } = monthRange(month);
    const [posts, written] = await Promise.all([
      this.posts.createdBetween(from, to, Boolean(reader?.owner)),
      this.writing.between(first, last),
    ]);
    const days = new Map<string, CalendarDay>();
    const dayOf = (day: string) => days.get(day) ?? days.set(day, { day, minutes: 0, posts: [] }).get(day)!;
    for (const { day, minutes } of written) dayOf(day).minutes = minutes;
    for (const post of posts) {
      if (isVisible(post, reader)) dayOf(seoulDayOf(post.createdAt.getTime())).posts.push({ id: post.id, title: post.title });
    }
    return { month, days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)) };
  }
}
