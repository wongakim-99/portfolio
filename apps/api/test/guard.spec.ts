import { isBotAgent, isExempt, maskIp } from '../src/modules/guard/domain/guard.js';

describe('봇 방어 도움 함수', () => {
  it('주소는 끝을 가려서만 보여 줌', () => {
    expect(maskIp('203.0.113.77')).toBe('203.0.113.*');
    expect(maskIp('::ffff:198.51.100.4')).toBe('198.51.100.*');
    expect(maskIp('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3:*');
  });

  it('서버 안쪽, 사설망, tailnet 은 세지도 막지도 않음', () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.1.2.3', '172.18.0.1', '192.168.45.221', '100.107.173.72', 'fd7a:115c:a1e0::1', '']) {
      expect(isExempt(ip)).toBe(true);
    }
    for (const ip of ['203.0.113.7', '1.225.192.81', '100.128.0.1', '172.32.0.1', '2001:db8::1']) expect(isExempt(ip)).toBe(false);
  });

  it('검색 엔진, 스크립트, 털기 도구는 봇으로 보고, 사람 브라우저는 아님', () => {
    for (const agent of ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'curl/8.7.1', 'Wget', 'Go-http-client/1.1', 'Mozilla/5.0 zgrab/0.x', '']) {
      expect(isBotAgent(agent)).toBe(true);
    }
    expect(isBotAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Safari/605.1.15')).toBe(false);
  });
});
