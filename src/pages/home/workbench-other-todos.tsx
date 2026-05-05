import { useState } from 'react';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';

import { useWorkbenchCustomItemDrag } from './workbench-custom-item-dnd-context';
import { WorkbenchCustomItemEditor } from './workbench-custom-item-editor';
import { DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR } from './workbench-custom-item-options';
import {
  createWorkbenchLocalCustomItemId,
  readWorkbenchLocalCustomItems,
  type WorkbenchLocalCustomItem,
  writeWorkbenchLocalCustomItems,
} from './workbench-local-custom-items';

const WORKBENCH_TODOS_STORAGE_PREFIX = 'edu-mate:home-workbench-other-todos:v1';

function buildWorkbenchTodosStorageKey(accountId: number | null | undefined) {
  return [WORKBENCH_TODOS_STORAGE_PREFIX, accountId ?? 'anonymous'].join(':');
}

export function WorkbenchOtherTodos({
  accountId,
  headingId,
}: {
  accountId: number | null | undefined;
  headingId: string;
}) {
  const storageKey = buildWorkbenchTodosStorageKey(accountId);
  const [items, setItems] = useState<WorkbenchLocalCustomItem[]>(() =>
    readWorkbenchLocalCustomItems(storageKey),
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [todoBackgroundColor, setTodoBackgroundColor] = useState(
    DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR,
  );
  const [todoTitle, setTodoTitle] = useState('');
  const { activePayload, clearDrag, startDrag } = useWorkbenchCustomItemDrag();
  const canDropTimetableItem = activePayload?.source === 'timetable';

  function updateItems(nextItems: WorkbenchLocalCustomItem[]) {
    setItems(nextItems);
    writeWorkbenchLocalCustomItems(storageKey, nextItems);
  }

  function openEditor() {
    setTodoBackgroundColor(DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR);
    setTodoTitle('');
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setTodoTitle('');
    setIsEditorOpen(false);
  }

  function addTodo() {
    const normalizedTitle = todoTitle.trim();

    if (!normalizedTitle) {
      return;
    }

    updateItems([
      ...items,
      {
        backgroundColor: todoBackgroundColor,
        id: createWorkbenchLocalCustomItemId(),
        title: normalizedTitle,
      },
    ]);
    closeEditor();
  }

  function removeTodo(itemId: string) {
    updateItems(items.filter((item) => item.id !== itemId));
  }

  function moveDraggedItemToTodos() {
    if (!activePayload || activePayload.source !== 'timetable') {
      return;
    }

    updateItems([
      ...items,
      {
        backgroundColor: activePayload.item.backgroundColor,
        id: createWorkbenchLocalCustomItemId(),
        title: activePayload.item.title,
      },
    ]);
    activePayload.removeSource();
    clearDrag();
  }

  return (
    <>
      <div className="home-workbench-secondary-heading">
        <div className="home-workbench-secondary-title-action">
          <h2 id={headingId}>其他待办</h2>
          <button
            aria-label="添加其他待办"
            className="home-workbench-todo-add"
            title="添加其他待办"
            type="button"
            onClick={openEditor}
          >
            <PlusOutlined />
          </button>
        </div>
        <span className="home-workbench-todo-local-notice">
          注意：待办事项暂时保存在本地，无法跨设备展示
        </span>
      </div>
      <div
        className={`home-workbench-todo-items ${
          canDropTimetableItem ? 'home-workbench-todo-items-drop-enabled' : ''
        }`}
        onDragOver={(event) => {
          if (!canDropTimetableItem) {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          if (!canDropTimetableItem) {
            return;
          }

          event.preventDefault();
          moveDraggedItemToTodos();
        }}
      >
        {items.map((item) => (
          <div
            draggable
            className="home-workbench-todo-item"
            key={item.id}
            style={
              item.backgroundColor
                ? {
                    backgroundColor: item.backgroundColor,
                    borderColor: item.backgroundColor,
                  }
                : undefined
            }
            onDragEnd={clearDrag}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.title);
              startDrag({
                item,
                removeSource: () => removeTodo(item.id),
                source: 'todo',
              });
            }}
          >
            <span>{item.title}</span>
            <button
              aria-label={`删除待办 ${item.title}`}
              className="home-workbench-todo-remove"
              type="button"
              onClick={() => removeTodo(item.id)}
            >
              <CloseOutlined />
            </button>
          </div>
        ))}
      </div>
      <WorkbenchCustomItemEditor
        backgroundColor={todoBackgroundColor}
        inputValue={todoTitle}
        open={isEditorOpen}
        placeholder="输入待办事项"
        title="添加其他待办"
        onBackgroundColorChange={setTodoBackgroundColor}
        onCancel={closeEditor}
        onInputChange={setTodoTitle}
        onSubmit={addTodo}
      />
    </>
  );
}
