import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { GuardBlocklist } from '../domain/guard.js';

// 관리 패널이 쓰는 차단 목록 파일. 서버의 ~/.local/state/gawon-blocklist 를 두 컨테이너가 같이 붙임 (패널은 쓰기, api 는 읽기 전용)
// 한 줄에 주소 하나, # 뒤는 설명. nginx 형식(deny 1.2.3.4;)으로 적혀 있어도 읽음
const DEFAULT_FILE = '/run/gawon-blocklist/ip-blocklist.txt';

@Injectable()
export class FileGuardBlocklist extends GuardBlocklist {
  async read(): Promise<string[]> {
    let text: string;
    try {
      text = await readFile(process.env.GUARD_BLOCKLIST_FILE ?? DEFAULT_FILE, 'utf8');
    } catch {
      return [];
    }
    return text
      .split('\n')
      .map((line) => line.replace(/#.*/, '').replace(/^\s*deny\s+/, '').replace(/;\s*$/, '').trim())
      .filter((ip) => isIP(ip) !== 0);
  }
}
