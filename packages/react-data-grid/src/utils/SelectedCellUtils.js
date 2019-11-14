import { CellNavigationMode } from "common/constants";
import { isFunction } from "common/utils";
import * as rowUtils from "../RowUtils";
import { getColumn, isFrozen, canEdit } from "../ColumnUtils";
import * as zIndexes from "common/constants/zIndexes";

export const getRowTop = (rowIdx, rowHeight) => rowIdx * rowHeight;

export const getSelectedRow = ({ selectedPosition, rowGetter }) => {
  const { rowIdx } = selectedPosition;
  return rowGetter(rowIdx);
};

export const getSelectedDimensions = ({
  selectedPosition,
  columns,
  rowHeight,
  scrollLeft
}) => {
  const { idx, rowIdx } = selectedPosition;
  if (idx >= 0) {
    const column = getColumn(columns, idx);
    const frozen = isFrozen(column);
    const { width } = column;
    const left = frozen ? column.left + scrollLeft : column.left;
    const top = getRowTop(rowIdx, rowHeight);
    const zIndex = frozen ? zIndexes.FROZEN_CELL_MASK : zIndexes.CELL_MASK;
    return { width, left, top, height: rowHeight, zIndex };
  }
  return { width: 0, left: 0, top: 0, height: rowHeight, zIndex: 1 };
};

const getColumnRangeProperties = (from, to, columns) => {
  let totalWidth = 0;
  let anyColFrozen = false;
  for (let i = from; i <= to; i++) {
    const column = getColumn(columns, i);
    totalWidth += column.width;
    anyColFrozen = anyColFrozen || isFrozen(column);
  }
  return { totalWidth, anyColFrozen, left: getColumn(columns, from).left };
};

export const getSelectedRangeDimensions = ({
  selectedRange,
  columns,
  rowHeight
}) => {
  const { topLeft, bottomRight } = selectedRange;

  if (topLeft.idx < 0) {
    return {
      width: 0,
      left: 0,
      top: 0,
      height: rowHeight,
      zIndex: zIndexes.CELL_MASK
    };
  }

  const { totalWidth, anyColFrozen, left } = getColumnRangeProperties(
    topLeft.idx,
    bottomRight.idx,
    columns
  );
  const top = getRowTop(topLeft.rowIdx, rowHeight);
  const height = (bottomRight.rowIdx - topLeft.rowIdx + 1) * rowHeight;
  const zIndex = anyColFrozen ? zIndexes.FROZEN_CELL_MASK : zIndexes.CELL_MASK;

  return { width: totalWidth, left, top, height, zIndex };
};

export const getSelectedColumn = ({ selectedPosition, columns }) => {
  const { idx } = selectedPosition;
  return getColumn(columns, idx);
};

export const getSelectedCellValue = ({
  selectedPosition,
  columns,
  rowGetter
}) => {
  const column = getSelectedColumn({ selectedPosition, columns });
  const row = getSelectedRow({ selectedPosition, rowGetter });

  return row && column ? rowUtils.get(row, column.key) : null;
};

export const isSelectedCellEditable = ({
  enableCellSelect,
  selectedPosition,
  columns,
  rowGetter,
  onCheckCellIsEditable
}) => {
  const column = getSelectedColumn({ selectedPosition, columns });

  const row = getSelectedRow({ selectedPosition, rowGetter });

  const isCellEditable = isFunction(onCheckCellIsEditable)
    ? onCheckCellIsEditable({ row, column, ...selectedPosition })
    : true;

  return canEdit(column, row, enableCellSelect) && isCellEditable;
};

export const getNextSelectedCellPosition = (
  { cellNavigationMode, columns, rowsCount },
  nextPosition
) => {
  if (cellNavigationMode !== CellNavigationMode.NONE) {
    const { idx, rowIdx } = nextPosition;
    const isAfterLastColumn = idx === columns.length;
    const isBeforeFirstColumn = idx === -1;

    if (isAfterLastColumn) {
      if (cellNavigationMode === CellNavigationMode.CHANGE_ROW) {
        const isLastRow = rowIdx === rowsCount - 1;
        if (!isLastRow) {
          return {
            idx: 0,
            rowIdx: rowIdx + 1,
            changeRowOrColumn: true
          };
        }
      } else if (cellNavigationMode === CellNavigationMode.LOOP_OVER_ROW) {
        return {
          rowIdx,
          idx: 0,
          changeRowOrColumn: true
        };
      }
    } else if (isBeforeFirstColumn) {
      if (cellNavigationMode === CellNavigationMode.CHANGE_ROW) {
        const isFirstRow = rowIdx === 0;
        if (!isFirstRow) {
          return {
            rowIdx: rowIdx - 1,
            idx: columns.length - 1,
            changeRowOrColumn: true
          };
        }
      } else if (cellNavigationMode === CellNavigationMode.LOOP_OVER_ROW) {
        return {
          rowIdx: rowIdx,
          idx: columns.length - 1,
          changeRowOrColumn: true
        };
      }
    }
  }

  return { ...nextPosition, changeRowOrColumn: false };
};

/**
 * Find the next or previous editable cell
 *
 * @param {*} params Params such as the cell navigation mode, direction that we are moving (next of previous cell), array of columns, and row count
 * @param {*} currentPosition  The current cell
 * @param {*} enableCellSelect Is the selection of cells enabled
 * @param {*} rowGetter Function used to get a particular row
 * @param {*} onCheckCellIsEditable Function to be called when a cell is checked to see if it is editable
 */
export function getNextOrPrevEditableCell(
  { cellNavigationMode, direction, columns, rowsCount },
  currentPosition,
  enableCellSelect,
  rowGetter,
  onCheckCellIsEditable
) {
  let stopLooking = false;

  const { idx, rowIdx } = currentPosition;
  let currentCell = { idx: idx, rowIdx: rowIdx, changeRowOrColumn: false };
  while (!stopLooking) {
    const isAfterLastColumn = currentCell.idx === columns.length;
    const isBeforeFirstColumn = currentCell.idx === -1;

    if (isAfterLastColumn) {
      const isLastRow = rowIdx === rowsCount - 1;
      if (!isLastRow) {
        currentCell = {
          idx: 0,
          rowIdx: rowIdx + 1,
          changeRowOrColumn: true
        };
      }
    } else if (isBeforeFirstColumn) {
      const isFirstRow = rowIdx === 0;
      if (!isFirstRow) {
        currentCell = {
          rowIdx: rowIdx - 1,
          idx: columns.length - 1,
          changeRowOrColumn: true
        };
      }
    }

    const cellToCheck = {
      rowIdx: currentCell.rowIdx,
      idx: currentCell.idx,
      changeRowOrColumn: currentCell.changeRowOrColumn
    };

    const column = getColumn(columns, cellToCheck.idx);
    const row = rowGetter(cellToCheck.rowIdx);

    const isCellEditable = isFunction(onCheckCellIsEditable)
      ? onCheckCellIsEditable({ row, column, ...selectedPosition })
      : true;

    // Retturn the editable cell that was found
    if (canEdit(column, row, enableCellSelect) && isCellEditable) {
      return cellToCheck;
    }

    // Forward direction (find the next editable cell)
    if (
      direction === undefined ||
      direction === null ||
      direction === CellNavigationMode.NEXT_CELL
    ) {
      currentCell = {
        idx: cellToCheck.idx + 1,
        rowIdx: cellToCheck.rowIdx,
        changeRowOrColumn: cellToCheck.changeRowOrColumn
      };

      // Stop checking if we have reached the end of the last row
      if (
        currentCell.rowIdx === rowsCount - 1 &&
        currentCell.idx >= columns.length
      ) {
        stop = true;

        return null;
      }
    } // Reverse direction (find the previous editable cell)
    else {
      currentCell = {
        idx: cellToCheck.idx - 1,
        rowIdx: cellToCheck.rowIdx,
        changeRowOrColumn: cellToCheck.changeRowOrColumn
      };

      // Stop checking if we have reached the end of the first row
      if (currentCell.rowIdx <= 0 && currentCell.idx <= 0) {
        stop = true;
        return null;
      }
    }
  }
  //return { ...nextPosition, changeRowOrColumn: false };
}

export function canExitGrid(
  e,
  { cellNavigationMode, columns, rowsCount, selectedPosition: { rowIdx, idx } }
) {
  // When the cellNavigationMode is 'none' or 'changeRow', you can exit the grid if you're at the first or last cell of the grid
  // When the cellNavigationMode is 'loopOverRow', there is no logical exit point so you can't exit the grid
  if (
    cellNavigationMode === CellNavigationMode.NONE ||
    cellNavigationMode === CellNavigationMode.CHANGE_ROW
  ) {
    const atLastCellInRow = idx === columns.length - 1;
    const atFirstCellInRow = idx === 0;
    const atLastRow = rowIdx === rowsCount - 1;
    const atFirstRow = rowIdx === 0;
    const shift = e.shiftKey === true;

    return shift
      ? atFirstCellInRow && atFirstRow
      : atLastCellInRow && atLastRow;
  }

  return false;
}

export function selectedRangeIsSingleCell(selectedRange) {
  return (
    selectedRange.topLeft.idx === selectedRange.bottomRight.idx &&
    selectedRange.topLeft.rowIdx === selectedRange.bottomRight.rowIdx
  );
}
