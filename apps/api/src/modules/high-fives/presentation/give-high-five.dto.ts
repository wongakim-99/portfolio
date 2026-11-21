import { IsInt, Max, Min } from 'class-validator';

// 화면에서 연타한 횟수를 모아 한 번에 보냄
export class GiveHighFiveDto {
  @IsInt()
  @Min(1)
  @Max(10)
  count: number;
}
