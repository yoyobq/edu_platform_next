import { Input, Modal } from 'antd';

import { CUSTOM_ITEM_BACKGROUND_OPTIONS } from './workbench-custom-item-options';

import './workbench-custom-item-editor.css';

export function WorkbenchCustomItemEditor(props: {
  backgroundColor: string;
  inputValue: string;
  open: boolean;
  placeholder?: string;
  title: string;
  onBackgroundColorChange: (value: string) => void;
  onCancel: () => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      cancelText="取消"
      okButtonProps={{ disabled: !props.inputValue.trim() }}
      okText="添加"
      open={props.open}
      title={props.title}
      onCancel={props.onCancel}
      onOk={props.onSubmit}
    >
      <div className="home-workbench-custom-item-editor">
        <Input
          autoFocus
          maxLength={40}
          placeholder={props.placeholder ?? '输入事项名称'}
          showCount
          value={props.inputValue}
          onChange={(event) => props.onInputChange(event.target.value)}
          onPressEnter={props.onSubmit}
        />
        <div className="home-workbench-custom-item-editor-color">
          <span>背景颜色</span>
          <div className="home-workbench-custom-color-options">
            {CUSTOM_ITEM_BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                aria-label={option.label}
                aria-pressed={props.backgroundColor === option.value}
                className="home-workbench-custom-color-option"
                style={{ backgroundColor: option.value }}
                title={option.label}
                type="button"
                onClick={() => props.onBackgroundColorChange(option.value)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
