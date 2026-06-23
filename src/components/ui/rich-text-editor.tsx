'use client';

import { useEffect, type FocusEvent, type ReactNode } from 'react';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
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
  /** When false, render the content read-only (no toolbar, no editing) —
   *  e.g. for a viewer who lacks edit permission. TipTap still parses the
   *  HTML to its safe node schema, so this stays XSS-safe. Defaults to true. */
  editable?: boolean;
  /** Show a link / unlink button. The Link mark ships with StarterKit v3, so
   *  this only toggles the toolbar control (default off — opt-in per usage). */
  enableLink?: boolean;
  /** Text direction of the editable area (not the toolbar). Lets a bilingual
   *  caller force LTR/RTL independent of the surrounding UI; omit to inherit. */
  dir?: 'rtl' | 'ltr';
};

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows = 8,
  editable = true,
  enableLink = false,
  dir,
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      // StarterKit v3 already includes Underline + Link - no need to add either
      // separately. openOnClick:false so clicking a link while editing places
      // the caret instead of navigating away.
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none p-3 leading-relaxed',
        style: `min-height: ${minRows * 1.5}rem`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  // Keep editable in sync if the prop flips after mount.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

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

  const handleContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocus = event.relatedTarget;
    if (nextFocus && event.currentTarget.contains(nextFocus as Node)) return;
    onBlur?.(editor.getHTML());
  };

  return (
    <div
      onBlur={editable ? handleContainerBlur : undefined}
      className="border border-neutral-200 rounded-md overflow-hidden bg-white focus-within:border-brand-gold focus-within:ring-2 focus-within:ring-brand-gold/20 transition"
    >
      {editable && <Toolbar editor={editor} enableLink={enableLink} />}
      <div dir={dir}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, enableLink }: { editor: Editor; enableLink: boolean }) {
  const t = useTranslations('richTextEditor');

  const editLink = (): void => {
    const href = editor.getAttributes('link').href;
    const previous = typeof href === 'string' ? href : 'https://';
    const url = window.prompt(t('linkPrompt'), previous);
    if (url === null) return; // cancelled
    const trimmed = url.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

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
      {enableLink && (
        <>
          <Divider />
          <ToolBtn active={editor.isActive('link')} onClick={editLink} title={t('link')}>
            <Link2 className="size-3.5" />
          </ToolBtn>
          <ToolBtn
            active={false}
            disabled={!editor.isActive('link')}
            onClick={() => editor.chain().focus().unsetLink().run()}
            title={t('removeLink')}
          >
            <Link2Off className="size-3.5" />
          </ToolBtn>
        </>
      )}
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
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={`size-7 rounded flex items-center justify-center transition disabled:opacity-40 disabled:pointer-events-none ${
        active
          ? 'bg-brand-black text-white'
          : 'text-neutral-600 hover:bg-white hover:text-brand-black'
      }`}
    >
      {children}
    </button>
  );
}
