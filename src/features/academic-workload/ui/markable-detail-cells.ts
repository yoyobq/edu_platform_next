// src/features/academic-workload/ui/markable-detail-cells.ts
import { useCallback, useState } from 'react';

export type MarkableDetailCellRow = {
  detailRowIndex: number;
  key: string;
};

export type MarkableDetailCellClassNames = {
  evenCell: string;
  markStartCell: string;
  markableCell: string;
  markedCell: string;
  oddCell: string;
};

export type MarkableDetailCellOptions = {
  isMarkStart?: boolean;
};

export type MarkableDetailCellProps = {
  className: string;
  onClick: () => void;
};

export type MarkableDetailCellPropsGetter<Row extends MarkableDetailCellRow> = (
  row: Row,
  options?: MarkableDetailCellOptions,
) => MarkableDetailCellProps;

function getDetailCellClassName(
  row: MarkableDetailCellRow,
  classNames: MarkableDetailCellClassNames,
) {
  return row.detailRowIndex % 2 === 0 ? classNames.evenCell : classNames.oddCell;
}

export function useMarkableDetailCells<Row extends MarkableDetailCellRow>(
  classNames: MarkableDetailCellClassNames,
) {
  const [markedDetailRowKeys, setMarkedDetailRowKeys] = useState<Set<string>>(() => new Set());

  const clearMarkedDetailRows = useCallback(() => {
    setMarkedDetailRowKeys(new Set());
  }, []);

  const toggleDetailMark = useCallback((rowKey: string) => {
    setMarkedDetailRowKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(rowKey)) {
        nextKeys.delete(rowKey);
      } else {
        nextKeys.add(rowKey);
      }

      return nextKeys;
    });
  }, []);

  const getMarkableDetailCellProps = useCallback<MarkableDetailCellPropsGetter<Row>>(
    (row, options = {}) => ({
      className: [
        getDetailCellClassName(row, classNames),
        markedDetailRowKeys.has(row.key) ? classNames.markedCell : '',
        classNames.markableCell,
        options.isMarkStart ? classNames.markStartCell : '',
      ]
        .filter(Boolean)
        .join(' '),
      onClick: () => toggleDetailMark(row.key),
    }),
    [classNames, markedDetailRowKeys, toggleDetailMark],
  );

  return {
    clearMarkedDetailRows,
    getMarkableDetailCellProps,
  };
}
