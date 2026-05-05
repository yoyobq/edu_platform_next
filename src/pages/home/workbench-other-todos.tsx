import { useState } from 'react';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';

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

export function WorkbenchOtherTodos({ accountId }: { accountId: number | null | undefined }) {
  const storageKey = buildWorkbenchTodosStorageKey(accountId);
  const [items, setItems] = useState<WorkbenchLocalCustomItem[]>(() =>
    readWorkbenchLocalCustomItems(storageKey),
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [todoBackgroundColor, setTodoBackgroundColor] = useState(
    DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR,
  );
  const [todoTitle, setTodoTitle] = useState('');

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

  return (
    <>
      <div className="home-workbench-todo-items">
        <button
          aria-label="添加其他待办"
          className="home-workbench-todo-add"
          title="添加其他待办"
          type="button"
          onClick={openEditor}
        >
          <PlusOutlined />
        </button>
        {items.map((item) => (
          <div
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
