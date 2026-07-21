import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { Period, ChartGranularity } from '../types';

dayjs.extend(isoWeek);

/** 获取指定时间段的起止时间戳 */
export function getPeriodRange(period: Period): { start: number; end: number } {
  const now = dayjs();
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  switch (period) {
    case 'today':
      start = now.startOf('day');
      end = now.endOf('day');
      break;
    case 'yesterday':
      start = now.subtract(1, 'day').startOf('day');
      end = now.subtract(1, 'day').endOf('day');
      break;
    case 'thisWeek':
      start = now.startOf('isoWeek');
      end = now.endOf('isoWeek');
      break;
    case 'lastWeek':
      start = now.subtract(1, 'week').startOf('isoWeek');
      end = now.subtract(1, 'week').endOf('isoWeek');
      break;
    case 'thisMonth':
      start = now.startOf('month');
      end = now.endOf('month');
      break;
    case 'lastMonth':
      start = now.subtract(1, 'month').startOf('month');
      end = now.subtract(1, 'month').endOf('month');
      break;
    case 'thisYear':
      start = now.startOf('year');
      end = now.endOf('year');
      break;
    default:
      start = now.startOf('day');
      end = now.endOf('day');
  }

  return { start: start.valueOf(), end: end.valueOf() };
}

/** 根据粒度生成趋势图的横轴标签和数据点 */
export function generateTrendSlots(granularity: ChartGranularity): { labels: string[]; slotStart: number; slotMs: number; count: number } {
  const now = dayjs();
  let labels: string[] = [];
  let slotMs: number;
  let count: number;
  let slotStart: number;

  switch (granularity) {
    case 'day':
      // 最近7天，每天一个点
      count = 7;
      slotMs = 86400000;
      slotStart = now.subtract(6, 'day').startOf('day').valueOf();
      for (let i = 6; i >= 0; i--) {
        labels.push(now.subtract(i, 'day').format('MM/DD'));
      }
      break;
    case 'week':
      // 最近4周，每周一个点
      count = 4;
      slotMs = 7 * 86400000;
      slotStart = now.subtract(3, 'week').startOf('isoWeek').valueOf();
      for (let i = 3; i >= 0; i--) {
        const d = now.subtract(i, 'week').startOf('isoWeek');
        labels.push(`${d.format('MM/DD')}周`);
      }
      break;
    case 'month':
      count = 6;
      slotStart = now.subtract(5, 'month').startOf('month').valueOf();
      for (let i = 5; i >= 0; i--) {
        labels.push(now.subtract(i, 'month').format('YYYY/MM'));
      }
      slotMs = Math.round(365.25 / 12 * 86400000); // 平均月长 ~30.44天
      break;
    case 'halfYear':
      count = 12;
      slotStart = now.subtract(11, 'month').startOf('month').valueOf();
      for (let i = 11; i >= 0; i--) {
        labels.push(now.subtract(i, 'month').format('YYYY/MM'));
      }
      slotMs = Math.round(365.25 / 12 * 86400000); // 平均月长
      break;
    case 'year':
      count = 5;
      slotStart = now.subtract(4, 'year').startOf('year').valueOf();
      for (let i = 4; i >= 0; i--) {
        labels.push(now.subtract(i, 'year').format('YYYY'));
      }
      slotMs = Math.round(365.25 * 86400000); // 平均年长（含闰年）
      break;
    default:
      count = 7;
      slotMs = 86400000;
      slotStart = now.subtract(6, 'day').startOf('day').valueOf();
      for (let i = 6; i >= 0; i--) {
        labels.push(now.subtract(i, 'day').format('MM/DD'));
      }
  }

  return { labels, slotStart, slotMs, count };
}

/** 格式化时间戳为可读字符串 */
export function formatTime(ts: number): string {
  const d = dayjs(ts);
  const now = dayjs();
  if (d.isSame(now, 'day')) return d.format('HH:mm');
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天 ' + d.format('HH:mm');
  if (d.isSame(now, 'year')) return d.format('MM/DD HH:mm');
  return d.format('YYYY/MM/DD HH:mm');
}

/** 相对时间 */
export function relativeTime(ts: number): string {
  const now = dayjs();
  const d = dayjs(ts);
  const diffMin = now.diff(d, 'minute');
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = now.diff(d, 'hour');
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = now.diff(d, 'day');
  if (diffDay < 30) return `${diffDay}天前`;
  return d.format('MM/DD HH:mm');
}

export { dayjs };
