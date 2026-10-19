// src/labs/teaching-inspection/ui/material.tsx
import { Alert, Descriptions, InputNumber } from 'antd';

import type { Assignment, Material } from '../model';
const assignmentGroups: { title: string; fields: [keyof Assignment, string][] }[] = [
  {
    title: '布置作业质量',
    fields: [
      ['assignedBook', '作业次数'],
      ['assignmentQuantity', '作业量'],
      ['knowledgeCoverage', '知识覆盖'],
    ],
  },
  {
    title: '批改情况',
    fields: [
      ['allMarkingStatus', '批改范围'],
      ['markingErrors', '错误标注'],
      ['markingCorrections', '订正批改'],
      ['markingAndDateDetails', '批改与日期记录'],
    ],
  },
  {
    title: '学生作业质量',
    fields: [
      ['studentCompletionStatus', '完成情况'],
      ['studentCorrectionStatus', '订正情况'],
    ],
  },
  { title: '检查人意见', fields: [['checkerOpinion', '意见']] },
];
export function MaterialView({
  material,
  scores,
  disabled,
  onScores,
}: {
  material: Material;
  scores: (number | null)[];
  disabled: boolean;
  onScores: (scores: (number | null)[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Alert
        type="info"
        showIcon
        title="预填材料，请核对后提交"
        description="评分和评语为核对起点，请依据实际检查结果确认。"
      />
      {material.lesson && (
        <>
          <p>检查章节：{material.lesson.chapter}</p>
          {material.lesson.scoreItems.map((item, index) => (
            <div className="flex items-start justify-between gap-3" key={`${index}-${item.name}`}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
              </div>
              <InputNumber
                aria-label={item.name}
                min={0}
                max={item.maximum}
                value={scores[index]}
                disabled={disabled}
                onChange={(value) => onScores(scores.map((old, i) => (i === index ? value : old)))}
              />
            </div>
          ))}
          <strong>合计：{scores.reduce<number>((sum, score) => sum + (score ?? 0), 0)} 分</strong>
        </>
      )}
      {material.progress && (
        <Descriptions
          column={1}
          bordered
          items={[
            { key: 'planned', label: '计划进度', children: material.progress.plannedProgress },
            { key: 'actual', label: '实际进度', children: material.progress.actualProgress },
            { key: 'deviation', label: '偏差', children: material.progress.deviation },
          ]}
        />
      )}
      {material.assignment &&
        assignmentGroups.map((group) => (
          <Descriptions
            key={group.title}
            title={group.title}
            column={1}
            bordered
            items={group.fields.map(([key, label]) => ({
              key,
              label,
              children: material.assignment![key],
            }))}
          />
        ))}
    </div>
  );
}
