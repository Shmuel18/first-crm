'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Fired when the editor loses focus. Receives the latest HTML so a
   *  parent can persist on click-outside without keystroke-level writes. */
  onBlur?: (html: string) => void;
  placeholder?: string;
  minRows?: number;
};

export function RichTextEditor({ value, onChange, onBlur, placeholder, minRows = 8 }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 already includes Underline - no need to add separately
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    onBlur: ({ editor: ed }) => onBlur?.(ed.getHTML()),
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none p-3 leading-relaxed',
        style: `min-height: ${minRows * 1.5}rem`,
      },
    },
  });

  if (!editor) {
    return (
      <div
        className="border border-neutral-200 rounded-md bg-neutral-50 p-3 text-sm text-neutral-400"
        style={{ minHeight: `${minRows * 1.5 + 3}rem` }}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-md overflow-hidden bg-white focus-within:border-brand-gold focus-within:ring-2 focus-within:ring-brand-gold/20 transition">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations('richTextEditor');
  return (
    <div className="flex items-center gap-0.5 border-b border-neutral-200 bg-brand-gold-soft px-2 py-1.5">
      <ToolBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title={t('bold')}
      >
        <Bold className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title={t('italic')}
      >
        <Italic className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title={t('underline')}
      >
        <UnderlineIcon className="size-3.5" />
      </ToolBtn>
      <Divider />
      <ToolBtn
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title={t('heading2')}
      >
        <Heading2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title={t('heading3')}
      >
        <Heading3 className="size-3.5" />
      </ToolBtn>
      <Divider />
      <ToolBtn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title={t('bulletList')}
      >
        <List className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title={t('orderedList')}
      >
        <ListOrdered className="size-3.5" />
      </ToolBtn>
      <Divider />
      <ToolBtn
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title={t('blockquote')}
      >
        <Quote className="size-3.5" />
      </ToolBtn>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-neutral-300 mx-1" aria-hidden />;
}

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`size-7 rounded flex items-center justify-center transition ${
        active
          ? 'bg-brand-black text-white'
          : 'text-neutral-600 hover:bg-white hover:text-brand-black'
      }`}
    >
      {children}
    </button>
  );
}
