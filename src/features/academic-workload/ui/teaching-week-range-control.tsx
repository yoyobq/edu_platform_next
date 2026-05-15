// src/features/academic-workload/ui/teaching-week-range-control.tsx
import { Button, Slider } from 'antd';

import {
  formatTeachingWeekDateRange,
  formatTeachingWeekDateSpan,
  type TeachingWeekRangeState,
} from './teaching-week-range-state';

import './teaching-week-range-control.css';

type TeachingWeekRangeControlVariant = 'card' | 'filter';

export function TeachingWeekRangeControl({
  range,
  rangeDescription,
  resetDisabled,
  resetLabel = '全学期',
  title = '教学周范围',
  valueLabel,
  variant = 'filter',
}: {
  range: TeachingWeekRangeState;
  rangeDescription?: string;
  resetDisabled?: boolean;
  resetLabel?: string;
  title?: string;
  valueLabel?: string;
  variant?: TeachingWeekRangeControlVariant;
}) {
  return (
    <div
      className={[
        'academic-workload-teaching-week-range',
        variant === 'card' ? 'academic-workload-teaching-week-range-card' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="academic-workload-teaching-week-range-header">
        <div>
          <span>{title}</span>
          {valueLabel ? <strong>{valueLabel}</strong> : null}
        </div>
        <Button
          disabled={resetDisabled ?? range.teachingWeeks.length === 0}
          size="small"
          type="link"
          onClick={range.resetTeachingWeekRange}
        >
          {resetLabel}
        </Button>
      </div>

      <Slider
        disabled={!range.sliderValue}
        marks={range.marks}
        max={range.lastTeachingWeekValue ?? 1}
        min={range.firstTeachingWeekValue ?? 1}
        range={{ draggableTrack: true }}
        tooltip={{ formatter: (value) => (value ? `第 ${value} 周` : '') }}
        value={range.sliderValue}
        onChange={(nextValue: number | number[]) => {
          if (!Array.isArray(nextValue)) {
            return;
          }

          const [nextStart, nextEnd] = nextValue;

          range.setTeachingWeekRange(nextStart ?? null, nextEnd ?? null);
        }}
      />

      <div className="academic-workload-teaching-week-range-summary">
        <div className="academic-workload-teaching-week-boundary">
          <span>起始</span>
          <strong>{range.selectedStartWeek?.label ?? '-'}</strong>
          <small>{formatTeachingWeekDateRange(range.selectedStartWeek)}</small>
        </div>
        <div className="academic-workload-teaching-week-boundary">
          <span>范围</span>
          <strong>
            {range.selectedTeachingWeekCount !== null
              ? `已选 ${range.selectedTeachingWeekCount} 周`
              : '-'}
          </strong>
          <small>
            {rangeDescription ??
              formatTeachingWeekDateSpan(range.selectedStartWeek, range.selectedEndWeek)}
          </small>
        </div>
        <div className="academic-workload-teaching-week-boundary">
          <span>结束</span>
          <strong>{range.selectedEndWeek?.label ?? '-'}</strong>
          <small>{formatTeachingWeekDateRange(range.selectedEndWeek)}</small>
        </div>
      </div>
    </div>
  );
}
